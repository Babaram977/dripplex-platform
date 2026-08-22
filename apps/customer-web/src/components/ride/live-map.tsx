'use client';

import { PLATFORM_BASE_CENTRE } from '@dripplex/types';
import { SuperAppRideMapCanvas } from '@dripplex/ui';
import { Map, Marker, Polyline, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import * as React from 'react';

import { resolveGoogleMapsApiKey } from '@/lib/google-maps-config';

export interface LiveMapPoint {
  latitude: number;
  longitude: number;
}

export interface LiveMapRouteInfo {
  distanceMeters: number;
  durationSeconds: number;
  distanceText: string;
  durationText: string;
}

type RouteBetween = 'pickupDropoff' | 'driverPickup' | 'driverDropoff' | 'none';

export interface LiveMapProps {
  pickup?: LiveMapPoint;
  dropoff?: LiveMapPoint;
  driver?: LiveMapPoint;
  nearbyDrivers?: LiveMapPoint[];
  /** Static traveled-route polyline (trip replay) — bypasses the Directions API. */
  breadcrumbPath?: LiveMapPoint[];
  routeBetween?: RouteBetween;
  draggablePickup?: boolean;
  onPickupChange?: (point: LiveMapPoint) => void;
  onRouteChange?: (route: LiveMapRouteInfo | null) => void;
  /** Explicit center when no pickup/dropoff/driver is set yet (e.g. Home screen). */
  center?: LiveMapPoint;
  zoom?: number;
  className?: string;
  /** MapCanvas fallback shown when no API key is configured. */
  fallbackVariant?: 'default' | 'finding' | 'assigned' | 'inprogress';
  fallbackProgress?: number;
}

/** Google Maps Platform's standard night-mode style, applied so the map
 * matches DrippleX's dark ride UI instead of Google's default light theme. */
const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#0D1B2E' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0D1B2E' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }],
  },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0f2417' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#16293f' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0D1B2E' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#7d94a8' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#1f3a57' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#16293f' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#060E1C' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4a6572' }] },
];

function toLatLng(point: LiveMapPoint): google.maps.LatLngLiteral {
  return { lat: point.latitude, lng: point.longitude };
}

function pointsKey(points: LiveMapPoint[]): string {
  return points.map((point) => `${String(point.latitude)},${String(point.longitude)}`).join('|');
}

