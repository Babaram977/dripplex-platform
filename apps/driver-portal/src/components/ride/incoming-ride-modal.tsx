'use client';

import {
  Badge,
  Button,
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from '@dripplex/ui';
import * as React from 'react';

import { useCurrentLocation } from '@/hooks/rides/use-current-location';
import { useAcceptOffer, useDeclineOffer } from '@/hooks/rides/use-driver-offer-actions';
import { useOfferPreview } from '@/hooks/rides/use-offer-preview';
import { useRideOffers } from '@/hooks/rides/use-ride-offers';
import { formatNaira } from '@/lib/format';
import { formatDistance, formatDuration, haversineDistanceMeters } from '@/lib/geo';

/** Rough urban driving speed used only to estimate "time to pickup" for
 * driver UX — display heuristic, not a fare input, so it doesn't need to
 * match the backend's own speed constant (RIDE_FARE_RATES / trip pricing
 * is untouched by this). */
const ESTIMATED_APPROACH_SPEED_MPS = 8.33;

function useCountdown(expiresAt: string | undefined): number {
  const [remainingMs, setRemainingMs] = React.useState(() =>
    expiresAt ? new Date(expiresAt).getTime() - Date.now() : 0,
  );

  React.useEffect(() => {
    if (!expiresAt) {
      return undefined;
    }
    const tick = (): void => {
      setRemainingMs(new Date(expiresAt).getTime() - Date.now());
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => {
      clearInterval(interval);
    };
  }, [expiresAt]);

  return Math.max(0, Math.round(remainingMs / 1000));
}

const VEHICLE_TYPE_LABEL: Record<string, string> = {
  ECONOMY: 'Economy (car)',
  TRICYCLE: 'Tricycle (Keke)',
};

/**
 * Shows at most one live offer at a time — the oldest pending one, if a
 * driver somehow has more than one. Auto-dismisses when the countdown
 * reaches zero, mirroring the backend's own offer-sweep timeout
 * (RIDE_OFFER_TIMEOUT_MS) rather than trying to out-race it.
 */
export function IncomingRideModal(): React.JSX.Element | null {
  const offers = useRideOffers();
  const offer = offers.data?.[0];
  const preview = useOfferPreview(offer?.id);
  const location = useCurrentLocation();
  const acceptOffer = useAcceptOffer();
  const declineOffer = useDeclineOffer();
  const remainingSeconds = useCountdown(preview.data?.expiresAt);

  const dismissedExpiredOfferId = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (
      offer &&
      remainingSeconds === 0 &&
      preview.data &&
      dismissedExpiredOfferId.current !== offer.id
    ) {
      dismissedExpiredOfferId.current = offer.id;
      void offers.refetch();
    }
  }, [offer, remainingSeconds, preview.data, offers]);

  if (!offer || !preview.data || remainingSeconds === 0) {
    return null;
  }

  const pickupDistanceMeters =
    location.latitude !== null && location.longitude !== null
      ? haversineDistanceMeters(
          { latitude: location.latitude, longitude: location.longitude },
          { latitude: preview.data.pickupLatitude, longitude: preview.data.pickupLongitude },
        )
      : null;

  const onAccept = (): void => {
    acceptOffer.mutate(offer.id);
  };

  const onDecline = (): void => {
    declineOffer.mutate(offer.id);
  };

  return (
    <Modal open onOpenChange={() => undefined}>
      <ModalContent
        onInteractOutside={(event) => {
          event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
        }}
      >
        <ModalHeader>
          <div className="flex items-center justify-between">
            <ModalTitle>New ride request</ModalTitle>
            <Badge variant={remainingSeconds <= 5 ? 'default' : 'outline'}>
              {remainingSeconds}s
            </Badge>
          </div>
          <ModalDescription>
            {VEHICLE_TYPE_LABEL[preview.data.rideType] ?? preview.data.rideType} ·{' '}
            {preview.data.paymentMethod ?? 'Payment TBD'}
          </ModalDescription>
        </ModalHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="border-border/70 rounded-md border p-3">
              <p className="text-muted-foreground text-xs">Pickup distance</p>
              <p className="text-lg font-semibold">
                {pickupDistanceMeters !== null ? formatDistance(pickupDistanceMeters) : '—'}
              </p>
              {pickupDistanceMeters !== null ? (
                <p className="text-muted-foreground text-xs">
                  ~{formatDuration(pickupDistanceMeters / ESTIMATED_APPROACH_SPEED_MPS)} away
                </p>
              ) : null}
            </div>
            <div className="border-border/70 rounded-md border p-3">
              <p className="text-muted-foreground text-xs">Estimated fare</p>
              <p className="text-lg font-semibold">{formatNaira(preview.data.totalFare)}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-start gap-2">
              <span className="bg-primary mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" />
              <span>{preview.data.pickupAddress ?? 'Pickup location shared on the map'}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-muted-foreground mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" />
              <span>{preview.data.dropoffAddress ?? 'Dropoff location shared on the map'}</span>
            </div>
          </div>

          {preview.data.estimatedDistanceMeters !== null &&
          preview.data.estimatedDurationSeconds !== null ? (
            <p className="text-muted-foreground text-xs">
              Trip: {formatDistance(preview.data.estimatedDistanceMeters)} ·{' '}
              {formatDuration(preview.data.estimatedDurationSeconds)}
            </p>
          ) : null}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onDecline}
              disabled={declineOffer.isPending || acceptOffer.isPending}
            >
              Decline
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={onAccept}
              disabled={declineOffer.isPending || acceptOffer.isPending}
            >
              Accept
            </Button>
          </div>

          {acceptOffer.isError ? (
            <p className="text-destructive text-xs">
              Couldn&apos;t accept this ride — it may have been taken already.
            </p>
          ) : null}
        </div>
      </ModalContent>
    </Modal>
  );
}
