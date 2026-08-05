import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export enum PaymentProviderDtoEnum {
  PAYSTACK = 'PAYSTACK',
  FLUTTERWAVE = 'FLUTTERWAVE',
  OPAY = 'OPAY',
}

/** How the customer chose to pay — the three gateways plus WALLET/CASH/
 * MERCHANT_DIRECT, mirroring the Prisma OrderPaymentMethod enum. Kept
 * distinct from PaymentProviderDtoEnum (see PaymentService.resolveMethod())
 * since WALLET/CASH/MERCHANT_DIRECT never reach a PaymentProviderAdapter. */
export enum OrderPaymentMethodDtoEnum {
  PAYSTACK = 'PAYSTACK',
  FLUTTERWAVE = 'FLUTTERWAVE',
  OPAY = 'OPAY',
  WALLET = 'WALLET',
  CASH = 'CASH',
  MERCHANT_DIRECT = 'MERCHANT_DIRECT',
}

export class InitializePaymentDto {
  @IsOptional()
  @IsEnum(OrderPaymentMethodDtoEnum)
  public provider?: OrderPaymentMethodDtoEnum;

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
