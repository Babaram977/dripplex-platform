import type { OperationsRideAllocationDto, OperationsRideDetailDto } from '@dripplex/types';

export interface DispatchException {
  id: string;
  label: string;
}

/** A ride still waiting on a driver for this long is treated as stalled —
 * worth an operator's attention rather than assumed to still be "normal"
 * matching. Chosen to comfortably exceed `RIDE_OFFER_TIMEOUT_MS` /
 * `MAX_DISPATCH_ATTEMPTS` (frozen `rides/` constants) so a ride that's
 * merely mid-retry doesn't falsely flag. */
const STALLED_UNASSIGNED_MS = 5 * 60 * 1000;

/** How many DECLINED/EXPIRED offers, with none accepted, counts as
 * "repeated offer failures" worth flagging — the founder's own named
 * exception category. */
const REPEATED_FAILURE_THRESHOLD = 2;

/**
 * DPX-OPS-001 Slice 3 — computes the founder's named exception categories
 * for the ride detail view's "is there a problem?" question: "SOS,
 * stalled/unassigned rides, repeated offer failures, cancellations and
 * NO_DRIVERS_FOUND." Pure function over already-fetched data — no new
 * backend call, no new domain logic duplicated (the underlying facts —
 * `hasOpenSos`, `noDriversFound`, `cancelledAt`, offer outcomes — all come
 * straight from the real DTOs).
 */
export function computeDispatchExceptions(
  detail: OperationsRideDetailDto,
  allocation: OperationsRideAllocationDto | undefined,
): DispatchException[] {
  const exceptions: DispatchException[] = [];

  if (detail.hasOpenSos) {
    exceptions.push({ id: 'sos', label: 'Active SOS alert linked to this ride' });
  }

  if (detail.cancelledAt) {
    exceptions.push({
      id: 'cancelled',
      label: detail.cancellationReason ? `Cancelled: ${detail.cancellationReason}` : 'Cancelled',
    });
  }

  if (detail.noDriversFound) {
    exceptions.push({
      id: 'no-drivers-found',
      label: 'Dispatch exhausted every retry — no driver was ever found',
    });
  }

  const isUnassigned =
    (detail.status === 'REQUESTED' || detail.status === 'SEARCHING') && !detail.driverId;
  if (isUnassigned) {
    const waitedMs = Date.now() - new Date(detail.requestedAt).getTime();
    if (waitedMs >= STALLED_UNASSIGNED_MS) {
      exceptions.push({
        id: 'stalled',
        label: 'Still unassigned well past the usual matching time',
      });
    }
  }

  if (allocation) {
    const failedOffers = allocation.offers.filter(
      (offer) => offer.status === 'DECLINED' || offer.status === 'EXPIRED',
    );
    const hasAccepted = allocation.offers.some((offer) => offer.status === 'ACCEPTED');
    if (!hasAccepted && failedOffers.length >= REPEATED_FAILURE_THRESHOLD) {
      exceptions.push({
        id: 'repeated-offer-failures',
        label: `${String(failedOffers.length)} dispatch attempts failed with no driver accepting`,
      });
    }
  }

  return exceptions;
}
