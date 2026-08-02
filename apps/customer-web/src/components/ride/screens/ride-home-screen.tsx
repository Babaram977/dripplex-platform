'use client';

import { useAuth } from '@dripplex/hooks';
import * as React from 'react';

import { LiveMap } from '../live-map';
import { RideStatusBar, SafetyChip } from '../ride-ui';

import type { CustomerAddressDto } from '@dripplex/types';

import { useCurrentLocation, useNearbyDrivers, useSavedPlaces } from '@/hooks/rides';

export function RideHomeScreen({
  onSearch,
  onSelectPlace,
  onHistory,
  onSavedPlaces,
}: {
  onSearch: () => void;
  onSelectPlace: (place: CustomerAddressDto) => void;
  onHistory: () => void;
  onSavedPlaces: () => void;
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

  const quickPlaces = (savedPlaces.data?.items ?? []).filter(
    (place) => place.label === 'HOME' || place.label === 'WORK',
  );

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
          <RideStatusBar />
        </div>
        <div
          className="absolute right-0 top-14 flex items-center justify-end gap-2 px-5"
          style={{ marginTop: 16 }}
        >
          <SafetyChip />
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
      <div
        className="relative z-10 flex flex-1 flex-col"
        style={{
          background: '#0A1628',
          borderRadius: '28px 28px 0 0',
          boxShadow: '0 -24px 80px rgba(0,0,0,.7)',
        }}
      >
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full" style={{ background: 'rgba(255,255,255,.15)' }} />
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4 pt-2">
          <div className="mb-4">
            <p
              className="mb-0.5 text-[18px] font-bold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
            >
              Where to{user?.firstName ? `, ${user.firstName}` : ''}?
            </p>
            <p
              className="text-[13px]"
              style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.5)' }}
            >
              Set your destination to see fares nearby
            </p>
          </div>
          <button type="button" onClick={onSearch} className="mb-4 w-full text-left">
            <div
              className="flex h-14 items-center gap-3 rounded-2xl px-4"
              style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#2BAC52"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <span
                style={{
                  fontFamily: "'Inter',sans-serif",
                  fontSize: 15,
                  color: 'rgba(255,255,255,.5)',
                }}
              >
                Where are you going?
              </span>
            </div>
          </button>
          {quickPlaces.length > 0 ? (
            <div className="mb-5 flex gap-3">
              {quickPlaces.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => {
                    onSelectPlace(place);
                  }}
                  className="flex flex-1 items-center gap-2.5 rounded-2xl px-3 py-3"
                  style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
                >
                  <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-base"
                    style={{ background: 'rgba(43,172,82,.12)' }}
                  >
                    {place.label === 'HOME' ? '🏠' : '💼'}
                  </div>
                  <div className="min-w-0">
                    <p
                      className="truncate text-[13px] font-semibold"
                      style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
                    >
                      {place.label === 'HOME' ? 'Home' : 'Work'}
                    </p>
                    <p
                      className="truncate text-[11px]"
                      style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.5)' }}
                    >
                      {place.addressLine1}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
          <div className="mb-3 flex items-center justify-between">
            <p
              className="text-[13px] font-semibold"
              style={{ fontFamily: "'Poppins',sans-serif", color: 'rgba(255,255,255,.5)' }}
            >
              SAVED PLACES
            </p>
            <button
              type="button"
              onClick={onSavedPlaces}
              className="text-[12px] font-semibold"
              style={{ color: '#47CF72', fontFamily: "'Poppins',sans-serif" }}
            >
              Manage
            </button>
          </div>
          {(savedPlaces.data?.items ?? []).length === 0 ? (
            <p
              className="text-[13px]"
              style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.5)' }}
            >
              {savedPlaces.isLoading
                ? 'Loading…'
                : savedPlaces.isError
                  ? "Couldn't load your saved places."
                  : 'No saved places yet — add one from Destination Search.'}
            </p>
          ) : (
            (savedPlaces.data?.items ?? []).map((place) => (
              <button
                key={place.id}
                type="button"
                onClick={() => {
                  onSelectPlace(place);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-1 py-3"
              >
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-lg"
                  style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
                >
                  {place.label === 'HOME' ? '🏠' : place.label === 'WORK' ? '💼' : '📍'}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p
                    className="text-[14px] font-medium"
                    style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
                  >
                    {place.addressLine1}
                  </p>
                  <p
                    className="truncate text-[12px]"
                    style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.5)' }}
                  >
                    {place.city}, {place.state}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
