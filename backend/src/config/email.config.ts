import { registerAs } from '@nestjs/config';

/**
 * Email configuration
 * All sensitive credentials must be provided via environment variables
 */
export default registerAs('email', () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true'; // true for 465, false for other ports
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const fromEmail = process.env.SMTP_FROM_EMAIL || user;
  const fromName = process.env.SMTP_FROM_NAME || 'PayMo';

  // Validate required credentials in production
  if (process.env.NODE_ENV === 'production') {
    if (!user) {
      throw new Error(
        'SMTP_USER is required in production. Please set it in your environment variables.',
      );
    }
    if (!password) {
      throw new Error(
        'SMTP_PASSWORD is required in production. Please set it in your environment variables.',
      );
    }
  }

  return {
    host,
    port,
    secure,
    auth: {
      user: user || '', // Empty string if not set (will be validated in service)
      pass: password || '', // Empty string if not set (will be validated in service)
    },
    from: {
      email: fromEmail || '',
      name: fromName,
    },
  };
});

