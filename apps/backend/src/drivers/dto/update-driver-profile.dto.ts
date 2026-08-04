import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Driver Slice 2 item 9 — Profile enhancements. Deliberately narrow: only
 * the fields the founder scoped as directly driver-editable. Email/phone
 * changes are out of scope here — no dedicated change-of-email/phone flow
 * exists anywhere in this codebase for any user type. */
export class UpdateDriverProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  public firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  public lastName?: string;

  /** Hosted-URL string — same convention as DriverKyc.frontImage. No
   * file-upload/storage endpoint exists anywhere in this backend. */
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  public avatarUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  public languagesSpoken?: string[];

  /** Free-text city/area names — no geo-boundary/zone model exists to
   * constrain this against. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  public preferredServiceAreas?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(80)
  public drivingExperienceYears?: number;
}
