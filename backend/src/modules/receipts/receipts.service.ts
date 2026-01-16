import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Readable } from 'stream';

// PDFKit import - using require for compatibility
const PDFDocument = require('pdfkit');

/**
 * Receipt Data Interface
 */
export interface ReceiptData {
  merchantName: string;
  productTitle: string;
  productDescription: string | null;
  amountPaid: number;
  paymentReference: string;
  customerName: string;
  customerEmail: string;
  dateOfPayment: Date;
  currency?: string;
}

/**
 * PDF Design Constants
 */
const PDF_CONSTANTS = {
  PAGE_SIZE: 'A4',
  MARGINS: { top: 40, bottom: 40, left: 50, right: 50 },
  COLORS: {
    PRIMARY: '#1e40af', // Blue
    SUCCESS: '#059669', // Green
    TEXT_PRIMARY: '#111827',
    TEXT_SECONDARY: '#6b7280',
    TEXT_MUTED: '#9ca3af',
    BORDER: '#e5e7eb',
    BACKGROUND: '#f9fafb',
  },
  FONTS: {
    HEADING: 'Helvetica-Bold',
    BODY: 'Helvetica',
    MONO: 'Courier',
  },
  FONT_SIZES: {
    TITLE: 28,
    HEADING: 16,
    SUBHEADING: 14,
    BODY: 11,
    SMALL: 9,
  },
} as const;

/**
 * Receipts Service
 * Production-ready service for generating and managing payment receipts
 * 
 * Features:
 * - Optimized database queries with proper error handling
 * - Professional PDF generation with modern styling
 * - Memory-efficient streaming
 * - Comprehensive logging
 */
