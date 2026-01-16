import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { PaymentLinksController } from './payment-links.controller';
import { S3Service } from './s3.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    MulterModule.register({
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
      fileFilter: (req, file, callback) => {
        // Allow only image files
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return callback(new Error('Only image files are allowed!'), false);
        }
        callback(null, true);
      },
    }),
  ],
  controllers: [ProductsController, PaymentLinksController],
  providers: [ProductsService, S3Service],
  exports: [ProductsService],
})
export class ProductsModule {}
