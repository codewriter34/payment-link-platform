import {
  IsOptional,
  IsString,
  IsNumber,
  IsPositive,
  Min,
  MaxLength,
  IsBoolean,
} from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Min(0.01)
  price?: number;

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

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
