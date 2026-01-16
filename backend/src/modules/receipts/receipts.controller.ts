import {
  Controller,
  Get,
  Param,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ReceiptsService } from './receipts.service';

/**
 * Receipts Controller
 * Handles receipt generation and download endpoints
 * 
 * Endpoints:
 * - GET /api/v1/receipts/:reference/download - Download PDF receipt (public)
 * - GET /api/v1/receipts/:reference - Get receipt data (public)
 */
@Controller('receipts')
export class ReceiptsController {
  private readonly logger = new Logger(ReceiptsController.name);

  constructor(private readonly receiptsService: ReceiptsService) {}

  /**
   * Download PDF receipt for a transaction
   * This is a public endpoint - anyone with the transaction reference can download
   * @param reference - Transaction reference
   * @param res - Express response object
   */
  @Get(':reference/download')
  @HttpCode(HttpStatus.OK)
  async downloadReceipt(
    @Param('reference') reference: string,
    @Res() res: Response,
  ) {
    // Validate reference parameter
    if (!reference || reference.trim().length === 0) {
      throw new BadRequestException('Transaction reference is required');
    }

    try {

      // Generate PDF stream
      const pdfStream = await this.receiptsService.generateReceiptPDF(
        reference.trim(),
      );

      // Set response headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="receipt-${reference.trim()}.pdf"`,
      );
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      // Pipe PDF stream to response
      pdfStream.pipe(res);

      // Handle stream errors
      pdfStream.on('error', (error: Error) => {
        this.logger.error(
          `[Receipt] Stream error: ${error.message}`,
          error.stack,
        );
        if (!res.headersSent) {
          res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Failed to generate receipt PDF',
            error: 'Internal Server Error',
          });
        }
      });
    } catch (error) {
      this.logger.error(
        `[Receipt] Download error: ${error.message}`,
        error.stack,
      );

      if (!res.headersSent) {
        const statusCode = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
        res.status(statusCode).json({
          statusCode,
          message: error.message || 'Failed to download receipt',
          error: error.error || 'Internal Server Error',
        });
      }
    }
  }

  /**
   * Get receipt data (JSON) for a transaction
   * This is a public endpoint - anyone with the transaction reference can view
   
   * @param reference - Transaction reference
   * @returns Receipt data object
   */
  @Get(':reference')
  @HttpCode(HttpStatus.OK)
  async getReceiptData(@Param('reference') reference: string) {
    // Validate reference parameter
    if (!reference || reference.trim().length === 0) {
      throw new BadRequestException('Transaction reference is required');
    }

    return this.receiptsService.getReceiptData(reference.trim());
  }
}

