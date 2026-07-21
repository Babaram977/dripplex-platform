import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  registerDecorator,
  type ValidationOptions,
} from 'class-validator';

function HasLoginIdentifier(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'hasLoginIdentifier',
      target: object.constructor,
      propertyName,
      ...(validationOptions !== undefined ? { options: validationOptions } : {}),
      validator: {
        validate(_value: unknown, validationArguments) {
          const dto = validationArguments?.object as PortalLoginDto;
          const hasEmail = typeof dto.email === 'string' && dto.email.length > 0;
          const hasPhone = typeof dto.phone === 'string' && dto.phone.length > 0;
          return hasEmail || hasPhone;
        },
        defaultMessage() {
          return 'Either email or phone is required';
        },
      },
    });
  };
}

export class PortalLoginDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  public email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'phone must be a valid E.164-like number' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  public phone?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @HasLoginIdentifier()
  public password!: string;
}
