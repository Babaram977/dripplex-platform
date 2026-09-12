import { BadRequestException } from '@nestjs/common';

/** The header a POS carries its idempotency key in (MKT-INT-001-J and -L). */
export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

/**
 * The widest key the storage columns take: `InventoryUpdate.idempotencyKey`
 * and `OrderStatusUpdate.idempotencyKey` are both VarChar(100).
 */
export const MAX_IDEMPOTENCY_KEY_LENGTH = 100;

/**
 * Read the header, or refuse the request.
 *
 * Required, not optional, on every POS write. Without a key a retry after a
 * timeout is a second distinct operation — and a timeout is precisely the case
 * a POS retries in, so an optional key would be absent exactly when it matters.
 *
 * Shared by the inventory and order routes so the two cannot drift into
 * different rules about what a valid key is.
 */
export function requireIdempotencyKey(value: string | undefined): string {
  const key = (value ?? '').trim();
  if (key === '') {
    throw new BadRequestException('Idempotency-Key header is required');
  }
  if (key.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    throw new BadRequestException(
      `Idempotency-Key header must be at most ${String(MAX_IDEMPOTENCY_KEY_LENGTH)} characters`,
    );
  }
  return key;
}
