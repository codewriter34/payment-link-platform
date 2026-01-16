import { Module } from '@nestjs/common';
import { ReceiptsController } from './receipts.controller';
import { ReceiptsService } from './receipts.service';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * Receipts Module
 * Handles receipt generation and download functionality
 */
@Module({
  imports: [PrismaModule],
  controllers: [ReceiptsController],
  providers: [ReceiptsService],
  exports: [ReceiptsService],
})
export class ReceiptsModule {}

