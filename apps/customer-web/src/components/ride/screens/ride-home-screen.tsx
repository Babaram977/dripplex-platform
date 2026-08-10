'use client';

import { useAuth } from '@dripplex/hooks';
import {
  SuperAppRideBottomSheet,
  SuperAppRideDestinationTrigger,
  SuperAppRideQuickPlaces,
  SuperAppRideSafetyChip,
  SuperAppRideSavedPlacesList,
  SuperAppRideStatusBar,
  useSuperAppFonts,
} from '@dripplex/ui';
import * as React from 'react';

import { LiveMap } from '../live-map';

import type { CustomerAddressDto } from '@dripplex/types';

import { useCurrentLocation, useNearbyDrivers, useSavedPlaces } from '@/hooks/rides';

export function RideHomeScreen({
  onSearch,
  onSelectPlace,
  onHistory,
  onSavedPlaces,
  onExit,
}: {
  onSearch: () => void;
  onSelectPlace: (place: CustomerAddressDto) => void;
  onHistory: () => void;
  onSavedPlaces: () => void;
  /** Leaves the full-screen ride flow entirely (back to the rest of the app). */
  onExit: () => void;
}): React.JSX.Element {
  const { user } = useAuth();
  const savedPlaces = useSavedPlaces();
  const location = useCurrentLocation();

  const canShowNearby =
    location.status === 'ready' && location.latitude !== null && location.longitude !== null;
  const nearbyDrivers = useNearbyDrivers(
    canShowNearby && location.latitude !== null && location.longitude !== null
      ? { latitude: location.latitude, longitude: location.longitude, rideType: 'ECONOMY' }
      : undefined,
  );

  const allPlaces = savedPlaces.data?.items ?? [];
  const quickPlaces = allPlaces.filter((place) => place.label === 'HOME' || place.label === 'WORK');

  const selectById = (id: string): void => {
    const place = allPlaces.find((item) => item.id === id);
    if (place) {
      onSelectPlace(place);
    }
  };

  const { heading, body } = useSuperAppFonts();

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#060E1C' }}
    >
      <div className="relative flex-shrink-0" style={{ height: 340 }}>
        <LiveMap
          center={
            location.latitude !== null && location.longitude !== null
              ? { latitude: location.latitude, longitude: location.longitude }
              : undefined
          }
          nearbyDrivers={(nearbyDrivers.data ?? []).map((driver) => ({
            latitude: driver.latitude,
            longitude: driver.longitude,
          }))}
          zoom={15}
          fallbackVariant="default"
        />
        <div className="absolute inset-0">
          <SuperAppRideStatusBar />
        </div>
        <div className="absolute left-0 top-14 flex items-center px-5" style={{ marginTop: 16 }}>
          <button
            type="button"
            onClick={onExit}
            aria-label="Back to app"
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{
              background: 'rgba(6,14,28,.85)',
              border: '1px solid rgba(255,255,255,.08)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,.7)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
        <div
          className="absolute right-0 top-14 flex items-center justify-end gap-2 px-5"
          style={{ marginTop: 16 }}
        >
          <SuperAppRideSafetyChip />
          <button
            type="button"
            onClick={onHistory}
            aria-label="Ride history"
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{
              background: 'rgba(6,14,28,.85)',
              border: '1px solid rgba(255,255,255,.08)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,.7)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </button>
        </div>
      </div>
      <SuperAppRideBottomSheet peek>
        <div className="flex-1 overflow-y-auto px-5 pb-4 pt-2">
          <div className="mb-4">
            <p className={`mb-0.5 text-[18px] font-bold text-white ${heading}`}>
              Where to{user?.firstName ? `, ${user.firstName}` : ''}?
            </p>
            <p className={`text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
              Set your destination to see fares nearby
            </p>
          </div>
          <div className="mb-4">
            <SuperAppRideDestinationTrigger onClick={onSearch} />
          </div>
          <SuperAppRideQuickPlaces
            places={quickPlaces.map((place) => ({
              id: place.id,
              label: place.label as 'HOME' | 'WORK',
              addressLine1: place.addressLine1,
            }))}
            onSelect={(place) => {
              selectById(place.id);
            }}
          />
          <SuperAppRideSavedPlacesList
            places={allPlaces.map((place) => ({
              id: place.id,
              label: place.label,
              addressLine1: place.addressLine1,
              city: place.city,
              state: place.state,
            }))}
            isLoading={savedPlaces.isLoading}
            isError={savedPlaces.isError}
            onSelect={(place) => {
              selectById(place.id);
            }}
            onManage={onSavedPlaces}
          />
        </div>
      </SuperAppRideBottomSheet>
    </div>
  );
}