@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate PDF receipt for a successful transaction
   * @param transactionReference - Unique transaction reference
   * @returns PDF buffer as stream
   */
  async generateReceiptPDF(transactionReference: string): Promise<Readable> {
    try {

      // Fetch transaction data
      const receiptData = await this.fetchReceiptData(transactionReference);

      // Generate and return PDF stream
      return this.createPDFDocument(receiptData);
    } catch (error) {
      this.logger.error(
        `[Receipt] Error generating PDF: ${error.message}`,
        error.stack,
      );

      // Re-throw known exceptions
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // Wrap unknown errors
      throw new InternalServerErrorException(
        'Failed to generate receipt. Please try again later.',
      );
    }
  }

  /**
   * Fetch receipt data from database
   * Optimized query with proper error handling
   */
  private async fetchReceiptData(
    transactionReference: string,
  ): Promise<ReceiptData> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { reference: transactionReference },
      include: {
        paymentLink: {
          include: {
            product: {
              include: {
                merchant: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException(
        `Transaction with reference ${transactionReference} not found`,
      );
    }

    if (transaction.status !== 'SUCCESS') {
      throw new BadRequestException(
        `Receipt can only be generated for successful transactions. Current status: ${transaction.status}`,
      );
    }

    return {
      merchantName: `${transaction.paymentLink.product.merchant.firstName} ${transaction.paymentLink.product.merchant.lastName}`,
      productTitle: transaction.paymentLink.product.title,
      productDescription: transaction.paymentLink.product.description,
      amountPaid: transaction.amount,
      paymentReference: transaction.reference,
      customerName: transaction.customerName,
      customerEmail: transaction.customerEmail,
      dateOfPayment: transaction.completedAt || transaction.createdAt,
      currency: 'XAF',
    };
  }

  /**
   * Create PDF document with receipt information
   * Uses streaming for memory efficiency
   * @param data - Receipt data
   * @returns PDF stream
   */
  private createPDFDocument(data: ReceiptData): Readable {
    const doc = new PDFDocument({
      size: PDF_CONSTANTS.PAGE_SIZE,
      margins: PDF_CONSTANTS.MARGINS,
      info: {
        Title: `Receipt - ${data.paymentReference}`,
        Author: 'PayMo Payment Platform',
        Subject: 'Payment Receipt',
        Creator: 'PayMo',
      },
    });

    const stream = new Readable();
    stream._read = () => {}; // Required for Readable stream

    // Set up event handlers
    doc.on('data', (chunk: Buffer) => {
      stream.push(chunk);
    });

    doc.on('end', () => {
      stream.push(null);
    });

    doc.on('error', (error: Error) => {
      this.logger.error('[Receipt] PDF generation error:', error);
      stream.emit('error', error);
    });

    // Generate PDF content
    this.addReceiptContent(doc, data);

    // Finalize PDF
    doc.end();

    return stream;
  }

  /**
   * Add receipt content to PDF document with professional styling
   * @param doc - PDFKit document instance
   * @param data - Receipt data
   */
  private addReceiptContent(doc: any, data: ReceiptData): void {
    const pageWidth = doc.page.width;
    const marginLeft = PDF_CONSTANTS.MARGINS.left;
    const marginRight = PDF_CONSTANTS.MARGINS.right;
    const contentWidth = pageWidth - marginLeft - marginRight;
    const startY = PDF_CONSTANTS.MARGINS.top;

    // Header Section with colored background
    let currentY = this.addHeader(doc, data, startY, contentWidth, marginLeft);

    // Receipt Details Section
    currentY = this.addReceiptDetails(doc, data, currentY, contentWidth, marginLeft);

    // Information Sections
    currentY = this.addInformationSections(
      doc,
      data,
      currentY,
      contentWidth,
      marginLeft,
    );

    // Payment Summary Section (highlighted)
    currentY = this.addPaymentSummary(
      doc,
      data,
      currentY,
      contentWidth,
      marginLeft,
    );

    // Footer
    this.addFooter(doc, data, contentWidth, marginLeft);
  }

  /**
   * Add professional header with logo area and title
   */
  private addHeader(
    doc: any,
    data: ReceiptData,
    startY: number,
    width: number,
    leftMargin: number,
  ): number {
    // Header background box
    const headerHeight = 80;
    doc.rect(leftMargin, startY, width, headerHeight)
       .fillColor(PDF_CONSTANTS.COLORS.PRIMARY)
       .fill()
       .fillColor('#ffffff');

    // Title
    doc.fontSize(PDF_CONSTANTS.FONT_SIZES.TITLE)
       .font(PDF_CONSTANTS.FONTS.HEADING)
       .text('PAYMENT RECEIPT', leftMargin, startY + 20, {
         width: width,
         align: 'center',
         color: '#ffffff',
       });

    // Receipt number
    doc.fontSize(PDF_CONSTANTS.FONT_SIZES.SMALL)
       .font(PDF_CONSTANTS.FONTS.BODY)
       .text(`Receipt #${data.paymentReference}`, leftMargin, startY + 55, {
         width: width,
         align: 'center',
         color: '#e0e7ff',
       });

    // Reset fill color
    doc.fillColor(PDF_CONSTANTS.COLORS.TEXT_PRIMARY);

    return startY + headerHeight + 20;
  }

  /**
   * Add receipt details (date, status)
   */
  private addReceiptDetails(
    doc: any,
    data: ReceiptData,
    startY: number,
    width: number,
    leftMargin: number,
  ): number {
    const formattedDate = this.formatDate(data.dateOfPayment);
    
    doc.fontSize(PDF_CONSTANTS.FONT_SIZES.BODY)
       .font(PDF_CONSTANTS.FONTS.BODY)
       .fillColor(PDF_CONSTANTS.COLORS.TEXT_SECONDARY)
       .text(`Date: ${formattedDate}`, leftMargin, startY, {
         width: width,
         align: 'right',
       })
       .fillColor(PDF_CONSTANTS.COLORS.TEXT_PRIMARY);

    // Status badge
    const statusY = startY;
    const statusWidth = 80;
    const statusHeight = 20;
    doc.rect(leftMargin, statusY, statusWidth, statusHeight)
       .fillColor(PDF_CONSTANTS.COLORS.SUCCESS)
       .fill()
       .fillColor('#ffffff')
       .fontSize(PDF_CONSTANTS.FONT_SIZES.SMALL)
       .font(PDF_CONSTANTS.FONTS.HEADING)
       .text('PAID', leftMargin + 5, statusY + 5, {
         width: statusWidth - 10,
         align: 'center',
       })
       .fillColor(PDF_CONSTANTS.COLORS.TEXT_PRIMARY);

    return startY + 30;
  }

  /**
   * Add information sections (Merchant, Product, Customer)
   */
  private addInformationSections(
    doc: any,
    data: ReceiptData,
    startY: number,
    width: number,
    leftMargin: number,
  ): number {
    let currentY = startY;
    const sectionSpacing = 15;
    const boxPadding = 12;
    const boxMargin = 8;

    // Merchant Information Box
    currentY = this.addInfoBox(
      doc,
      'Merchant Information',
      [
        { label: 'Name', value: data.merchantName },
      ],
      currentY,
      width,
      leftMargin,
      boxPadding,
      boxMargin,
    );

    // Product Information Box
    currentY = this.addInfoBox(
      doc,
      'Product Information',
      [
        { label: 'Title', value: data.productTitle },
        ...(data.productDescription
          ? [{ label: 'Description', value: data.productDescription }]
          : []),
      ],
      currentY + sectionSpacing,
      width,
      leftMargin,
      boxPadding,
      boxMargin,
    );

    // Customer Information Box
    currentY = this.addInfoBox(
      doc,
      'Customer Information',
      [
        { label: 'Name', value: data.customerName },
        { label: 'Email', value: data.customerEmail },
      ],
      currentY + sectionSpacing,
      width,
      leftMargin,
      boxPadding,
      boxMargin,
    );

    return currentY + sectionSpacing;
  }

  /**
   * Add an information box with label-value pairs
   */
  private addInfoBox(
    doc: any,
    title: string,
    fields: Array<{ label: string; value: string }>,
    startY: number,
    width: number,
    leftMargin: number,
    padding: number,
    margin: number,
  ): number {
    const boxWidth = width - margin * 2;
    const boxX = leftMargin + margin;
    let boxHeight = 40; // Base height
    boxHeight += fields.length * 20; // Add height for each field

    // Box background
    doc.rect(boxX, startY, boxWidth, boxHeight)
       .fillColor(PDF_CONSTANTS.COLORS.BACKGROUND)
       .fill()
       .strokeColor(PDF_CONSTANTS.COLORS.BORDER)
       .lineWidth(1)
       .stroke();

    // Title
    doc.fontSize(PDF_CONSTANTS.FONT_SIZES.SUBHEADING)
       .font(PDF_CONSTANTS.FONTS.HEADING)
       .fillColor(PDF_CONSTANTS.COLORS.PRIMARY)
       .text(title, boxX + padding, startY + padding, {
         width: boxWidth - padding * 2,
       });

    // Fields
    let fieldY = startY + padding + 20;
    doc.fontSize(PDF_CONSTANTS.FONT_SIZES.BODY)
       .font(PDF_CONSTANTS.FONTS.BODY)
       .fillColor(PDF_CONSTANTS.COLORS.TEXT_PRIMARY);

    fields.forEach((field) => {
      // Label
      doc.font(PDF_CONSTANTS.FONTS.HEADING)
         .fillColor(PDF_CONSTANTS.COLORS.TEXT_SECONDARY)
         .text(`${field.label}:`, boxX + padding, fieldY, {
           width: 100,
         });

      // Value
      doc.font(PDF_CONSTANTS.FONTS.BODY)
         .fillColor(PDF_CONSTANTS.COLORS.TEXT_PRIMARY)
         .text(field.value, boxX + padding + 110, fieldY, {
           width: boxWidth - padding * 2 - 110,
         });

      fieldY += 20;
    });

    return startY + boxHeight;
  }

  /**
   * Add payment summary section (highlighted)
   */
  private addPaymentSummary(
    doc: any,
    data: ReceiptData,
    startY: number,
    width: number,
    leftMargin: number,
  ): number {
    const summaryHeight = 120;
    const summaryY = startY + 20;

    // Summary box with border
    doc.rect(leftMargin, summaryY, width, summaryHeight)
       .fillColor('#ffffff')
       .fill()
       .strokeColor(PDF_CONSTANTS.COLORS.PRIMARY)
       .lineWidth(2)
       .stroke();

    // Title
    doc.fontSize(PDF_CONSTANTS.FONT_SIZES.HEADING)
       .font(PDF_CONSTANTS.FONTS.HEADING)
       .fillColor(PDF_CONSTANTS.COLORS.PRIMARY)
       .text('Payment Summary', leftMargin, summaryY + 15, {
         width: width,
         align: 'center',
       });

    // Amount (large and prominent)
    const amountY = summaryY + 45;
    doc.fontSize(32)
       .font(PDF_CONSTANTS.FONTS.HEADING)
       .fillColor(PDF_CONSTANTS.COLORS.SUCCESS)
       .text(this.formatCurrency(data.amountPaid, data.currency), leftMargin, amountY, {
         width: width,
         align: 'center',
       });

    // Payment Reference
    doc.fontSize(PDF_CONSTANTS.FONT_SIZES.SMALL)
       .font(PDF_CONSTANTS.FONTS.MONO)
       .fillColor(PDF_CONSTANTS.COLORS.TEXT_SECONDARY)
       .text(`Reference: ${data.paymentReference}`, leftMargin, summaryY + 85, {
         width: width,
         align: 'center',
       });

    return summaryY + summaryHeight;
  }

  /**
   * Add footer with disclaimer
   */
  private addFooter(
    doc: any,
    data: ReceiptData,
    width: number,
    leftMargin: number,
  ): void {
    const pageHeight = 842; // A4 height in points
    const footerY = pageHeight - PDF_CONSTANTS.MARGINS.bottom - 40;

    // Divider line
    doc.moveTo(leftMargin, footerY)
       .lineTo(leftMargin + width, footerY)
       .strokeColor(PDF_CONSTANTS.COLORS.BORDER)
       .lineWidth(1)
       .stroke();

    // Footer text
    doc.fontSize(PDF_CONSTANTS.FONT_SIZES.SMALL)
       .font(PDF_CONSTANTS.FONTS.BODY)
       .fillColor(PDF_CONSTANTS.COLORS.TEXT_MUTED)
       .text('This is an official receipt for your payment.', leftMargin, footerY + 10, {
         width: width,
         align: 'center',
       })
       .text('Please keep this receipt for your records.', leftMargin, footerY + 25, {
         width: width,
         align: 'center',
       });
  }

  /**
   * Format date for display
   * @param date - Date object
   * @returns Formatted date string
   */
  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    }).format(date);
  }

  /**
   * Format currency for display
   * @param amount - Amount to format
   * @param currency - Currency code (default: XAF)
   * @returns Formatted currency string
   */
  private formatCurrency(amount: number, currency: string = 'XAF'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  /**
   * Get receipt data without generating PDF (for API responses)
   * @param transactionReference - Unique transaction reference
   * @returns Receipt data object
   */
  async getReceiptData(transactionReference: string): Promise<ReceiptData> {
    try {
      return await this.fetchReceiptData(transactionReference);
    } catch (error) {
      this.logger.error(
        `[Receipt] Error fetching receipt data: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
