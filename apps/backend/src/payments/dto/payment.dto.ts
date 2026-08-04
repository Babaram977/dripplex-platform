import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export enum PaymentProviderDtoEnum {
  PAYSTACK = 'PAYSTACK',
  FLUTTERWAVE = 'FLUTTERWAVE',
  OPAY = 'OPAY',
}

export class InitializePaymentDto {
  @IsOptional()
  @IsEnum(PaymentProviderDtoEnum)
  public provider?: PaymentProviderDtoEnum;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  public callbackUrl?: string;
}

export class VerifyPaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  public reference?: string;
}

export class WebhookRawBodyDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value)
  public payload?: unknown;
}
