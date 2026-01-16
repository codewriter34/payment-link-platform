import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * AWS S3 Service for handling file uploads, downloads, and deletions
 * Production-ready with comprehensive error handling and logging
 */

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;

  /**
   * Initialize S3 service with AWS configuration
   * Performs validation and sets up S3 client for production use
   */
  constructor(private configService: ConfigService) {
    // Load AWS configuration with fallback to environment variables
    const awsConfig = this.configService.get('aws');
    this.region = awsConfig?.region || process.env.AWS_REGION || 'eu-north-1';
    this.bucketName = awsConfig?.s3Bucket || process.env.AWS_S3_BUCKET || 'paymo-product-images';

    // Validate required AWS credentials
    const accessKey = awsConfig?.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
    const secretKey = awsConfig?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;

    if (!accessKey || !secretKey) {
      const errorMsg = 'AWS credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your .env file.';
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    if (!this.bucketName) {
      const errorMsg = 'AWS S3 bucket name not configured. Please set AWS_S3_BUCKET in your .env file.';
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      // Initialize S3 client with proper configuration
      this.s3Client = new S3Client({
        region: this.region,
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
        },
        // Additional production settings
        maxAttempts: 3, // Retry failed requests
      });
    } catch (error) {
      this.logger.error(`Failed to initialize S3 client: ${error.message}`, error.stack);
      throw new Error(`S3 client initialization failed: ${error.message}`);
    }
  }

  /**
   * Upload a file to AWS S3 bucket with production-ready error handling
   * @param file - Multer file object containing buffer and metadata
   * @param folder 
   * @returns 
   * @throws Error with detailed message for various failure scenarios
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'products',
  ): Promise<string> {
    // Generate unique key to prevent filename conflicts and sanitize filename
    const timestamp = Date.now();
    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${folder}/${timestamp}-${sanitizedFilename}`;

    this.logger.debug(`Preparing to upload file: ${key} (${file.size} bytes)`);

    // Validate file buffer before upload attempt
    if (!file.buffer || file.buffer.length === 0) {
      const errorMsg = 'File buffer is empty or missing - file may not have been uploaded correctly';
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Validate file size (5MB limit for production)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      const errorMsg = `File size ${file.size} bytes exceeds maximum allowed size of ${maxSize} bytes`;
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      // Prepare S3 upload command with proper configuration
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        // Note: Public access should be configured via bucket policy for better security
        // ACL: 'public-read', // Commented out - use bucket policy instead
      });


      // Execute upload with built-in retry logic (configured in S3Client)
      const result = await this.s3Client.send(command);

      // Generate public URL for the uploaded file
      const publicUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;


      return publicUrl;

    } catch (error) {
      // Enhanced error logging for production debugging
      const errorDetails = {
        message: error.message,
        name: error.name,
        code: error.code || error.$metadata?.httpStatusCode,
        statusCode: error.$metadata?.httpStatusCode,
        requestId: error.$metadata?.requestId,
        region: this.region,
        bucket: this.bucketName,
        key: key,
      };

      this.logger.error(`❌ S3 upload failed: ${error.message}`, {
        ...errorDetails,
        stack: error.stack
      });

      // Provide user-friendly error messages based on AWS error codes
      if (error.code === 'NoSuchBucket') {
        throw new Error(`S3 bucket '${this.bucketName}' does not exist. Please create the bucket in AWS S3 or check the AWS_S3_BUCKET environment variable.`);
      }

      if (error.code === 'AccessDenied' || error.name === 'AccessDenied') {
        throw new Error('Access denied to S3 bucket. Please check your AWS IAM permissions include s3:PutObject for this bucket.');
      }

      if (error.code === 'PermanentRedirect' || error.name === 'PermanentRedirect') {
        throw new Error(`S3 bucket '${this.bucketName}' is not in region '${this.region}'. The bucket exists in a different region. Please check the AWS_REGION environment variable.`);
      }

      if (error.code === 'InvalidBucketName' || error.name === 'InvalidBucketName') {
        throw new Error(`Invalid S3 bucket name '${this.bucketName}'. Bucket names must be globally unique and follow AWS naming conventions.`);
      }

      if (error.code === 'NetworkingError' || error.name === 'NetworkingError') {
        throw new Error('Network error while connecting to S3. Please check your internet connection and AWS region configuration.');
      }

      // Generic error with additional context for unknown errors
      throw new Error(`Failed to upload file to S3: ${error.message}. Please check your AWS configuration and try again.`);
    }
  }

  /**
   * Delete a file from AWS S3 bucket
   * @param key - The S3 object key (path) of the file to delete
   * @throws Error if deletion fails
   */
  async deleteFile(key: string): Promise<void> {
    if (!key || key.trim().length === 0) {
      const errorMsg = 'File key is required for deletion';
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      this.logger.error(`❌ Failed to delete file ${key}: ${error.message}`, error.stack);

      if (error.code === 'NoSuchKey') {
        throw new Error(`File '${key}' does not exist in the S3 bucket`);
      }

      throw new Error(`Failed to delete file from S3: ${error.message}`);
    }
  }

  /**
   * Generate a signed URL for temporary access to a private S3 object
   * @param key - The S3 object key (path) of the file
   * @param expiresIn - URL expiration time in seconds (default: 1 hour)
   * @returns Promise<string> - Pre-signed URL for temporary access
   * @throws Error if URL generation fails
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (!key || key.trim().length === 0) {
      const errorMsg = 'File key is required for signed URL generation';
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    if (expiresIn < 1 || expiresIn > 604800) { // Max 7 days
      const errorMsg = 'Expiration time must be between 1 second and 7 days';
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      return signedUrl;
    } catch (error) {
      this.logger.error(`❌ Failed to generate signed URL for ${key}: ${error.message}`, error.stack);

      if (error.code === 'NoSuchKey') {
        throw new Error(`File '${key}' does not exist in the S3 bucket`);
      }

      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  /**
   * Extract the S3 object key from a full S3 URL
   * @param url - Full S3 URL (e.g., https://bucket.s3.region.amazonaws.com/folder/file.jpg)
   * @returns string - The object key (e.g., folder/file.jpg)
   * @throws Error if URL format is invalid
   */
  extractKeyFromUrl(url: string): string {
    if (!url || typeof url !== 'string') {
      throw new Error('Valid URL string is required');
    }

    try {
      // Handle both http and https URLs
      const urlObj = new URL(url);

      // Verify it's an S3 URL
      if (!urlObj.hostname.includes('s3.') || !urlObj.hostname.includes('amazonaws.com')) {
        throw new Error('URL is not a valid S3 URL');
      }

      // Extract the key from the pathname (remove leading slash)
      const key = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;

      if (!key) {
        throw new Error('URL does not contain a valid S3 object key');
      }

      return key;
    } catch (error) {
      this.logger.error(`Failed to extract key from URL ${url}: ${error.message}`);
      throw new Error(`Invalid S3 URL format: ${error.message}`);
    }
  }
}
