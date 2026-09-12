import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * The largest stock batch accepted in one request. Matches the catalogue
 * batch ceiling: a POS that pages one catalogue can page the other.
 */
export const MAX_INVENTORY_BATCH_ITEMS = 500;

/** One SKU's stock level as an external POS reports it. */
export class UpdateInventoryItemDto {
  /**
   * The POS's own SKU. Resolved through `ProductSync`, which is unique on
   * `(integrationId, externalSku)`. A SKU this integration has never
   * catalogued is rejected rather than created — a stock count carries no
   * price, name or category, so there is nothing to create a product from.
   */
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  public readonly externalSku!: string;

  /**
   * Absolute unit count, not a delta. Written to `ProductInventory.quantity`
   * only — `reserved` belongs to DrippleX carts and in-flight orders and is
   * never written from a POS payload.
   *
   * Deliberately **not** `@Min(0)`. Contract §6 rules that a negative quantity
   * is clamped to zero and raises a `NEGATIVE_QUANTITY` conflict the merchant
   * can see; rejecting it at the validation layer would throw that signal away
   * and tell the POS only that its whole batch was malformed.
   */
  @IsInt()
  public readonly quantity!: number;
}

/**
 * A stock batch pushed by an external POS.
 *
 * The batch's idempotency key travels in the `Idempotency-Key` header rather
 * than the body, as MKT-INT-001-J specifies. Each item is stored under its own
 * key derived from it, because `InventoryUpdate.idempotencyKey` is unique per
 * row.
 */
export class UpdateInventoryDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_INVENTORY_BATCH_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => UpdateInventoryItemDto)
  public readonly items!: UpdateInventoryItemDto[];
}