function svgIcon(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const PICKUP_ICON = svgIcon(
  '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.3 21.7 0 14 0z" fill="#2BAC52"/><circle cx="14" cy="14" r="6" fill="#fff"/></svg>',
);
const DROPOFF_ICON = svgIcon(
  '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.3 21.7 0 14 0z" fill="#EF4444"/><circle cx="14" cy="14" r="6" fill="#fff"/></svg>',
);
const DRIVER_ICON = svgIcon(
  '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30"><circle cx="15" cy="15" r="13" fill="#2BAC52" stroke="#fff" stroke-width="2.5"/><path d="M15 8l4.5 8h-9z" fill="#fff"/></svg>',
);
const NEARBY_DRIVER_ICON = svgIcon(
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" fill="#47CF72" stroke="#0D1B2E" stroke-width="2"/></svg>',
);

/** Fits the camera to every point given, or centers on a single point/explicit center. Must render inside <Map>. */
function CameraController({
  points,
  fallbackCenter,
  zoom,
}: {
  points: LiveMapPoint[];
  fallbackCenter?: LiveMapPoint;
  zoom?: number;
}): null {
  const map = useMap();
  const key = pointsKey(points);

  React.useEffect(() => {
    if (!map) return;
    if (points.length === 0) {
      if (fallbackCenter) {
        map.setCenter(toLatLng(fallbackCenter));
        map.setZoom(zoom ?? 15);
      }
      return;
    }
    if (points.length === 1) {
      const only = points[0];
      if (only) {
        map.setCenter(toLatLng(only));
        map.setZoom(zoom ?? 15);
      }
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (const point of points) {
      bounds.extend(toLatLng(point));
    }
    map.fitBounds(bounds, 72);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key is the stable identity for `points`; fallbackCenter/zoom only matter on the empty-points branch
  }, [map, key]);

  return null;
}

/** Fetches a driving route via the Directions API and renders it as a polyline. Must render inside <Map>. */
function RouteRenderer({
  origin,
  destination,
  onRoute,
}: {
  origin: LiveMapPoint;
  destination: LiveMapPoint;
  onRoute?: (route: LiveMapRouteInfo | null) => void;
}): React.JSX.Element | null {
  const routesLibrary = useMapsLibrary('routes');
  const [encodedPath, setEncodedPath] = React.useState<string | null>(null);
  const key = `${String(origin.latitude)},${String(origin.longitude)}->${String(destination.latitude)},${String(destination.longitude)}`;
  const onRouteRef = React.useRef(onRoute);
  onRouteRef.current = onRoute;

  React.useEffect(() => {
    if (!routesLibrary) return undefined;
    let cancelled = false;
    const service = new routesLibrary.DirectionsService();

    service
      .route({
        origin: toLatLng(origin),
        destination: toLatLng(destination),
        travelMode: google.maps.TravelMode.DRIVING,
      })
      .then((result) => {
        if (cancelled) return;
        const route = result.routes[0];
        const leg = route?.legs[0];
        if (!route || !leg) {
          setEncodedPath(null);
          onRouteRef.current?.(null);
          return;
        }
        setEncodedPath(route.overview_polyline);
        onRouteRef.current?.({
          distanceMeters: leg.distance?.value ?? 0,
          durationSeconds: leg.duration?.value ?? 0,
          distanceText: leg.distance?.text ?? '',
          durationText: leg.duration?.text ?? '',
        });
      })
      .catch(() => {
        if (!cancelled) {
          setEncodedPath(null);
          onRouteRef.current?.(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [routesLibrary, key, origin, destination]);

  if (!encodedPath) {
    return null;
  }
  return (
    <Polyline
      encodedPath={encodedPath}
      strokeColor="#2BAC52"
      strokeWeight={4}
      strokeOpacity={0.85}
    />
  );
}

/**
 * Real Google Maps JavaScript API map — replaces the decorative
 * `SuperAppRideMapCanvas` SVG (`@dripplex/ui`) wherever a screen needs to
 * show real pickup/dropoff/driver positions. Falls back to that same SVG
 * when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY isn't configured, so every call site
 * keeps working in any environment that hasn't set up Maps credentials yet
 * (see docs/LAUNCH-READINESS-CREDENTIALS.md).
 */
export function LiveMap({
  pickup,
  dropoff,
  driver,
  nearbyDrivers = [],
  breadcrumbPath,
  routeBetween = 'none',
  draggablePickup = false,
  onPickupChange,
  onRouteChange,
  center,
  zoom,
  className,
  fallbackVariant = 'default',
  fallbackProgress = 0,
}: LiveMapProps): React.JSX.Element {
  const apiKey = resolveGoogleMapsApiKey();

  if (!apiKey) {
    return <SuperAppRideMapCanvas variant={fallbackVariant} progress={fallbackProgress} />;
  }

  const cameraPoints = [pickup, dropoff, driver].filter((point): point is LiveMapPoint => !!point);

  const routeEndpoints: [LiveMapPoint, LiveMapPoint] | null =
    routeBetween === 'pickupDropoff' && pickup && dropoff
      ? [pickup, dropoff]
      : routeBetween === 'driverPickup' && driver && pickup
        ? [driver, pickup]
        : routeBetween === 'driverDropoff' && driver && dropoff
          ? [driver, dropoff]
          : null;

  return (
    <div className={className ?? 'h-full w-full'}>
      <Map
        mapId={undefined}
        styles={DARK_MAP_STYLES}
        disableDefaultUI
        gestureHandling="greedy"
        defaultCenter={toLatLng(cameraPoints[0] ?? center ?? PLATFORM_BASE_CENTRE)}
        defaultZoom={zoom ?? 14}
      >
        <CameraController points={cameraPoints} fallbackCenter={center} zoom={zoom} />

        {breadcrumbPath && breadcrumbPath.length > 1 ? (
          <Polyline
            path={breadcrumbPath.map(toLatLng)}
            strokeColor="#47CF72"
            strokeWeight={4}
            strokeOpacity={0.85}
          />
        ) : null}

        {routeEndpoints ? (
          <RouteRenderer
            origin={routeEndpoints[0]}
            destination={routeEndpoints[1]}
            onRoute={onRouteChange}
          />
        ) : null}

        {nearbyDrivers.map((point, index) => (
          <Marker
            key={`nearby-${String(index)}`}
            position={toLatLng(point)}
            icon={NEARBY_DRIVER_ICON}
          />
        ))}

        {pickup ? (
          <Marker
            position={toLatLng(pickup)}
            icon={PICKUP_ICON}
            draggable={draggablePickup}
            onDragEnd={(event) => {
              const position = event.latLng;
              if (position && onPickupChange) {
                onPickupChange({ latitude: position.lat(), longitude: position.lng() });
              }
            }}
          />
        ) : null}

        {dropoff ? <Marker position={toLatLng(dropoff)} icon={DROPOFF_ICON} /> : null}

        {driver ? <Marker position={toLatLng(driver)} icon={DRIVER_ICON} /> : null}
      </Map>
    </div>
  );
}
