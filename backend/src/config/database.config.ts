import { registerAs } from '@nestjs/config';

/**
 * Database Configuration
 * All sensitive credentials must be provided via environment variables
 * No hardcoded fallback values for security reasons
 */
export default registerAs('database', () => {
  const url = process.env.DATABASE_URL;
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '5432', 10);
  const username = process.env.DB_USERNAME || 'postgres';
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || 'paymo';
  const ssl = process.env.NODE_ENV === 'production';
  const maxConnections = parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10);

  // Validate required credentials in production
  if (process.env.NODE_ENV === 'production') {
    if (!url && (!host || !username || !password || !database)) {
      throw new Error(
        'Database configuration is incomplete. Please set DATABASE_URL or provide DB_HOST, DB_USERNAME, DB_PASSWORD, and DB_NAME in your environment variables.',
      );
    }
  }

  return {
    url: url || '', // Empty string if not set (will be validated in service)
    host,
    port,
    username,
    password: password || '', // Empty string if not set (will be validated in service)
    database,
    ssl,
    maxConnections,
  };
});
