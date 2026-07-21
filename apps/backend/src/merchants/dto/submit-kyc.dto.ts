import { KycDocumentType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class SubmitKycDto {
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

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  public selfieImage?: string;
}
