import { IsString, Length, Matches } from 'class-validator';

/** POST /auth/me/phone/change — step 1 of the verification-gated phone change. */
export class RequestPhoneChangeDto {
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'newPhone must be a valid E.164-like number' })
  public newPhone!: string;
}

/** POST /auth/me/phone/change/confirm — step 2, applies the change only if the OTP matches. */
export class ConfirmPhoneChangeDto {
  @IsString()
  @Length(4, 8)
  @Matches(/^\d+$/, { message: 'otp must be numeric' })
  public otp!: string;
}
