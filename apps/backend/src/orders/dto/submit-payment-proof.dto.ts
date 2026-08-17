import { IsNumber, IsOptional, IsPositive, IsString, IsUrl, MaxLength } from 'class-validator';

/**
 * DPX-ORDER-PROOF-001 — a customer filing their bank receipt for a
 * MERCHANT_DIRECT order.
 *
 * Only `receiptUrl` is required. Reference, amount and note are all optional
 * because the goal is that a customer who has genuinely paid can always put
 * something on file — demanding a reference they cannot find off the bank app
 * would just stop them submitting the screenshot they do have.
 */
export class SubmitPaymentProofDto {
  /** Key returned by the signed-upload flow; must be under this customer's own
   *  `payment-proofs/` prefix, which the service asserts. */
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  public receiptUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  public reference?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  public amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  public note?: string;
}
