import { KycDocumentType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

/** POST /kyc/me/submit -- same URL-string contract as `DriverKyc`, no upload backend exists. */
export class SubmitCustomerKycDto {
  @IsEnum(KycDocumentType)
  public documentType!: KycDocumentType;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  public documentNumber?: string;

  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  public frontImageUrl!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  public backImageUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  public selfieUrl?: string;
}
