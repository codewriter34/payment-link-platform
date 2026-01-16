import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const emailConfig = this.configService.get('email');

    if (!emailConfig) {
      this.logger.warn('Email configuration not found. Email service will be disabled.');
      return;
    }

    const { host, port, secure, auth, from } = emailConfig;

    // Validate credentials
    if (!auth.user || !auth.pass) {
      this.logger.warn(
        'SMTP credentials not configured. Email service will be disabled. Please set SMTP_USER and SMTP_PASSWORD in your .env file.',
      );
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user: auth.user,
          pass: auth.pass,
        },
      });

      // Verify connection in development
      if (process.env.NODE_ENV === 'development') {
        this.transporter.verify((error) => {
          if (error) {
            this.logger.error(`SMTP connection error: ${error.message}`);
          } else {
          }
        });
      }
    } catch (error) {
      this.logger.error(`Failed to initialize email transporter: ${error.message}`);
      this.transporter = null;
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn('Email service not available. Skipping email send.');
      return false;
    }

    try {
      const emailConfig = this.configService.get('email');
      const fromEmail = emailConfig?.from?.email || emailConfig?.auth?.user;
      const fromName = emailConfig?.from?.name || 'PayMo';

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.htmlToText(options.html),
      };

      const info = await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Send payment confirmation email to customer
   */
  async sendPaymentConfirmationEmail(data: {
    customerEmail: string;
    customerName: string;
    productTitle: string;
    amount: number;
    reference: string;
    paymentDate: Date;
    merchantName: string;
  }): Promise<boolean> {
    const formattedAmount = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
    }).format(data.amount);

    const formattedDate = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(data.paymentDate);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payment Confirmation</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Payment Successful!</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
            <p style="font-size: 16px;">Dear ${data.customerName},</p>
            
            <p>Thank you for your purchase! Your payment has been successfully processed.</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
              <h2 style="margin-top: 0; color: #667eea;">Transaction Details</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Product:</td>
                  <td style="padding: 8px 0;">${data.productTitle}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Amount:</td>
                  <td style="padding: 8px 0; font-size: 18px; color: #667eea; font-weight: bold;">${formattedAmount}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Reference:</td>
                  <td style="padding: 8px 0; font-family: monospace;">${data.reference}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Date:</td>
                  <td style="padding: 8px 0;">${formattedDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Merchant:</td>
                  <td style="padding: 8px 0;">${data.merchantName}</td>
                </tr>
              </table>
            </div>
            
            <p style="margin-top: 30px;">This email serves as your payment confirmation. Please keep this for your records.</p>
            
            <p style="margin-top: 20px;">If you have any questions or concerns, please contact the merchant directly.</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 12px;">
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: data.customerEmail,
      subject: `Payment Confirmation - ${data.reference}`,
      html,
    });
  }

  /**
   * Send payment notification email to merchant
   */
  async sendMerchantNotificationEmail(data: {
    merchantEmail: string;
    merchantName: string;
    customerName: string;
    customerEmail: string;
    productTitle: string;
    amount: number;
    reference: string;
    paymentDate: Date;
  }): Promise<boolean> {
    const formattedAmount = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
    }).format(data.amount);

    const formattedDate = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(data.paymentDate);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Payment Received</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">New Payment Received!</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
            <p style="font-size: 16px;">Dear ${data.merchantName},</p>
            
            <p>You have received a new payment for your product.</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f5576c;">
              <h2 style="margin-top: 0; color: #f5576c;">Payment Details</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Product:</td>
                  <td style="padding: 8px 0;">${data.productTitle}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Amount:</td>
                  <td style="padding: 8px 0; font-size: 18px; color: #f5576c; font-weight: bold;">${formattedAmount}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Reference:</td>
                  <td style="padding: 8px 0; font-family: monospace;">${data.reference}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Date:</td>
                  <td style="padding: 8px 0;">${formattedDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Customer:</td>
                  <td style="padding: 8px 0;">${data.customerName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Customer Email:</td>
                  <td style="padding: 8px 0;">${data.customerEmail}</td>
                </tr>
              </table>
            </div>
            
            <p style="margin-top: 30px;">You can view all your transactions in your PayMo dashboard.</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 12px;">
              <p>This is an automated notification from PayMo.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: data.merchantEmail,
      subject: `New Payment Received - ${data.reference}`,
      html,
    });
  }

  /**
   * Convert HTML to plain text (simple implementation)
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

