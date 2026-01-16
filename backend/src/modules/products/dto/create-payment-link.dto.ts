import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreatePaymentLinkDto {
  @IsNotEmpty({ message: 'Product ID is required' })
  @IsString({ message: 'Product ID must be a string' })
  @MinLength(20, { message: 'Product ID must be a valid identifier' })
  productId: string;
}

