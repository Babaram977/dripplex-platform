import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * The largest batch accepted in one request. A POS with more items pages
 * through several batches, each with its own idempotency key, rather than
 * holding one enormous request open.
 */
export const MAX_CATALOGUE_BATCH_ITEMS = 500;

/**
 * One product as an external POS describes it.
 *
 * Every field is validated here so a malformed item is rejected before it can
 * reach the database. Per the contract, a rejected item does NOT fail the
 * batch — see `CatalogueIngestionService`, which records it and continues.
 */
export class IngestCatalogueItemDto {
  /**
   * The POS's own SKU. This is the identity anchor: `ProductSync` is unique on
   * `(integrationId, externalSku)`. It is NOT written to `Product.sku`, which
   * is nullable and non-unique and does not identify anything in DrippleX.
   */
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  public readonly externalSku!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  public readonly name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  public readonly description?: string;

  /**
   * Price in major units. Validated as a number with at most two decimal
   * places; the service rejects anything finer rather than rounding, because
   * rounding money the merchant did not ask to round is a decision, not a
   * normalisation.
   */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  public readonly price!: number;

  /**
   * ISO-4217 code. Only NGN is accepted — DrippleX has no FX source, so a
   * converted price would be a mispriced sale. Anything else is rejected with
   * a CURRENCY_UNSUPPORTED conflict.
   */
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  public readonly currency?: string;

  /**
   * Absolute unit count, not a delta. Applied to `ProductInventory.quantity`
   * only — `reserved` belongs to DrippleX carts and in-flight orders and is
   * never written from a POS payload.
   */
  @IsOptional()
  @IsInt()
  public readonly quantity?: number;

  /**
   * The POS's category name, resolved through `CategoryMapping`. An unmapped
   * name leaves the product uncategorised and raises a conflict; it never
   * creates a DrippleX Category, whose slug is globally unique.
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  public readonly categoryName?: string;

  /**
   * Whether the item is listed at the POS. `false` archives the DrippleX
   * product. Absent means "unchanged".
   */
  @IsOptional()
  @IsBoolean()
  public readonly active?: boolean;

  /** The POS-side catalogue or branch this item belongs to, for reporting. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  public readonly externalCatalogId?: string;
}

/**
 * A catalogue batch pushed by an external POS.
 *
 * Push-only for Phase 1 (decision #5): DrippleX does not poll. The merchant's
 * POS decides when its catalogue moves, so there is no scheduler and no
 * outbound credential in play.
 */
export class IngestCatalogueDto {
  /**
   * Idempotency key for this batch. Replaying a key already seen for this
   * integration returns the original job untouched instead of re-applying it.
   */
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  public readonly idempotencyKey!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_CATALOGUE_BATCH_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => IngestCatalogueItemDto)
  public readonly items!: IngestCatalogueItemDto[];
}
