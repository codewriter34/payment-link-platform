/**
 * Legacy Configuration (for backward compatibility)
 * Note: This file is deprecated. Use individual config files in config/ directory instead.
 * All sensitive values must be provided via environment variables.
 */
export default () => {
  const databaseUrl = process.env.DATABASE_URL;
  const jwtSecret = process.env.JWT_SECRET;

  // Validate required values in production
  if (process.env.NODE_ENV === 'production') {
    if (!databaseUrl) {
      throw new Error(
        'DATABASE_URL is required in production. Please set it in your environment variables.',
      );
    }
    if (!jwtSecret) {
      throw new Error(
        'JWT_SECRET is required in production. Please set it in your environment variables.',
      );
    }
  }

  return {
    database: {
      url: databaseUrl || '', // Empty string if not set (will be validated in service)
    },
    jwt: {
      secret: jwtSecret || '', // Empty string if not set (will be validated in service)
      expiresIn: '24h',
    },
    frontend: {
      url: process.env.FRONTEND_URL || 'http://localhost:3001',
    },
    port: parseInt(process.env.PORT || '3002', 10),
  };
};
