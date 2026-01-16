import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  UsePipes,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ValidationPipe } from '../../common/pipes/validation.pipe';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('image'))
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() body: any,
    @UploadedFile() imageFile: Express.Multer.File,
    @CurrentUser('id') merchantId: string,
  ) {
    // Manually construct and validate DTO for multipart form data
    // Convert string values to appropriate types for validation
    const processedBody = {
      ...body,
      price: body.price ? parseFloat(body.price) : undefined,
      quantity: body.quantity ? parseInt(body.quantity) : undefined,
    };

    const createProductDto = plainToClass(CreateProductDto, processedBody);

    // Validate the DTO
    const errors = await validate(createProductDto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      const errorMessages = errors.flatMap(error =>
        Object.values(error.constraints || {})
      );
      throw new BadRequestException({
        message: `Validation failed: ${errorMessages.join(', ')}`,
        errors: errors.map(error => ({
          field: error.property,
          constraints: error.constraints,
          value: error.value,
        })),
      });
    }

    return this.productsService.create(createProductDto, imageFile, merchantId);
  }

  @Get('test-s3')
  async testS3() {
    try {
      // Create a test file buffer
      const testBuffer = Buffer.from('test image content');
      const testFile = {
        buffer: testBuffer,
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: testBuffer.length,
      } as Express.Multer.File;

      const result = await this.productsService.testS3Upload(testFile);
      return { success: true, result };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: {
          name: error.name,
          code: error.code,
          statusCode: error.$metadata?.httpStatusCode,
        }
      };
    }
  }

  @Get()
  async findAll(@CurrentUser('id') merchantId: string) {
    return this.productsService.findAll(merchantId);
  }

  @Get('stats')
  async getStats(@CurrentUser('id') merchantId: string) {
    return this.productsService.getProductStats(merchantId);
  }

  // Debug endpoint for testing
  @Get('test-link')
  async testLink() {
    return { message: 'Products endpoint is working', timestamp: new Date().toISOString() };
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser('id') merchantId: string,
  ) {
    return this.productsService.findOne(id, merchantId);
  }

  @Put(':id')
  @UseInterceptors(FileInterceptor('image'))
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @UploadedFile() imageFile: Express.Multer.File,
    @CurrentUser('id') merchantId: string,
  ) {
    return this.productsService.update(id, updateProductDto, merchantId, imageFile);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') merchantId: string,
  ) {
    return this.productsService.remove(id, merchantId);
  }
}
