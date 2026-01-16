import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Initiate a payment transaction (PUBLIC - no auth required)
   * Rate limited: 10 requests per minute per IP
   */
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('initiate')
  @HttpCode(HttpStatus.OK)
  async initiatePayment(@Body() dto: InitiatePaymentDto) {
    try {
      return await this.paymentsService.initiatePayment(dto);
    } catch (error) {
      this.logger.error(
        `Payment initiation failed for link ${dto.paymentLinkId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Check transaction status by reference
   * Rate limited: 30 requests per minute per IP
   */
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get('status')
  async checkStatus(@Query('reference') reference: string) {
    if (!reference) {
      throw new BadRequestException('Reference parameter is required');
    }
    return this.paymentsService.checkTransactionStatus(reference);
  }

  /**
   * Get transaction details by reference
   * Rate limited: 30 requests per minute per IP
   */
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get('transaction')
  async getTransaction(@Query('reference') reference: string) {
    if (!reference) {
      throw new BadRequestException('Reference parameter is required');
    }
    return this.paymentsService.getTransactionByReference(reference);
  }
}

