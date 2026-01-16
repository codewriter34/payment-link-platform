import { registerAs } from '@nestjs/config';

/**
 * Mansa Transfers API Configuration
 * All sensitive credentials must be provided via environment variables
 * No hardcoded fallback values for security reasons
 */
export default registerAs('mansa', () => {
  const baseUrl = process.env.MANSA_BASE_URL || 'https://api-stage.mansatransfers.com';
  const clientKey = process.env.MANSA_CLIENT_KEY;
  const clientSecret = process.env.MANSA_CLIENT_SECRET;
  const environment = process.env.MANSA_ENVIRONMENT || 'test';

  // Validate required credentials (only in production or when explicitly set)
  if (process.env.NODE_ENV === 'production') {
    if (!clientKey) {
      throw new Error(
        'MANSA_CLIENT_KEY is required in production. Please set it in your environment variables.',
      );
    }
    if (!clientSecret) {
      throw new Error(
        'MANSA_CLIENT_SECRET is required in production. Please set it in your environment variables.',
      );
    }
  }

  return {
    baseUrl,
    clientKey: clientKey || '', // Empty string if not set (will be validated in service)
    clientSecret: clientSecret || '', // Empty string if not set (will be validated in service)
    environment, // 'test' or 'production'
  };
});

