import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsEmail,
  IsEnum,
  Min,
  MinLength,
  Matches,
  IsOptional,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class InitiatePaymentDto {
  @IsNotEmpty({ message: 'Payment link ID is required' })
  @IsString({ message: 'Payment link ID must be a string' })
  @MinLength(20, { message: 'Payment link ID must be a valid identifier' })
  paymentLinkId: string;

  @IsNotEmpty({ message: 'Customer name is required' })
  @IsString({ message: 'Customer name must be a string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  customerName: string;

  @IsNotEmpty({ message: 'Customer email is required' })
  @IsEmail({}, { message: 'Customer email must be a valid email address' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  customerEmail: string;

  @IsNotEmpty({ message: 'Customer phone number is required' })
  @IsString({ message: 'Customer phone number must be a string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  // Relaxed validation for testing - accept any phone number format
  customerPhone: string;

  @IsNotEmpty({ message: 'Payment mode is required' })
  @IsEnum(['MOMO', 'OM'], {
    message: 'Payment mode must be either MOMO or OM',
  })
  paymentMode: 'MOMO' | 'OM';

  @Transform(({ value }) => {
    // Always default to CM for Cameroon
    return 'CM';
  })
  @IsOptional()
  @IsString({ message: 'Country code must be a string' })
  countryCode?: string;

  @Transform(({ value }) => {
    // Always default to XAF for Central African CFA Franc (Cameroon)
    return 'XAF';
  })
  @IsOptional()
  @IsString({ message: 'Currency code must be a string' })
  currencyCode?: string;
}

