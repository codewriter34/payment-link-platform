import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsPositive,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateProductDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  @Min(0.01)
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number; // null = unlimited

  @IsOptional()
  @IsString()
  @MaxLength(255)
  supportEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  supportPhone?: string;
}
