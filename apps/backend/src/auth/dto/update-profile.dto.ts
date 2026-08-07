import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * PATCH /auth/me — DPX-PROFILE-KYC-001 founder decision (2026-08-07,
 * docs/DPX-PROFILE-KYC-001-DESIGN.md). Deliberately excludes `phone` and
 * `email` -- those are verification-gated and go through the dedicated
 * `/auth/me/phone/change` and `/auth/me/email/change` flows instead of a
 * silent PATCH. There is no `username` field: the founder decision was
 * explicit that DrippleX does not introduce one.
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[\p{L} '-]+$/u, {
    message: 'firstName may only contain letters, spaces, apostrophes, and hyphens',
  })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  public firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[\p{L} '-]+$/u, {
    message: 'lastName may only contain letters, spaces, apostrophes, and hyphens',
  })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  public lastName?: string;

  /**
   * Accepts a URL only, same contract as `DriverKyc.frontImage`/`backImage`
   * -- no file-upload/storage service exists in this backend today (see
   * DPX-FIGMA-DIFF-REGISTER.md). Not a place to invent an upload endpoint.
   */
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'profilePhotoUrl must be a valid URL' })
  @MaxLength(2048)
  public profilePhotoUrl?: string;

  @IsOptional()
  @IsDateString({}, { message: 'dateOfBirth must be an ISO 8601 date (YYYY-MM-DD)' })
  public dateOfBirth?: string;

  /**
   * Free-text, not a closed enum -- founder decision explicitly avoided
   * over-constraining this field (docs/DPX-PROFILE-KYC-001-DESIGN.md §1).
   */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  public gender?: string;
}
