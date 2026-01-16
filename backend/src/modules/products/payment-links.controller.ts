import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProductsService } from './products.service';
import { CreatePaymentLinkDto } from './dto/create-payment-link.dto';

@Controller('links')
export class PaymentLinksController {
  private readonly logger = new Logger(PaymentLinksController.name);

  constructor(private readonly productsService: ProductsService) {}

  /**
   * Public payment link access (no auth required)
   * Rate limited to prevent abuse: 30 requests per minute per IP
   */
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute
  @Get(':shortCode')
  async getPaymentLinkByCode(@Param('shortCode') shortCode: string) {
    if (!shortCode || shortCode.trim().length === 0) {
      throw new BadRequestException('Payment link code is required');
    }

    try {
      return await this.productsService.getPaymentLinkByCode(shortCode.trim());
    } catch (error) {
      // Re-throw known exceptions as-is
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      // Wrap unexpected errors
      throw new BadRequestException('Failed to load payment link. Please check the link and try again.');
    }
  }

  /**
   * Create a new payment link for a product (JWT protected)
   * Rate limited: 20 requests per minute per user
   */
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  @Post()
  async createPaymentLink(
    @Body() createPaymentLinkDto: CreatePaymentLinkDto,
    @CurrentUser('id') merchantId: string,
  ) {
    return this.productsService.createPaymentLink(createPaymentLinkDto.productId, merchantId);
  }

  /**
   * Get all payment links for merchant (JWT protected)
   * Rate limited: 30 requests per minute per user
   */
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute
  @Get()
  async getPaymentLinks(@CurrentUser('id') merchantId: string) {
    return this.productsService.getPaymentLinks(merchantId);
  }

  /**
   * Deactivate a payment link (JWT protected)
   * Rate limited: 10 requests per minute per user
   */
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @Put('deactivate/:id')
  async deactivatePaymentLink(
    @Param('id') linkId: string,
    @CurrentUser('id') merchantId: string,
  ) {
    return this.productsService.deactivatePaymentLink(linkId, merchantId);
  }
}
