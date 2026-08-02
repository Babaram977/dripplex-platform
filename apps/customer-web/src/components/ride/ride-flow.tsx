'use client';

import { useSearchParams } from 'next/navigation';
import * as React from 'react';

import { RideMapsProvider } from './ride-maps-provider';
import { CashPaymentScreen } from './screens/cash-payment-screen';
import { DestinationSearchScreen } from './screens/destination-search-screen';
import { DriverArrivedScreen } from './screens/driver-arrived-screen';
import { DriverAssignedScreen } from './screens/driver-assigned-screen';
import { DriverEnRouteScreen } from './screens/driver-en-route-screen';
import { DriverProfileSheet } from './screens/driver-profile-sheet';
import { FareEstimateScreen } from './screens/fare-estimate-screen';
import { FindingDriverScreen } from './screens/finding-driver-screen';
import { GatewayPaymentScreen } from './screens/gateway-payment-screen';
import { LiveTrackingScreen } from './screens/live-tracking-screen';
import { PaymentScreen } from './screens/payment-screen';
import { RateDriverScreen } from './screens/rate-driver-screen';
import { ReportTripScreen } from './screens/report-trip-screen';
import { RideHistoryScreen } from './screens/ride-history-screen';
import { RideHomeScreen } from './screens/ride-home-screen';
import { RideInProgressScreen } from './screens/ride-in-progress-screen';
import { SavedPlacesScreen } from './screens/saved-places-screen';
import { TipDriverScreen } from './screens/tip-driver-screen';
import { TripCompletedScreen } from './screens/trip-completed-screen';
import { TripReceiptScreen } from './screens/trip-receipt-screen';
import { WalletPaySuccessScreen } from './screens/wallet-pay-success-screen';

import type { LiveMapPoint } from './live-map';
import type { CustomerAddressDto, RideType } from '@dripplex/types';

import { useCurrentLocation, useRequestRide } from '@/hooks/rides';

/**
 * RIDE-003 Slice 1 (Ride Request) + Slice 2 (Active Ride) + Slice 3 (Ride
 * Completion). Navigation follows the same flat-screen-union pattern as the
 * real Figma Make source (callbacks, not nested routes) — its own
 * "Navigation: flat Screen union + go() only" design constraint. Every
 * status-driven transition (finding->assigned, arrived->inprogress,
 * inprogress->completed, etc.) fires off real backend state via
 * useRideStatusTransition/useRide, never a local timer.
 */
type RideFlowScreen =
  | { name: 'home' }
  | { name: 'search' }
  | { name: 'fare'; destination: SelectedDestination }
  | { name: 'finding'; rideId: string }
  | { name: 'assigned'; rideId: string }
  | { name: 'driverProfile'; rideId: string }
  | { name: 'enroute'; rideId: string }
  | { name: 'arrived'; rideId: string }
  | { name: 'inprogress'; rideId: string }
  | { name: 'liveTracking'; rideId: string }
  | { name: 'completed'; rideId: string }
  | { name: 'payment'; rideId: string }
  | { name: 'gatewayPayment'; rideId: string; authorizationUrl: string; verifying: boolean }
  | { name: 'cashPayment'; rideId: string }
  | { name: 'paySuccess'; rideId: string }
  | { name: 'rate'; rideId: string }
  | { name: 'tip'; rideId: string }
  | { name: 'receipt'; rideId: string; returnTo: 'home' | 'history' }
  | { name: 'report'; rideId: string }
  | { name: 'history' }
  | { name: 'savedPlaces' };

interface SelectedDestination {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}

function toDestination(place: CustomerAddressDto): SelectedDestination {
  return {
    label: place.label === 'HOME' ? 'Home' : place.label === 'WORK' ? 'Work' : place.addressLine1,
    address: place.addressLine1,
    latitude: place.latitude,
    longitude: place.longitude,
  };
}

