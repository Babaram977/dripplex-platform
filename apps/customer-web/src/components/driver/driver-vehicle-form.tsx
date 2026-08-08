'use client';

import { Button, EmptyState, Input, Label, Select } from '@dripplex/ui';
import * as React from 'react';

import type { RideType, VehicleDto } from '@dripplex/types';

import { useRideTypeCatalog } from '@/hooks/rides';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { describeSdkError, DripplexApiError, sdk } from '@/lib/sdk';

type ViewState =
  | { kind: 'loading' }
  | { kind: 'not-driver' }
  | { kind: 'form' }
  | { kind: 'submitted'; vehicle: VehicleDto }
  | { kind: 'error'; title: string; description: string };

const CURRENT_YEAR = new Date().getFullYear();

/**
 * DPX-100 Priority 1 -- Vehicle Registration step of the in-app Driver
 * Registration flow (Figma `DriverVehicleRegScreen`, `src/app/driverScreen.tsx`).
 *
 * Adapted to the real backend contract (`CreateVehicleRequest` /
 * `DriverVehiclesController`), not the Figma mock:
 *  - Figma's "Passenger Seats" field has no backend counterpart -- dropped,
 *    not invented. `rideCategory` is what the backend actually models, read
 *    from the same real ride-type catalog customer-web's Ride module already
 *    uses (`useRideTypeCatalog`), not a hardcoded list.
 *  - No photo upload here: `photos` on `CreateVehicleRequest` takes hosted
 *    image URLs (`@IsUrl`) -- there is no file-upload/storage backend
 *    anywhere in this codebase (same constraint driver-portal's own KYC form
 *    already documents). Left optional/omitted rather than faked.
 */
export function DriverVehicleForm(): React.JSX.Element {
  const { ready } = useRequireAuth();
  const rideTypeCatalog = useRideTypeCatalog();
  const [view, setView] = React.useState<ViewState>({ kind: 'loading' });
  const [submitting, setSubmitting] = React.useState(false);

  const [plateNumber, setPlateNumber] = React.useState('');
  const [make, setMake] = React.useState('');
  const [model, setModel] = React.useState('');
  const [color, setColor] = React.useState('');
  const [year, setYear] = React.useState(String(CURRENT_YEAR));
  const [rideCategory, setRideCategory] = React.useState<RideType>('ECONOMY');

  React.useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    sdk.driverVehicles
      .listOwn()
      .then((vehicles) => {
        if (cancelled) return;
        const existing = vehicles[0];
        setView(existing ? { kind: 'submitted', vehicle: existing } : { kind: 'form' });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof DripplexApiError && error.statusCode === 403) {
          setView({ kind: 'not-driver' });
          return;
        }
        const described = describeSdkError(error);
        setView({ kind: 'error', title: described.title, description: described.description });
      });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  const onSubmit: React.SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    void (async () => {
      setSubmitting(true);
      try {
        const vehicle = await sdk.driverVehicles.create({
          plateNumber: plateNumber.trim(),
          make: make.trim(),
          model: model.trim(),
          color: color.trim(),
          year: Number(year),
          rideCategory,
        });
        setView({ kind: 'submitted', vehicle });
      } catch (error) {
        const described = describeSdkError(error);
        setView({ kind: 'error', title: described.title, description: described.description });
      } finally {
        setSubmitting(false);
      }
    })();
  };

  if (!ready || view.kind === 'loading') {
    return (
      <div className="text-muted-foreground flex min-h-[40vh] items-center justify-center text-sm">
        Loading…
      </div>
    );
  }

  if (view.kind === 'not-driver') {
    return (
      <EmptyState
        title="Become a Driver first"
        description="Vehicle registration is part of Driver onboarding. Go back and become a driver to continue."
      />
    );
  }

  if (view.kind === 'error') {
    return (
      <EmptyState
        title={view.title}
        description={view.description}
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setView({ kind: 'form' });
            }}
          >
            Try again
          </Button>
        }
      />
    );
  }

  if (view.kind === 'submitted') {
    const v = view.vehicle;
    return (
      <div className="space-y-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Vehicle registered</h1>
        <div className="border-border/70 bg-card/60 rounded-2xl border p-4 text-sm">
          <p className="font-medium">
            {v.make} {v.model} {v.year}
          </p>
          <p className="text-muted-foreground">
            {v.color} · {v.plateNumber}
          </p>
          <p className="text-muted-foreground mt-2">
            Approval status: <span className="text-foreground font-medium">{v.approvalStatus}</span>
          </p>
        </div>
        <p className="text-muted-foreground text-sm">
          Next, submit your documents for KYC verification.
        </p>
      </div>
    );
  }

  const catalogEntries = rideTypeCatalog.data ?? [];

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Vehicle registration</h1>
        <p className="text-muted-foreground text-sm">Your ride partner vehicle</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="veh-make">Make (brand)</Label>
        <Input
          id="veh-make"
          placeholder="e.g. Toyota"
          value={make}
          onChange={(e) => {
            setMake(e.target.value);
          }}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="veh-model">Model</Label>
        <Input
          id="veh-model"
          placeholder="e.g. Camry"
          value={model}
          onChange={(e) => {
            setModel(e.target.value);
          }}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="veh-year">Year</Label>
        <Input
          id="veh-year"
          type="number"
          min={1990}
          max={CURRENT_YEAR + 1}
          value={year}
          onChange={(e) => {
            setYear(e.target.value);
          }}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="veh-color">Colour</Label>
        <Input
          id="veh-color"
          placeholder="e.g. White"
          value={color}
          onChange={(e) => {
            setColor(e.target.value);
          }}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="veh-plate">Plate number</Label>
        <Input
          id="veh-plate"
          placeholder="e.g. LAG 482 KA"
          value={plateNumber}
          onChange={(e) => {
            setPlateNumber(e.target.value);
          }}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="veh-category">Ride category</Label>
        <Select
          id="veh-category"
          value={rideCategory}
          onChange={(e) => {
            setRideCategory(e.target.value as RideType);
          }}
        >
          {catalogEntries.length > 0
            ? catalogEntries.map((entry) => (
                <option key={entry.type} value={entry.type}>
                  {entry.displayName}
                </option>
              ))
            : (['ECONOMY', 'COMFORT', 'XL', 'TRICYCLE'] as const).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
        </Select>
      </div>

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? 'Saving…' : 'Save vehicle'}
      </Button>
    </form>
  );
}
