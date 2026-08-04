import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Selfie/ID images travel as base64 data URIs (camera-captured, not
 * pre-uploaded) — Smile ID's real `submit_job` API accepts base64 image
 * data in `image_links` despite the field name. */
export class SubmitIdentityVerificationDto {
  @IsString()
  @MinLength(100)
  public selfieImageBase64!: string;

  @IsOptional()
  @IsString()
  @MinLength(100)
  public idDocumentImageBase64?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  public idNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  public deviceId?: string;

  @IsOptional()
  @IsLatitude()
  public latitude?: number;

  @IsOptional()
  @IsLongitude()
  public longitude?: number;
}
