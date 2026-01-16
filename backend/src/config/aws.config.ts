import { registerAs } from '@nestjs/config';

/**
 * AWS S3 Configuration
 * All sensitive credentials must be provided via environment variables
 * No hardcoded fallback values for security reasons
 */
export default registerAs('aws', () => {
  const region = process.env.AWS_REGION || 'eu-north-1'; // Default region
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const s3Bucket = process.env.AWS_S3_BUCKET || 'paymo-product-images';

  // Validate required credentials in production
  if (process.env.NODE_ENV === 'production') {
    if (!accessKeyId) {
      throw new Error(
        'AWS_ACCESS_KEY_ID is required in production. Please set it in your environment variables.',
      );
    }
    if (!secretAccessKey) {
      throw new Error(
        'AWS_SECRET_ACCESS_KEY is required in production. Please set it in your environment variables.',
      );
    }
    if (!s3Bucket) {
      throw new Error(
        'AWS_S3_BUCKET is required in production. Please set it in your environment variables.',
      );
    }
  }

  return {
    region,
    accessKeyId: accessKeyId || '', // Empty string if not set (will be validated in service)
    secretAccessKey: secretAccessKey || '', // Empty string if not set (will be validated in service)
    s3Bucket,
  };
});
