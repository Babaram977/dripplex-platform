import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SendVerificationDto {
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  public email!: string;
}

export class VerifyEmailTokenDto {
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  public email!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(200)
  public token!: string;
}

export class SendOtpDto {
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'phone must be a valid E.164-like number' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  public phone!: string;
}

export class VerifyPhoneOtpDto {
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'phone must be a valid E.164-like number' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  public phone!: string;

  @IsString()
  @Matches(/^\d{4,8}$/, { message: 'otp must be a numeric code' })
  public otp!: string;
}
