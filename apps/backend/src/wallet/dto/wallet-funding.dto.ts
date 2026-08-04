import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum WalletFundingProviderDto {
  PAYSTACK = 'PAYSTACK',
  FLUTTERWAVE = 'FLUTTERWAVE',
  OPAY = 'OPAY',
}

export class FundWalletDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(100)
  @Max(1_000_000)
  public amount!: number;

  @IsOptional()
  @IsEnum(WalletFundingProviderDto)
  public provider?: WalletFundingProviderDto;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  public callbackUrl?: string;
}

export class VerifyWalletFundingDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  public reference?: string;
}
