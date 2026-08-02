'use client';

import * as React from 'react';

import { DestinationSearchScreen } from './screens/destination-search-screen';
import { FareEstimateScreen } from './screens/fare-estimate-screen';
import { FindingDriverScreen } from './screens/finding-driver-screen';
import { RideHomeScreen } from './screens/ride-home-screen';

import type { CustomerAddressDto, RideType } from '@dripplex/types';

import { useCurrentLocation, useRequestRide } from '@/hooks/rides';

/**
 * RIDE-003 Slice 1 (Ride Request) — Home, Destination Search, Fare Estimate,
 * Finding Driver. Ends once dispatch either assigns a driver or the ride
 * reaches NO_DRIVERS_FOUND/CANCELLED. Driver Assigned and everything after
 * belongs to Slice 2 (Active Ride) — deliberately not built here, since the
 * real backend has no driver-identity endpoint yet for non-completed rides
 * (see docs/RIDE-003-INTEGRATION-MAP.md Section 6), which that screen
 * depends on.
 *
 * Navigation follows the same flat-screen-union pattern as the real Figma
 * Make source (callbacks, not nested routes), matching its own
 * "Navigation: flat Screen union + go() only" design constraint.
 */
type RideFlowScreen =
  | { name: 'home' }
  | { name: 'search' }
  | { name: 'fare'; destination: SelectedDestination }
  | { name: 'finding'; rideId: string };

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

export function RideFlow(): React.JSX.Element {
  const [screen, setScreen] = React.useState<RideFlowScreen>({ name: 'home' });
  const location = useCurrentLocation();
  const requestRide = useRequestRide();

  const goHome = React.useCallback((): void => {
    setScreen({ name: 'home' });
  }, []);

  if (screen.name === 'home') {
    return (
      <RideHomeScreen
        onSearch={() => {
          setScreen({ name: 'search' });
        }}
        onSelectPlace={(place) => {
          setScreen({ name: 'fare', destination: toDestination(place) });
        }}
      />
    );
  }

  if (screen.name === 'search') {
    return (
      <DestinationSearchScreen
        onBack={goHome}
        onSelect={(place) => {
          setScreen({ name: 'fare', destination: toDestination(place) });
        }}
      />
    );
  }

  if (screen.name === 'fare') {
    return (
      <FareEstimateScreen
        destination={screen.destination}
        location={location}
        onBack={goHome}
        onBook={(rideType: RideType) => {
          if (location.latitude === null || location.longitude === null) {
            return;
          }
          requestRide.mutate(
            {
              rideType,
              pickupLatitude: location.latitude,
              pickupLongitude: location.longitude,
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
  }

  return <FindingDriverScreen rideId={screen.rideId} onBack={goHome} />;
}
