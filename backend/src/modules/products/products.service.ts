import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { S3Service } from './s3.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { randomBytes } from 'crypto';

/**
 * Products Service - Production-ready business logic for product management
 *
 * Features:
 * - Product CRUD operations with validation
 * - AWS S3 image upload and management
 * - Merchant isolation (users only see their products)
 * - Comprehensive error handling and logging
 * - Statistics and analytics
 */
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
    private configService: ConfigService,
    private redisService: RedisService,
  ) {}

  /**
   * Creates a new product with optional image upload to S3
   * Validates data and ensures merchant ownership
   */
  async create(
    createProductDto: CreateProductDto,
    imageFile: Express.Multer.File,
    merchantId: string,
  ) {
    let imageUrl = '';

    // Handle optional image upload to AWS S3
    if (imageFile) {
      try {
        imageUrl = await this.s3Service.uploadFile(imageFile, 'products');
      } catch (error) {
        // Log detailed error information for production debugging
        this.logger.error(`❌ Product image upload failed: ${error.message}`, {
          error: error.message,
          code: error.code,
          name: error.name,
          statusCode: error.$metadata?.httpStatusCode,
          stack: error.stack
        });

        // Provide user-friendly error message while preserving technical details for logs
        throw new BadRequestException({
          message: 'Failed to upload product image. Please check your image file and try again.',
          details: error.message, // Technical details for debugging
        });
      }
    }

    // Create product in database
    const product = await this.prisma.product.create({
      data: {
        ...createProductDto,
        quantity: createProductDto.quantity || null, // Ensure null for unlimited
        imageUrl,
        merchantId,
      },
      include: {
        merchant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Invalidate merchant's product cache
    await this.redisService.invalidatePattern(`products:merchant:${merchantId}*`);
    await this.redisService.invalidatePattern(`stats:merchant:${merchantId}*`);

    return product;
  }

  /**
   * Test S3 upload functionality (development/debugging only)
   * @param file - Test file to upload
   * @returns Promise<string> - URL of uploaded test file
   */
  async testS3Upload(file: Express.Multer.File) {
    return this.s3Service.uploadFile(file, 'test');
  }

  /**
   * Generate a unique payment link for a product
   */
  async createPaymentLink(productId: string, merchantId: string) {
    // Verify product ownership
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        merchantId,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found or access denied');
    }

    // Generate unique short code (8 characters, URL-safe)
    let shortCode: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      shortCode = randomBytes(6).toString('base64url').slice(0, 8);
      attempts++;
    } while (
      attempts < maxAttempts &&
      await this.prisma.paymentLink.findUnique({ where: { shortCode } })
    );

    if (attempts >= maxAttempts) {
      throw new BadRequestException('Failed to generate unique payment link');
    }

    // Set expiration time: 6 hours
    // can change depending on the need
    const EXPIRATION_MINUTES = 360; // 6 hours
    const expiresAt = new Date(Date.now() + EXPIRATION_MINUTES * 60 * 1000);

    // Create payment link
    const paymentLink = await this.prisma.paymentLink.create({
      data: {
        shortCode,
        productId,
        expiresAt,
      },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            description: true,
            price: true,
            imageUrl: true,
            supportEmail: true,
            supportPhone: true,
          },
        },
      },
    });

    const frontendUrl = this.configService.get<string>('app.frontendUrl') || 'http://localhost:3001';
    
    return {
      ...paymentLink,
      url: `${frontendUrl}/pay/${shortCode}`,
    };
  }

  /**
   * Get payment link by short code (public access)
   */
  async getPaymentLinkByCode(shortCode: string): Promise<any> {
    try {
      if (!shortCode || shortCode.trim().length === 0) {
        throw new BadRequestException('Invalid payment link code');
      }

      // Try cache first
      const cacheKey = `payment-link:${shortCode.trim()}`;
      const cached = await this.redisService.get<any>(cacheKey);
      if (cached) {
        return cached;
      }

      const paymentLink = await this.prisma.paymentLink.findUnique({
        where: { shortCode: shortCode.trim() },
        include: {
          product: {
            select: {
              id: true,
              title: true,
              description: true,
              price: true,
              imageUrl: true,
              supportEmail: true,
              supportPhone: true,
              isAvailable: true,
              merchant: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
          transactions: {
            where: { status: 'SUCCESS' },
            select: { amount: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!paymentLink) {
        throw new NotFoundException('Payment link not found');
      }

      if (!paymentLink.isActive) {
        throw new NotFoundException('Payment link is no longer active');
      }

      // Check if payment link has expired
      if (paymentLink.expiresAt && paymentLink.expiresAt < new Date()) {
        throw new BadRequestException(
          'This payment link has expired. Please request a new link from the merchant.',
        );
      }

      // Check if product is still available
      if (!paymentLink.product.isAvailable) {
        throw new BadRequestException('This product is no longer available');
      }

      // Cache for 5 minutes (payment links are frequently accessed)
      await this.redisService.set(cacheKey, paymentLink, 300);
      
      return paymentLink;

    } catch (error) {
      this.logger.error(`Error in getPaymentLinkByCode for ${shortCode}:`, error);

      // Re-throw known errors
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      // Wrap unexpected errors
      throw new BadRequestException('Failed to load payment link. Please try again.');
    }
  }

  /**
   * Get all payment links for a merchant
   */
  async getPaymentLinks(merchantId: string) {
    return this.prisma.paymentLink.findMany({
      where: {
        product: {
          merchantId,
        },
      },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            imageUrl: true,
          },
        },
        _count: {
          select: {
            transactions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Deactivate a payment link
   */
  async deactivatePaymentLink(linkId: string, merchantId: string) {
    // Verify ownership through product relationship
    const paymentLink = await this.prisma.paymentLink.findFirst({
      where: {
        id: linkId,
        product: {
          merchantId,
        },
      },
    });

    if (!paymentLink) {
      throw new NotFoundException('Payment link not found or access denied');
    }

    return this.prisma.paymentLink.update({
      where: { id: linkId },
      data: { isActive: false },
    });
  }

  async findAll(merchantId: string) {
    const cacheKey = `products:merchant:${merchantId}`;
    
    // Try cache first
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const products = await this.prisma.product.findMany({
      where: { merchantId },
      include: {
        _count: {
          select: {
            paymentLinks: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Cache for 5 minutes
    await this.redisService.set(cacheKey, products, 300);

    return products;
  }

  async findOne(id: string, merchantId: string) {
    const cacheKey = `product:${id}:merchant:${merchantId}`;
    
    // Try cache first
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const product = await this.prisma.product.findFirst({
      where: {
        id,
        merchantId,
      },
      include: {
        merchant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        paymentLinks: {
          select: {
            id: true,
            shortCode: true,
            isActive: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            paymentLinks: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Cache for 5 minutes
    await this.redisService.set(cacheKey, product, 300);

    return product;
  }

  /**
   * Updates an existing product with new data and optional image
   * Handles image replacement in S3 and validates merchant ownership
   */
  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    merchantId: string,
    imageFile?: Express.Multer.File,
  ) {
    // Verify product exists and belongs to the requesting merchant
    const existingProduct = await this.prisma.product.findFirst({
      where: {
        id,
        merchantId,
      },
    });

    if (!existingProduct) {
      throw new NotFoundException('Product not found');
    }

    let imageUrl = existingProduct.imageUrl;

    // Handle image upload/replacement if new image provided
    if (imageFile) {
      try {
        // Clean up old image from S3 to avoid storage bloat
        if (existingProduct.imageUrl) {
          const oldKey = this.s3Service.extractKeyFromUrl(existingProduct.imageUrl);
          await this.s3Service.deleteFile(oldKey);
        }

        // Upload new image to S3 with organized folder structure
        imageUrl = await this.s3Service.uploadFile(imageFile, 'products');
      } catch (error) {
        throw new BadRequestException('Failed to upload product image');
      }
    }

    // Update product record with new data
    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...updateProductDto,
        quantity: updateProductDto.quantity || null, // Ensure null for unlimited
        // Only update imageUrl if it actually changed
        ...(imageUrl !== existingProduct.imageUrl && { imageUrl }),
      },
      include: {
        merchant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Invalidate caches
    await this.redisService.del(`product:${id}:merchant:${merchantId}`);
    await this.redisService.invalidatePattern(`products:merchant:${merchantId}*`);
    await this.redisService.invalidatePattern(`stats:merchant:${merchantId}*`);
    await this.redisService.invalidatePattern(`payment-link:*`);

    return product;
  }

  /**
   * Permanently deletes a product and its associated image
   * Ensures merchant ownership and handles S3 cleanup
   */
  async remove(id: string, merchantId: string) {
    // Verify product exists and belongs to merchant
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        merchantId,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Clean up associated image from S3 storage
    if (product.imageUrl) {
      try {
        const key = this.s3Service.extractKeyFromUrl(product.imageUrl);
        await this.s3Service.deleteFile(key);
      } catch (error) {
        // Log S3 deletion errors but don't fail the product deletion
      }
    }

    // Remove product record from database
    await this.prisma.product.delete({
      where: { id },
    });

    // Invalidate caches
    await this.redisService.del(`product:${id}:merchant:${merchantId}`);
    await this.redisService.invalidatePattern(`products:merchant:${merchantId}*`);
    await this.redisService.invalidatePattern(`stats:merchant:${merchantId}*`);
    await this.redisService.invalidatePattern(`payment-link:*`);

    return { message: 'Product deleted successfully' };
  }

  async getProductStats(merchantId: string) {
    const cacheKey = `stats:merchant:${merchantId}`;
    
    // Try cache first
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const [totalProducts, activeProducts, totalRevenue, totalSold] = await Promise.all([
        this.prisma.product.count({
          where: { merchantId },
        }),
        this.prisma.product.count({
          where: {
            merchantId,
            isAvailable: true,
          },
        }),
        this.prisma.transaction.aggregate({
          where: {
            paymentLink: {
              product: {
                merchantId,
              },
            },
            status: 'SUCCESS',
          },
          _sum: {
            amount: true,
          },
        }),
        this.prisma.product.aggregate({
          where: { merchantId },
          _sum: {
            soldQuantity: true,
          },
        }),
      ]);

      const stats = {
        totalProducts,
        activeProducts,
        totalRevenue: totalRevenue._sum.amount || 0,
        totalSold: totalSold._sum.soldQuantity || 0,
      };

      // Cache stats for 2 minutes (they change frequently)
      await this.redisService.set(cacheKey, stats, 120);

      return stats;
    } catch (error) {
      this.logger.error(`[Stats] Error fetching stats for merchant ${merchantId}:`, error);
      this.logger.error(`[Stats] Error details: ${error.message}`, error.stack);
      
      // Return default stats instead of throwing to prevent 500 errors
      return {
        totalProducts: 0,
        activeProducts: 0,
        totalRevenue: 0,
        totalSold: 0,
      };
    }
  }
}
