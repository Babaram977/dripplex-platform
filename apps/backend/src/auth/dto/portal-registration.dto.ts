import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

// DPX — email is a required, persistent identifier on every registration
// (customer, merchant, driver, rider), so it is `@IsEmail()` (not optional) on
// all portal DTOs. Phone remains portal-specific: optional for merchants,
// required for drivers/riders.
export class PortalRegistrationDto {
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  public email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'password must include upper, lower, and numeric characters',
  })
  public password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  public firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  public lastName!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'phone must be a valid E.164-like number' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  public phone?: string;

  /**
   * A standing referral code, a driver campaign code, or a campaign promoter
   * token — one field, resolved in that order of precedence by the referral
   * resolver (DPX-PROMO-REF-001, founder ruling).
   *
   * The ceiling is 32 rather than 16 because a campaign token is 32 characters.
   * It was 16, which rejected every campaign token with a 422 before any
   * service saw it — the field that was supposed to carry them could not.
   * Widening admits the new class without adding a second customer-facing
   * field; existing 8-character codes are unaffected.
   */
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  @Matches(/^[A-Za-z0-9]+$/, { message: 'referralCode must be alphanumeric' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  public referralCode?: string;
}

export class RiderDriverRegistrationDto {
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  public email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'password must include upper, lower, and numeric characters',
  })
  public password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  public firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  public lastName!: string;

  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'phone must be a valid E.164-like number' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  public phone!: string;
}
