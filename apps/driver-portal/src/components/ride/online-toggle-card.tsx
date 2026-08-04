'use client';

import { Badge, Card, CardContent, CardHeader, CardTitle, Select, Switch } from '@dripplex/ui';
import * as React from 'react';

import type { RideType } from '@dripplex/types';

import { useCurrentLocation } from '@/hooks/rides/use-current-location';
import {
  useDriverAvailability,
  useSetDriverAvailability,
} from '@/hooks/rides/use-driver-availability';

const VEHICLE_TYPE_OPTIONS: { value: RideType; label: string }[] = [
  { value: 'ECONOMY', label: 'Dx Ride (car)' },
  { value: 'COMFORT', label: 'Dx Comfort (car)' },
  { value: 'XL', label: 'Dx XL (car)' },
  { value: 'TRICYCLE', label: 'Tricycle (Keke)' },
];

export function OnlineToggleCard(): React.JSX.Element {
  const availability = useDriverAvailability();
  const setAvailability = useSetDriverAvailability();
  const location = useCurrentLocation();
  const [vehicleType, setVehicleType] = React.useState<RideType>('ECONOMY');

  React.useEffect(() => {
    if (availability.data?.vehicleType) {
      setVehicleType(availability.data.vehicleType);
    }
  }, [availability.data?.vehicleType]);

  const online = availability.data?.online ?? false;

  const onToggle = (checked: boolean): void => {
    setAvailability.mutate({
      online: checked,
      acceptingRides: checked,
      vehicleType,
      ...(location.latitude !== null && location.longitude !== null
        ? { latitude: location.latitude, longitude: location.longitude }
        : {}),
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>{online ? "You're online" : "You're offline"}</CardTitle>
        <Badge variant={online ? 'success' : 'outline'}>{online ? 'Online' : 'Offline'}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Accept ride requests</p>
            <p className="text-muted-foreground text-xs">
              {online
                ? "You'll receive ride offers while online."
                : 'Go online to start receiving ride offers.'}
            </p>
          </div>
          <Switch
            checked={online}
            onCheckedChange={onToggle}
            disabled={setAvailability.isPending || availability.isLoading}
            label="Toggle online status"
          />
        </div>

        {!online ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="vehicle-type" className="text-sm font-medium">
              Vehicle type
            </label>
            <Select
              id="vehicle-type"
              value={vehicleType}
              onChange={(event) => {
                setVehicleType(event.target.value as RideType);
              }}
            >
              {VEHICLE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        ) : null}

        {location.status === 'denied' ? (
          <p className="text-destructive text-xs">
            Location access is off — turn it on so nearby ride requests can find you.
          </p>
        ) : null}

        {setAvailability.isError ? (
          <p className="text-destructive text-xs">Couldn&apos;t update your status. Try again.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
