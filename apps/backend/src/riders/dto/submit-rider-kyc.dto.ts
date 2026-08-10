import { KycDocumentType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

/**
 * DPX-RIDER-002 — self-service rider KYC document submission. Mirrors
 * SubmitDriverKycDto; image fields are hosted-URL strings uploaded first via
 * the signed-upload flow (POST /uploads/sign → PUT to object storage).
 */
export class SubmitRiderKycDto {
  @IsEnum(KycDocumentType)
  public documentType!: KycDocumentType;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  public documentNumber!: string;

  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  public frontImage!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  public backImage?: string;
}
