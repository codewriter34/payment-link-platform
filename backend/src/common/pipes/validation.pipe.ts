import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe as BaseValidationPipe,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class ValidationPipe implements PipeTransform<any> {
  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    // Use plainToInstance with transform options to ensure Transform decorators run
    const object = plainToInstance(metatype, value, {
      enableImplicitConversion: true,
      excludeExtraneousValues: false,
    });
    
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: false,
    });

    if (errors.length > 0) {

      const formattedErrors = errors.map(error => ({
        field: error.property,
        constraints: error.constraints,
        value: error.value,
        children: error.children?.length ? 'Nested validation errors' : undefined,
      }));

      const errorMessages = errors.flatMap(error =>
        Object.values(error.constraints || {})
      );

      throw new BadRequestException({
        message: `Validation failed: ${errorMessages.join(', ')}`,
        errors: formattedErrors,
      });
    }

    return object;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}
