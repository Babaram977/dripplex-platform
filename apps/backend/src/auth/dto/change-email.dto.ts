import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';

/** POST /auth/me/email/change — step 1 of the verification-gated email change. */
export class RequestEmailChangeDto {
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  public newEmail!: string;
}

/** POST /auth/me/email/change/confirm — step 2, applies the change only if the OTP matches. */
export class ConfirmEmailChangeDto {
  @IsString()
  @Length(4, 8)
  @Matches(/^\d+$/, { message: 'otp must be numeric' })
  public otp!: string;
}
