'use client';

import * as React from 'react';

import { DestinationSearchScreen } from './screens/destination-search-screen';
import { DriverArrivedScreen } from './screens/driver-arrived-screen';
import { DriverAssignedScreen } from './screens/driver-assigned-screen';
import { DriverEnRouteScreen } from './screens/driver-en-route-screen';
import { DriverProfileSheet } from './screens/driver-profile-sheet';
import { FareEstimateScreen } from './screens/fare-estimate-screen';
import { FindingDriverScreen } from './screens/finding-driver-screen';
import { LiveTrackingScreen } from './screens/live-tracking-screen';
import { RideHomeScreen } from './screens/ride-home-screen';
import { RideInProgressScreen } from './screens/ride-in-progress-screen';

import type { CustomerAddressDto, RideType } from '@dripplex/types';

import { useCurrentLocation, useRequestRide } from '@/hooks/rides';

/**
 * RIDE-003 Slice 1 (Ride Request) + Slice 2 (Active Ride). Navigation
 * follows the same flat-screen-union pattern as the real Figma Make source
 * (callbacks, not nested routes) — its own "Navigation: flat Screen union +
 * go() only" design constraint. Screen transitions within an active ride
 * (assigned -> enroute -> arrived -> inprogress) are driven by the real
 * ride status over WebSocket/poll, not local timers — see
 * useRideStatusTransition.
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
  | { name: 'liveTracking'; rideId: string };

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
        />
      );

    case 'search':
      return (
        <DestinationSearchScreen
          onBack={goHome}
          onSelect={(place) => {
            setScreen({ name: 'fare', destination: toDestination(place) });
          }}
        />
      );

    case 'fare':
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
  }
}
