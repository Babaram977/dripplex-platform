import type { RideDto } from '@dripplex/types';

/**
 * UI-facing composite ride state. NOT a backend contract — RideStatus and
 * RidePaymentStatus are the only fields the backend actually agrees on (see
 * docs/RIDE-003-INTEGRATION-MAP.md section 2). "assigned" covers both
 * "driver assigned" and "driver en route" since the backend has no distinct
 * status for the latter; "settled" is COMPLETED + paymentStatus === 'PAID'.
 */
export type RideUiState =
  | { phase: 'idle' }
  | { phase: 'searching'; ride: RideDto }
  | { phase: 'assigned'; ride: RideDto }
  | { phase: 'arrived'; ride: RideDto }
  | { phase: 'in_progress'; ride: RideDto }
  | { phase: 'awaiting_payment'; ride: RideDto }
  | { phase: 'settled'; ride: RideDto }
  | { phase: 'cancelled'; ride: RideDto }
  | { phase: 'no_drivers_found'; ride: RideDto };

export function toRideUiState(ride: RideDto | null | undefined): RideUiState {
  if (!ride) {
    return { phase: 'idle' };
  }

  switch (ride.status) {
    case 'SEARCHING':
    case 'REQUESTED':
      return { phase: 'searching', ride };
    case 'DRIVER_ASSIGNED':
      return { phase: 'assigned', ride };
    case 'ARRIVED':
      return { phase: 'arrived', ride };
    case 'IN_PROGRESS':
      return { phase: 'in_progress', ride };
    case 'COMPLETED':
      return ride.paymentStatus === 'PAID'
        ? { phase: 'settled', ride }
        : { phase: 'awaiting_payment', ride };
    case 'CANCELLED':
      return { phase: 'cancelled', ride };
    case 'NO_DRIVERS_FOUND':
      return { phase: 'no_drivers_found', ride };
  }
}
