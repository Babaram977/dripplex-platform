import { IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

/**
 * The credit limit DrippleX and one partner have agreed.
 *
 * `creditLimit: null` clears the agreement and returns the partner to the
 * owner-type default — an explicit null rather than an omitted field, so
 * "we agreed nothing" can never be confused with "the field was left out".
 */
export class NegotiateCreditLimitDto {
  @ValidateIf((dto: NegotiateCreditLimitDto) => dto.creditLimit !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  public creditLimit!: number | null;

  /** What was agreed, and with whom. Free text — this is a commercial note,
   * not a structured contract. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  public note?: string;
}
