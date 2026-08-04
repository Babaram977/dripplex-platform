'use client';

import { Map, Marker, useMap } from '@vis.gl/react-google-maps';
import * as React from 'react';

import { FleetStatusBadge } from './fleet-status-badge';

import type { FleetDriverDto, FleetDriverStatus } from '@dripplex/types';

import { resolveGoogleMapsApiKey } from '@/lib/google-maps-config';

export interface FleetMapProps {
  drivers: FleetDriverDto[];
  className?: string;
}

/** Lagos default centre — same fallback point driver-portal/customer-web's
 * LiveMap use when there's no better anchor yet. */
const DEFAULT_CENTER = { lat: 6.455, lng: 3.3841 };

function svgIcon(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const MARKER_FILL: Record<FleetDriverStatus, string> = {
  SOS: '#EF4444',
  SUSPENDED: '#7C2D12',
  NEEDS_INSPECTION: '#F4B400',
  BUSY: '#0A2540',
  AVAILABLE: '#2BAC52',
  OFFLINE: '#94A3B8',
};

function markerIcon(status: FleetDriverStatus): string {
  const fill = MARKER_FILL[status];
  return svgIcon(
    `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="11" fill="${fill}" stroke="#fff" stroke-width="2"/></svg>`,
  );
}

/** Fits the camera to every located driver, once, on first load — an
 * operator is expected to pan/zoom manually after that rather than have
 * the view yanked around on every 15s poll. */
function CameraController({ points }: { points: google.maps.LatLngLiteral[] }): null {
  const map = useMap();
  const fitted = React.useRef(false);

  React.useEffect(() => {
    if (!map || fitted.current || points.length === 0) return;
    fitted.current = true;
    if (points.length === 1) {
      const only = points[0];
      if (only) {
        map.setCenter(only);
        map.setZoom(13);
      }
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (const point of points) {
      bounds.extend(point);
    }
    map.fitBounds(bounds, 64);
  }, [map, points]);

  return null;
}

/** List-only fallback rendered when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` isn't
 * configured. Sorted so the highest-priority statuses (SOS first, mirroring
 * `computeFleetDriverStatus`'s own priority order) surface at the top —
 * this is the "air traffic control screen," so what needs attention has to
 * be visible without scrolling. */
const STATUS_SORT_ORDER: FleetDriverStatus[] = [
  'SOS',
  'SUSPENDED',
  'NEEDS_INSPECTION',
  'BUSY',
  'AVAILABLE',
  'OFFLINE',
];

function FleetListFallback({ drivers }: { drivers: FleetDriverDto[] }): React.JSX.Element {
  const sorted = [...drivers].sort(
    (a, b) => STATUS_SORT_ORDER.indexOf(a.status) - STATUS_SORT_ORDER.indexOf(b.status),
  );

  return (
    <div className="border-border/70 divide-border/70 max-h-[520px] divide-y overflow-y-auto rounded-lg border">
      {sorted.map((driver) => (
        <div key={driver.driverId} className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-sm font-medium">
              {driver.firstName} {driver.lastName}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {driver.vehiclePlateNumber ?? 'No vehicle on file'}
              {driver.latitude !== null && driver.longitude !== null
                ? ` · ${driver.latitude.toFixed(4)}, ${driver.longitude.toFixed(4)}`
                : ' · No live location'}
            </p>
          </div>
          <FleetStatusBadge status={driver.status} />
        </div>
      ))}
    </div>
  );
}

/**
 * DPX-OPS-001 Slice 1 — the Live Fleet Map, the founder's required "first
 * screen operators see." Falls back to `FleetListFallback` when
 * `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` isn't configured (this environment has
 * no live browser session to verify the map-rendering path against, so the
 * fallback is the functionally complete path, not a decorative stub — same
 * posture driver-portal's `LiveMap` takes with `MapCanvas`).
 */
export function FleetMap({ drivers, className }: FleetMapProps): React.JSX.Element {
  const apiKey = resolveGoogleMapsApiKey();
  const located = drivers.filter(
    (driver): driver is FleetDriverDto & { latitude: number; longitude: number } =>
      driver.latitude !== null && driver.longitude !== null,
  );

  if (!apiKey) {
    return <FleetListFallback drivers={drivers} />;
  }

  const points = located.map((driver) => ({ lat: driver.latitude, lng: driver.longitude }));

  return (
    <div className={className ?? 'h-[520px] w-full overflow-hidden rounded-lg'}>
      <Map
        mapId={undefined}
        disableDefaultUI={false}
        gestureHandling="greedy"
        defaultCenter={points[0] ?? DEFAULT_CENTER}
        defaultZoom={12}
      >
        <CameraController points={points} />
        {located.map((driver) => (
          <Marker
            key={driver.driverId}
            position={{ lat: driver.latitude, lng: driver.longitude }}
            icon={markerIcon(driver.status)}
            title={`${driver.firstName} ${driver.lastName} — ${driver.status}`}
          />
        ))}
      </Map>
    </div>
  );
}
