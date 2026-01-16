import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MansaTransfersService } from './mansa-transfers.service';

@Module({
  imports: [ConfigModule],
  providers: [MansaTransfersService],
  exports: [MansaTransfersService],
})
export class MansaTransfersModule {}