/** Resumes a gateway-payment redirect: /ride?rideId=xxx&payVerify=1 lands here after Paystack/Flutterwave/OPay checkout. */
function useResumeScreen(): RideFlowScreen | null {
  const searchParams = useSearchParams();
  return React.useMemo(() => {
    const rideId = searchParams.get('rideId');
    const payVerify = searchParams.get('payVerify');
    if (rideId && payVerify === '1') {
      return { name: 'gatewayPayment', rideId, authorizationUrl: '', verifying: true };
    }
    return null;
  }, [searchParams]);
}

export function RideFlow(): React.JSX.Element {
  const resumeScreen = useResumeScreen();
  const [screen, setScreen] = React.useState<RideFlowScreen>(resumeScreen ?? { name: 'home' });
  const location = useCurrentLocation();
  const requestRide = useRequestRide();
  const [pickupOverride, setPickupOverride] = React.useState<LiveMapPoint | null>(null);
  const effectivePickup: LiveMapPoint | null =
    pickupOverride ??
    (location.latitude !== null && location.longitude !== null
      ? { latitude: location.latitude, longitude: location.longitude }
      : null);

  const goHome = React.useCallback((): void => {
    setScreen({ name: 'home' });
  }, []);

  return <RideMapsProvider>{renderScreen()}</RideMapsProvider>;

  function renderScreen(): React.JSX.Element {
    switch (screen.name) {
      case 'home':
        return (
          <RideHomeScreen
            onSearch={() => {
              setScreen({ name: 'search' });
            }}
            onSelectPlace={(place) => {
              setScreen({ name: 'fare', destination: toDestination(place) });
            }}
            onHistory={() => {
              setScreen({ name: 'history' });
            }}
            onSavedPlaces={() => {
              setScreen({ name: 'savedPlaces' });
            }}
          />
        );

      case 'history':
        return (
          <RideHistoryScreen
            onBack={goHome}
            onDetail={(rideId) => {
              setScreen({ name: 'receipt', rideId, returnTo: 'history' });
            }}
          />
        );

      case 'savedPlaces':
        return <SavedPlacesScreen onBack={goHome} />;

      case 'search':
        return (
          <DestinationSearchScreen
            onBack={goHome}
            onSelect={(destination) => {
              setScreen({ name: 'fare', destination });
            }}
          />
        );

      case 'fare':
        return (
          <FareEstimateScreen
            destination={screen.destination}
            location={location}
            pickupOverride={pickupOverride}
            onPickupChange={setPickupOverride}
            onBack={goHome}
            onBook={(rideType: RideType) => {
              if (effectivePickup === null) {
                return;
              }
              requestRide.mutate(
                {
                  rideType,
                  pickupLatitude: effectivePickup.latitude,
                  pickupLongitude: effectivePickup.longitude,
                  dropoffLatitude: screen.destination.latitude,
                  dropoffLongitude: screen.destination.longitude,
                  dropoffAddress: screen.destination.address,
                },
                {
                  onSuccess: (ride) => {
                    setScreen({ name: 'finding', rideId: ride.id });
                  },
                },
              );
            }}
          />
        );

      case 'finding':
        return (
          <FindingDriverScreen
            rideId={screen.rideId}
            onBack={goHome}
            onDriverAssigned={() => {
              setScreen({ name: 'assigned', rideId: screen.rideId });
            }}
          />
        );

      case 'assigned':
        return (
          <DriverAssignedScreen
            rideId={screen.rideId}
            onBack={goHome}
            onViewProfile={() => {
              setScreen({ name: 'driverProfile', rideId: screen.rideId });
            }}
            onTrackDriver={() => {
              setScreen({ name: 'enroute', rideId: screen.rideId });
            }}
            onArrived={() => {
              setScreen({ name: 'arrived', rideId: screen.rideId });
            }}
          />
        );

      case 'driverProfile':
        return (
          <DriverProfileSheet
            onBack={() => {
              setScreen({ name: 'assigned', rideId: screen.rideId });
            }}
          />
        );

      case 'enroute':
        return (
          <DriverEnRouteScreen
            rideId={screen.rideId}
            onBack={goHome}
            onArrived={() => {
              setScreen({ name: 'arrived', rideId: screen.rideId });
            }}
            onStarted={() => {
              setScreen({ name: 'inprogress', rideId: screen.rideId });
            }}
          />
        );

      case 'arrived':
        return (
          <DriverArrivedScreen
            rideId={screen.rideId}
            onBack={goHome}
            onStarted={() => {
              setScreen({ name: 'inprogress', rideId: screen.rideId });
            }}
          />
        );

      case 'inprogress':
        return (
          <RideInProgressScreen
            rideId={screen.rideId}
            onViewLiveTracking={() => {
              setScreen({ name: 'liveTracking', rideId: screen.rideId });
            }}
            onCompleted={() => {
              setScreen({ name: 'completed', rideId: screen.rideId });
            }}
          />
        );

      case 'liveTracking':
        return (
          <LiveTrackingScreen
            rideId={screen.rideId}
            onBack={() => {
              setScreen({ name: 'inprogress', rideId: screen.rideId });
            }}
          />
        );

      case 'completed':
        return (
          <TripCompletedScreen
            rideId={screen.rideId}
            onPay={() => {
              setScreen({ name: 'payment', rideId: screen.rideId });
            }}
            onHome={goHome}
          />
        );

      case 'payment':
        return (
          <PaymentScreen
            rideId={screen.rideId}
            onBack={() => {
              setScreen({ name: 'completed', rideId: screen.rideId });
            }}
            onPaid={() => {
              setScreen({ name: 'paySuccess', rideId: screen.rideId });
            }}
            onCashPending={() => {
              setScreen({ name: 'cashPayment', rideId: screen.rideId });
            }}
            onGatewayRedirect={(authorizationUrl) => {
              setScreen({
                name: 'gatewayPayment',
                rideId: screen.rideId,
                authorizationUrl,
                verifying: false,
              });
            }}
          />
        );

      case 'gatewayPayment':
        return (
          <GatewayPaymentScreen
            rideId={screen.rideId}
            authorizationUrl={screen.authorizationUrl}
            verifying={screen.verifying}
            onBack={() => {
              setScreen({ name: 'payment', rideId: screen.rideId });
            }}
            onVerified={() => {
              setScreen({ name: 'paySuccess', rideId: screen.rideId });
            }}
          />
        );

      case 'cashPayment':
        return (
          <CashPaymentScreen
            rideId={screen.rideId}
            onBack={() => {
              setScreen({ name: 'payment', rideId: screen.rideId });
            }}
            onConfirmed={() => {
              setScreen({ name: 'paySuccess', rideId: screen.rideId });
            }}
          />
        );

      case 'paySuccess':
        return (
          <WalletPaySuccessScreen
            rideId={screen.rideId}
            onReceipt={() => {
              setScreen({ name: 'receipt', rideId: screen.rideId, returnTo: 'home' });
            }}
            onDone={() => {
              setScreen({ name: 'rate', rideId: screen.rideId });
            }}
          />
        );

      case 'rate':
        return (
          <RateDriverScreen
            rideId={screen.rideId}
            onBack={goHome}
            onSubmit={() => {
              setScreen({ name: 'tip', rideId: screen.rideId });
            }}
          />
        );

      case 'tip':
        return (
          <TipDriverScreen
            rideId={screen.rideId}
            onBack={goHome}
            onSubmit={goHome}
            onSkip={goHome}
          />
        );

      case 'receipt':
        return (
          <TripReceiptScreen
            rideId={screen.rideId}
            onBack={
              screen.returnTo === 'history'
                ? () => {
                    setScreen({ name: 'history' });
                  }
                : goHome
            }
            onReport={() => {
              setScreen({ name: 'report', rideId: screen.rideId });
            }}
          />
        );

      case 'report':
        return <ReportTripScreen rideId={screen.rideId} onBack={goHome} onSubmit={goHome} />;
    }
  }
}
