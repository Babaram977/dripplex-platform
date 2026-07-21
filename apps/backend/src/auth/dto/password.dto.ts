import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  public email!: string;
}

export class ResetPasswordDto {
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  public email!: string;

  @IsString()
  @MinLength(32)
  @MaxLength(128)
  public resetToken!: string;

  @IsString()
  @Matches(/^\d{4,8}$/, { message: 'otp must be a numeric code' })
  public otp!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  public password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  public currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  public newPassword!: string;
}
