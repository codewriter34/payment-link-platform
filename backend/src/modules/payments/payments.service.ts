import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { MansaTransfersService } from '../integrations/mansatransfers/mansa-transfers.service';
import { EmailService } from '../email/email.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private mansaService: MansaTransfersService,
    private configService: ConfigService,
    private emailService: EmailService,
    private redisService: RedisService,
  ) {}

  /**
   * Initiate a payment transaction
   */
  async initiatePayment(dto: InitiatePaymentDto) {

    // Verify payment link exists and is active
    const paymentLink = await this.prisma.paymentLink.findUnique({
      where: { id: dto.paymentLinkId },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            quantity: true,
            isAvailable: true,
            merchantId: true,
          },
        },
      },
    });

    if (!paymentLink) {
      throw new NotFoundException('Payment link not found');
    }

    if (!paymentLink.isActive) {
      throw new BadRequestException('Payment link is not active');
    }

    // Check if payment link has expired
    if (paymentLink.expiresAt && paymentLink.expiresAt < new Date()) {
      throw new BadRequestException(
        'This payment link has expired. Please request a new link from the merchant.',
      );
    }

    if (!paymentLink.product.isAvailable) {
      throw new BadRequestException(
        'Sorry, this product is currently unavailable. Please contact the merchant for more information.',
      );
    }

    // Check product quantity if limited - must be > 0 to allow purchase
    if (paymentLink.product.quantity !== null && paymentLink.product.quantity <= 0) {
      // Mark as unavailable if not already
      if (paymentLink.product.isAvailable) {
        await this.prisma.product.update({
          where: { id: paymentLink.product.id },
          data: { isAvailable: false },
        });
      }
      throw new BadRequestException(
        'Sorry, this product is currently out of stock. Please check back later or contact the merchant.',
      );
    }

    // Generate unique external reference
    const externalReference = `PAYMO-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;

    // Force country and currency codes to ensure they're correct
    const countryCode = (dto.countryCode || 'CM').toString().trim().toUpperCase();
    const currencyCode = (dto.currencyCode || 'XAF').toString().trim().toUpperCase();

    // Prepare Mansa Transfers request
    const mansaRequest = {
      paymentMode: dto.paymentMode,
      phoneNumber: dto.customerPhone,
      transactionType: 'payin' as const,
      amount: paymentLink.product.price,
      fullName: dto.customerName,
      emailAddress: dto.customerEmail,
      currencyCode: currencyCode,
      countryCode: countryCode,
      externalReference,
    };

    // Initiate payment with Mansa Transfers
    try {
      const mansaResponse = await this.mansaService.initiatePayment(mansaRequest);
      
      // Check if response indicates success but missing reference
      if (mansaResponse.message && mansaResponse.message.toLowerCase().includes('success')) {
        // If message says success but no reference, generate one
        if (!mansaResponse.reference) {
          const tempReference = `MANSA-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;
          mansaResponse.reference = tempReference;
          mansaResponse.success = true;
        }
      }
      
      if (!mansaResponse.success || !mansaResponse.reference) {
        // Extract detailed error message from Mansa response
        let errorMessage = mansaResponse.message || 'Failed to initiate payment';
        
        if (mansaResponse.data) {
          const mansaError = mansaResponse.data.message || 
                           mansaResponse.data.error || 
                           mansaResponse.data.errorMessage;
          if (mansaError) {
            errorMessage = mansaError;
          }
        }
        
        throw new BadRequestException(errorMessage);
      }

      // CRITICAL: Check for duplicate transactions using multiple criteria
      // 1. Check by reference (idempotency key)
      const existingByReference = await this.prisma.transaction.findUnique({
        where: { reference: mansaResponse.reference },
        select: { 
          id: true, 
          reference: true, 
          status: true, 
          createdAt: true,
          paymentLinkId: true,
        },
      });

      // 2. Check for recent duplicate transactions with same paymentLinkId + customerEmail + customerPhone
      // This catches double-clicks or rapid retries that create different references
      const recentDuplicate = await this.prisma.transaction.findFirst({
        where: {
          paymentLinkId: dto.paymentLinkId,
          customerEmail: dto.customerEmail,
          customerPhone: dto.customerPhone,
          createdAt: {
            gte: new Date(Date.now() - 10000), // Last 10 seconds
          },
        },
        select: {
          id: true,
          reference: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Return existing transaction if found by reference
      if (existingByReference) {
        return {
          transactionId: existingByReference.id,
          reference: existingByReference.reference,
          status: existingByReference.status,
          amount: paymentLink.product.price,
          message: 'Payment already initiated. Please check the status.',
        };
      }

      // Return existing transaction if found by customer details (prevents double-clicks)
      if (recentDuplicate) {
        return {
          transactionId: recentDuplicate.id,
          reference: recentDuplicate.reference,
          status: recentDuplicate.status,
          amount: paymentLink.product.price,
          message: 'Payment already initiated. Please check the status.',
        };
      }

      // Create transaction record in database
      const transaction = await this.prisma.transaction.create({
        data: {
          paymentLinkId: dto.paymentLinkId,
          customerName: dto.customerName,
          customerEmail: dto.customerEmail,
          customerPhone: dto.customerPhone,
          amount: paymentLink.product.price,
          reference: mansaResponse.reference,
          status: 'PENDING',
        },
        include: {
          paymentLink: {
            include: {
              product: {
                select: {
                  title: true,
                  price: true,
                },
              },
            },
          },
        },
      });


      return {
        transactionId: transaction.id,
        reference: transaction.reference,
        status: transaction.status,
        amount: transaction.amount,
        message: 'Payment initiated successfully. Please complete the payment on your mobile device.',
      };
    } catch (error) {
      this.logger.error(
        `Error in payment initiation: ${error.message}`,
        error.stack,
      );
      // Re-throw BadRequestException as-is, wrap others
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        error.message || 'Failed to initiate payment. Please try again.',
      );
    }
  }

  /**
   * Check transaction status and update database
   */
  async checkTransactionStatus(reference: string) {
    const cacheKey = `transaction:status:${reference}`;
    
    // Try cache first (short TTL since status changes frequently)
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Find transaction by reference
    const transaction = await this.prisma.transaction.findUnique({
      where: { reference },
      include: {
        paymentLink: {
          include: {
            product: {
              select: {
                id: true,
                quantity: true,
                soldQuantity: true,
              },
            },
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }


    // If already completed, return current status
    if (transaction.status === 'SUCCESS' || transaction.status === 'FAILED') {
      const result = {
        reference: transaction.reference,
        status: transaction.status,
        amount: transaction.amount,
        completedAt: transaction.completedAt,
      };
      // Cache completed transactions for 5 minutes
      await this.redisService.set(cacheKey, result, 300);
      return result;
    }

    // TEST MODE: Simulate successful payment after 10 seconds for testing
    const mansaConfig = this.configService.get('mansa');
    const isTestMode = mansaConfig?.environment === 'test' || process.env.NODE_ENV !== 'production';
    
    if (isTestMode) {
      const timeSinceCreation = Date.now() - transaction.createdAt.getTime();
      const testSuccessDelay = 10000; // 10 seconds
      
      // If more than 10 seconds have passed, simulate success
      if (timeSinceCreation >= testSuccessDelay) {
        // Use finalizeSuccess to atomically transition PENDING -> SUCCESS and update inventory
        // This is idempotent - only one request will succeed even if multiple hit simultaneously
        const finalizeResult = await this.finalizeSuccess(transaction.id);
        
        // Send email notifications if payment was finalized
        if (finalizeResult.finalized && finalizeResult.transactionData) {
          this.sendPaymentEmails(finalizeResult.transactionData);
        }

        // Invalidate transaction status cache when status changes
        await this.redisService.del(`transaction:status:${reference}`);

        // Return the latest state
        const latest = await this.prisma.transaction.findUnique({
          where: { id: transaction.id },
          select: { 
            reference: true, 
            status: true, 
            amount: true, 
            completedAt: true 
          },
        });

        const statusResult = {
          reference: latest?.reference ?? reference,
          status: latest?.status ?? 'PENDING',
          amount: latest?.amount ?? transaction.amount,
          completedAt: latest?.completedAt ?? null,
        };
        // Cache result (5 minutes for completed, 30 seconds for pending)
        await this.redisService.set(cacheKey, statusResult, latest?.status === 'SUCCESS' ? 300 : 30);
        return statusResult;
      } else {
        // Still waiting for test delay
        const pendingResult = {
          reference: transaction.reference,
          status: 'PENDING',
          amount: transaction.amount,
          completedAt: null,
        };
        // Cache pending status for 10 seconds
        await this.redisService.set(cacheKey, pendingResult, 10);
        return pendingResult;
      }
    }

    // PRODUCTION MODE: Check status with Mansa Transfers
    // CRITICAL: Skip production check if transaction is already SUCCESS (prevents double processing)
    const currentStatus = transaction.status as string;
    if (currentStatus === 'SUCCESS') {
      const result = {
        reference: transaction.reference,
        status: transaction.status,
        amount: transaction.amount,
        completedAt: transaction.completedAt,
      };
      // Cache completed transactions for 5 minutes
      await this.redisService.set(cacheKey, result, 300);
      return result;
    }

    const statusResponse = await this.mansaService.checkTransactionStatus(
      reference,
    );

    if (!statusResponse.success) {
      this.logger.error(
        `Status check failed: ${statusResponse.message}`,
      );
      throw new BadRequestException(
        statusResponse.message || 'Failed to check transaction status',
      );
    }

    // If payment is successful, use finalizeSuccess to atomically update status and inventory
    // This is idempotent - only one request will succeed even if multiple hit simultaneously
    if (statusResponse.status === 'SUCCESS') {
      const finalizeResult = await this.finalizeSuccess(transaction.id);
      
      // Send email notifications if payment was finalized
      if (finalizeResult.finalized && finalizeResult.transactionData) {
        this.sendPaymentEmails(finalizeResult.transactionData);
      }

      // Invalidate transaction status cache when status changes
      await this.redisService.del(`transaction:status:${reference}`);
    } else {
      // For non-success statuses (FAILED, CANCELLED), just update the status
      // No inventory changes needed
      const updateData: any = {
        status: statusResponse.status || 'PENDING',
      };

      // If transaction is failed or cancelled, set completedAt
      if (
        statusResponse.status === 'FAILED' ||
        statusResponse.status === 'CANCELLED'
      ) {
        updateData.completedAt = new Date();
      }

      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: updateData,
      });
    }

    // Return the latest transaction state
    const latestTransaction = await this.prisma.transaction.findUnique({
      where: { id: transaction.id },
      select: {
        reference: true,
        status: true,
        amount: true,
        completedAt: true,
      },
    });

    const result = {
      reference: latestTransaction?.reference ?? reference,
      status: latestTransaction?.status ?? transaction.status,
      amount: latestTransaction?.amount ?? transaction.amount,
      completedAt: latestTransaction?.completedAt ?? null,
    };

    // Cache result (5 minutes for completed, 30 seconds for pending)
    const ttl = (latestTransaction?.status === 'SUCCESS' || latestTransaction?.status === 'FAILED') ? 300 : 30;
    await this.redisService.set(cacheKey, result, ttl);

    return result;
  }

  /**
   * Finalize a successful payment: atomically transition transaction from PENDING to SUCCESS
   * and update product inventory. This method is idempotent - only one call will succeed.
   * 
   * Uses updateMany with status condition to ensure only one request can finalize the transaction.
   * If multiple requests call this simultaneously, only one will update the status and inventory.
   * 
   * @param transactionId - The transaction ID to finalize
   * @returns { finalized: boolean } - true if this call finalized it, false if already finalized
   */
  private async finalizeSuccess(transactionId: string): Promise<{ finalized: boolean; transactionData?: any }> {
    return this.prisma.$transaction(async (tx) => {
      // 1) Atomic: change status only if still PENDING
      // This ensures only ONE request can transition from PENDING -> SUCCESS
      const updateResult = await tx.transaction.updateMany({
        where: { 
          id: transactionId, 
          status: 'PENDING', // CRITICAL: Only update if still PENDING
        },
        data: { 
          status: 'SUCCESS', 
          completedAt: new Date() 
        },
      });

      // If 0 rows updated, someone else already finalized it -> do nothing
      if (updateResult.count === 0) {
        return { finalized: false };
      }

      // 2) Load the transaction with product and merchant info inside the same transaction
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
        include: {
          paymentLink: {
            include: { 
              product: {
                include: {
                  merchant: {
                    select: {
                      id: true,
                      email: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!transaction) {
        throw new Error(`Transaction ${transactionId} missing after finalize`);
      }

      const productFromRelation = transaction.paymentLink.product;

      // CRITICAL: Re-fetch the product WITHIN the transaction to get the absolute latest state
      // The relation data might be stale if another transaction already updated the product
      const currentProductState = await tx.product.findUnique({
        where: { id: productFromRelation.id },
        select: {
          id: true,
          quantity: true,
          soldQuantity: true,
          isAvailable: true,
        },
      });

      if (!currentProductState) {
        throw new Error(`Product ${productFromRelation.id} not found`);
      }

      // 3) Update product atomically using FRESH state
      const updateData: any = {
        soldQuantity: {
          increment: 1,
        },
      };

      // Only reduce quantity if it's not unlimited (null)
      if (currentProductState.quantity !== null) {
        if (currentProductState.quantity <= 0) {
          // Quantity is already 0, mark as unavailable but don't decrement
          updateData.isAvailable = false;
        } else {
          updateData.quantity = {
            decrement: 1,
          };

          // If quantity will reach 0 after decrement, mark as unavailable
          if (currentProductState.quantity === 1) {
            updateData.isAvailable = false;
          }
        }
      }

      await tx.product.update({
        where: { id: currentProductState.id },
        data: updateData,
      });

      // Return transaction data for email sending (outside transaction for async email)
      return { 
        finalized: true,
        transactionData: {
          id: transaction.id,
          reference: transaction.reference,
          customerName: transaction.customerName,
          customerEmail: transaction.customerEmail,
          amount: transaction.amount,
          completedAt: transaction.completedAt || new Date(),
          product: {
            title: productFromRelation.title,
          },
          merchant: {
            email: transaction.paymentLink.product.merchant.email,
            firstName: transaction.paymentLink.product.merchant.firstName,
            lastName: transaction.paymentLink.product.merchant.lastName,
          },
        },
      };
    });
  }

  /**
   * Send email notifications after successful payment (non-blocking)
   */
  private async sendPaymentEmails(transactionData: any): Promise<void> {
    try {
      const merchantName = `${transactionData.merchant.firstName} ${transactionData.merchant.lastName}`;
      const customerName = transactionData.customerName;

      // Send email to customer (non-blocking)
      this.emailService
        .sendPaymentConfirmationEmail({
          customerEmail: transactionData.customerEmail,
          customerName,
          productTitle: transactionData.product.title,
          amount: transactionData.amount,
          reference: transactionData.reference,
          paymentDate: transactionData.completedAt,
          merchantName,
        })
        .catch((error) => {
          this.logger.error(`Failed to send customer email: ${error.message}`);
        });

      // Send email to merchant (non-blocking)
      this.emailService
        .sendMerchantNotificationEmail({
          merchantEmail: transactionData.merchant.email,
          merchantName,
          customerName,
          customerEmail: transactionData.customerEmail,
          productTitle: transactionData.product.title,
          amount: transactionData.amount,
          reference: transactionData.reference,
          paymentDate: transactionData.completedAt,
        })
        .catch((error) => {
          this.logger.error(`Failed to send merchant email: ${error.message}`);
        });
    } catch (error) {
      this.logger.error(`Error sending payment emails: ${error.message}`);
    }
  }

  /**
   * Get transaction by reference
   */
  async getTransactionByReference(reference: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { reference },
      include: {
        paymentLink: {
          include: {
            product: {
              select: {
                title: true,
                price: true,
                merchant: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }
}

