import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { MansaTransfersModule } from '../integrations/mansatransfers/mansa-transfers.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [ConfigModule, PrismaModule, MansaTransfersModule, EmailModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}

