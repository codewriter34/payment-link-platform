import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private configService: ConfigService) {
    // CRITICAL: Ensure DATABASE_URL is set in process.env before PrismaClient initialization
    // PrismaClient reads DATABASE_URL from process.env during super() call
    const dbUrl = configService.get<string>('database.url') || process.env.DATABASE_URL;
    
    if (dbUrl) {
      // Set it in process.env so Prisma can read it
      process.env.DATABASE_URL = dbUrl;
    }
    
    // Now PrismaClient will read DATABASE_URL from process.env
    super();
    
    // Log error after super() is called
    if (!dbUrl) {
      this.logger.error('DATABASE_URL is not set in .env file or ConfigService');
    }
  }

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (error: any) {
      this.logger.error(`Database connection failed: ${error.message}`);
      // Don't throw - let the app continue, but log the error
      // This allows the server to start even if DB is temporarily unavailable
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
