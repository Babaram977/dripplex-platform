import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';

export class RequestOtpDto {
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  public email!: string;
}

export class VerifyOtpDto {
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  public email!: string;

  @IsString()
  @Length(4, 8)
  @Matches(/^\d+$/, { message: 'otp must be numeric' })
  public otp!: string;
}
