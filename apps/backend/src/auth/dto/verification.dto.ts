import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches } from 'class-validator';

export class VerifyEmailDto {
  @IsEmail()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  public email!: string;

  @IsString()
  @Matches(/^\d{4,8}$/, { message: 'otp must be a numeric code' })
  public otp!: string;
}

export class VerifyPhoneDto {
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'phone must be a valid E.164-like number' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  public phone!: string;

  @IsString()
  @Matches(/^\d{4,8}$/, { message: 'otp must be a numeric code' })
  public otp!: string;
}
