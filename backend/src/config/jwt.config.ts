import { registerAs } from '@nestjs/config';

/**
 * JWT Configuration
 * All sensitive secrets must be provided via environment variables
 * No hardcoded fallback values for security reasons
 */
export default registerAs('jwt', () => {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

  // Validate required secrets in production
  if (process.env.NODE_ENV === 'production') {
    if (!secret) {
      throw new Error(
        'JWT_SECRET is required in production. Please set it in your environment variables.',
      );
    }
    if (!refreshSecret) {
      throw new Error(
        'JWT_REFRESH_SECRET is required in production. Please set it in your environment variables.',
      );
    }
  }

  return {
    secret: secret || '', // Empty string if not set (will be validated in service)
    expiresIn,
    refreshSecret: refreshSecret || '', // Empty string if not set (will be validated in service)
    refreshExpiresIn,
    issuer: 'paymo-api',
    audience: 'paymo-clients',
  };
});
