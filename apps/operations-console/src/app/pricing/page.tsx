'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  LoadingSpinner,
  toast,
} from '@dripplex/ui';
import * as React from 'react';

import type {
  RideFareRateDto,
  RideSurchargeTrigger,
  RideSurchargeType,
  RideSurchargeZoneDto,
} from '@dripplex/types';

import { AppShell } from '@/components/app-shell';
import {
  useCreateRideSurchargeZone,
  useRideFareRates,
  useRideSurchargeZones,
  useUpdateRideFareRate,
  useUpdateRideSurchargeZone,
} from '@/hooks/use-ride-pricing';

const naira = (value: number): string => `₦${value.toLocaleString('en-NG')}`;

/** Parses a money/number field, treating an empty or unparseable box as
 * "no value" rather than silently as zero — a blank base fare that saves as 0
 * would quietly make every trip free. */
function parseNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

// ── Fare table ──────────────────────────────────────────────────────────────

interface RateForm {
  baseFare: string;
  perKmRate: string;
  perMinuteRate: string;
  minimumFare: string;
}

function toRateForm(rate: RideFareRateDto): RateForm {
  return {
    baseFare: String(rate.baseFare),
    perKmRate: String(rate.perKmRate),
    perMinuteRate: String(rate.perMinuteRate),
    minimumFare: String(rate.minimumFare),
  };
}

function FareRateRow({ rate }: { rate: RideFareRateDto }): React.JSX.Element {
  const update = useUpdateRideFareRate();
  const [form, setForm] = React.useState<RateForm>(() => toRateForm(rate));

  // Re-sync when the server sends a different rate — another operator may have
  // changed it, and a form still showing the old figure would save it back.
  React.useEffect(() => {
    setForm(toRateForm(rate));
  }, [rate]);

  const set = (key: keyof RateForm, value: string): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const dirty =
    form.baseFare !== String(rate.baseFare) ||
    form.perKmRate !== String(rate.perKmRate) ||
    form.perMinuteRate !== String(rate.perMinuteRate) ||
    form.minimumFare !== String(rate.minimumFare);

  const onSave = (): void => {
    const baseFare = parseNumber(form.baseFare);
    const perKmRate = parseNumber(form.perKmRate);
    const perMinuteRate = parseNumber(form.perMinuteRate);
    const minimumFare = parseNumber(form.minimumFare);

    if (baseFare === null || perKmRate === null || perMinuteRate === null || minimumFare === null) {
      toast({
        title: 'Every field needs a number',
        description: 'Leaving one blank would save it as zero.',
        variant: 'destructive',
      });
      return;
    }
    if ([baseFare, perKmRate, perMinuteRate, minimumFare].some((value) => value < 0)) {
      toast({ title: 'Rates cannot be negative', variant: 'destructive' });
      return;
    }

    update.mutate(
      { rideType: rate.rideType, body: { baseFare, perKmRate, perMinuteRate, minimumFare } },
      {
        onSuccess: () => {
          toast({
            title: `${rate.displayName} rates saved`,
            description: 'Applies to new trips only — trips already priced keep their fare.',
          });
        },
        onError: (error) => {
          toast({
            title: "Couldn't save rates",
            description: error.message,
            variant: 'destructive',
          });
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-3 border-b py-4 last:border-b-0">
      <div className="flex items-center gap-2">
        <p className="font-semibold">{rate.displayName}</p>
        <Badge variant="outline">{rate.rideType}</Badge>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs">
          Base fare (₦)
          <Input
            inputMode="decimal"
            value={form.baseFare}
            onChange={(event) => {
              set('baseFare', event.target.value);
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Per km (₦)
          <Input
            inputMode="decimal"
            value={form.perKmRate}
            onChange={(event) => {
              set('perKmRate', event.target.value);
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Per minute (₦)
          <Input
            inputMode="decimal"
            value={form.perMinuteRate}
            onChange={(event) => {
              set('perMinuteRate', event.target.value);
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Minimum fare (₦)
          <Input
            inputMode="decimal"
            value={form.minimumFare}
            onChange={(event) => {
              set('minimumFare', event.target.value);
            }}
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={onSave} disabled={!dirty || update.isPending}>
          {update.isPending ? 'Saving…' : 'Save'}
        </Button>
        <p className="text-muted-foreground text-xs">
          The minimum is a floor, not an addition — a short trip that prices below it is charged it,
          and longer trips are unaffected.
        </p>
      </div>
    </div>
  );
}

function FareTable(): React.JSX.Element {
  const rates = useRideFareRates();

  if (rates.isLoading) return <LoadingSpinner />;
  if (rates.isError) {
    return <EmptyState title="Couldn't load the fare table" description={rates.error.message} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fare table</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4 text-sm">
          What each ride type costs. Changes apply to new trips only — a trip already priced keeps
          the fare it was quoted, so nothing already settled is re-priced.
        </p>
        {(rates.data ?? []).map((rate) => (
          <FareRateRow key={rate.rideType} rate={rate} />
        ))}
      </CardContent>
    </Card>
  );
}

// ── Surcharge zones ─────────────────────────────────────────────────────────

const TRIGGER_LABEL: Record<RideSurchargeTrigger, string> = {
  PICKUP: 'Trips starting here',
  DROPOFF: 'Trips ending here',
  EITHER: 'Trips either way',
};

function describeAmount(zone: RideSurchargeZoneDto): string {
  return zone.surchargeType === 'FLAT'
    ? `${naira(zone.amount)} added`
    : `×${String(zone.amount)} of the metered fare`;
}

function CreateZoneForm(): React.JSX.Element {
  const create = useCreateRideSurchargeZone();
  const [form, setForm] = React.useState({
    name: '',
    latitude: '',
    longitude: '',
    radiusMeters: '3000',
    surchargeType: 'FLAT' as RideSurchargeType,
    amount: '',
    appliesTo: 'EITHER' as RideSurchargeTrigger,
  });

  const set = (key: keyof typeof form, value: string): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = (): void => {
    const latitude = parseNumber(form.latitude);
    const longitude = parseNumber(form.longitude);
    const radiusMeters = parseNumber(form.radiusMeters);
    const amount = parseNumber(form.amount);

    if (form.name.trim().length < 2) {
      toast({ title: 'Give the zone a name', variant: 'destructive' });
      return;
    }
    if (latitude === null || longitude === null) {
      toast({
        title: 'A zone needs a centre',
        description: 'Paste the latitude and longitude from a map pin.',
        variant: 'destructive',
      });
      return;
    }
    if (radiusMeters === null || radiusMeters < 100) {
      toast({ title: 'Radius must be at least 100 m', variant: 'destructive' });
      return;
    }
    if (amount === null) {
      toast({ title: 'Give the surcharge an amount', variant: 'destructive' });
      return;
    }
    // Mirrors the server rule. Caught here too so the operator sees why
    // immediately rather than after a round trip.
    if (form.surchargeType === 'MULTIPLIER' && amount < 1) {
      toast({
        title: 'A multiplier below 1 would discount the fare',
        description: 'Use 1.25 to charge a quarter more.',
        variant: 'destructive',
      });
      return;
    }

    create.mutate(
      {
        name: form.name.trim(),
        latitude,
        longitude,
        radiusMeters,
        surchargeType: form.surchargeType,
        amount,
        appliesTo: form.appliesTo,
      },
      {
        onSuccess: () => {
          toast({ title: 'Surcharge zone created' });
          setForm({
            name: '',
            latitude: '',
            longitude: '',
            radiusMeters: '3000',
            surchargeType: 'FLAT',
            amount: '',
            appliesTo: 'EITHER',
          });
        },
        onError: (error) => {
          toast({
            title: "Couldn't create the zone",
            description: error.message,
            variant: 'destructive',
          });
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a surcharge zone</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          <Input
            placeholder="Zone name, e.g. Mallam Aminu Kano International Airport"
            value={form.name}
            onChange={(event) => {
              set('name', event.target.value);
            }}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs">
              Latitude
              <Input
                inputMode="decimal"
                placeholder="12.0476"
                value={form.latitude}
                onChange={(event) => {
                  set('latitude', event.target.value);
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Longitude
              <Input
                inputMode="decimal"
                placeholder="8.5246"
                value={form.longitude}
                onChange={(event) => {
                  set('longitude', event.target.value);
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Radius (metres)
              <Input
                inputMode="numeric"
                value={form.radiusMeters}
                onChange={(event) => {
                  set('radiusMeters', event.target.value);
                }}
              />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs">
              Surcharge type
              <select
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                value={form.surchargeType}
                onChange={(event) => {
                  set('surchargeType', event.target.value);
                }}
              >
                <option value="FLAT">Flat amount (₦)</option>
                <option value="MULTIPLIER">Multiplier (× metered fare)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              {form.surchargeType === 'FLAT' ? 'Amount (₦)' : 'Multiplier (1.25 = +25%)'}
              <Input
                inputMode="decimal"
                placeholder={form.surchargeType === 'FLAT' ? '1500' : '1.25'}
                value={form.amount}
                onChange={(event) => {
                  set('amount', event.target.value);
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Applies to
              <select
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                value={form.appliesTo}
                onChange={(event) => {
                  set('appliesTo', event.target.value);
                }}
              >
                <option value="EITHER">Trips either way</option>
                <option value="DROPOFF">Trips ending here</option>
                <option value="PICKUP">Trips starting here</option>
              </select>
            </label>
          </div>
          <Button onClick={onSubmit} disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create zone'}
          </Button>
          <p className="text-muted-foreground text-xs">
            Where two zones overlap, only the one that adds the most is applied — a passenger
            crossing both is never charged twice for one journey.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ZoneList(): React.JSX.Element {
  const zones = useRideSurchargeZones();
  const update = useUpdateRideSurchargeZone();

  if (zones.isLoading) return <LoadingSpinner />;
  if (zones.isError) {
    return <EmptyState title="Couldn't load surcharge zones" description={zones.error.message} />;
  }

  const list = zones.data ?? [];
  if (list.length === 0) {
    return (
      <EmptyState
        title="No surcharge zones"
        description="Every trip is priced from the fare table alone. Add a zone above to charge more for airport runs."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Surcharge zones</CardTitle>
      </CardHeader>
      <CardContent>
        {list.map((zone) => (
          <div
            key={zone.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0"
          >
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{zone.name}</p>
                <Badge variant={zone.active ? 'default' : 'outline'}>
                  {zone.active ? 'Active' : 'Off'}
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs">
                {describeAmount(zone)} · {TRIGGER_LABEL[zone.appliesTo]} · {zone.radiusMeters} m
                around {zone.latitude.toFixed(4)}, {zone.longitude.toFixed(4)}
              </p>
            </div>
            <Button
              variant="outline"
              disabled={update.isPending}
              onClick={() => {
                update.mutate(
                  { id: zone.id, body: { active: !zone.active } },
                  {
                    onSuccess: () => {
                      toast({
                        title: zone.active ? 'Zone switched off' : 'Zone switched on',
                        description: 'Applies to new trips only.',
                      });
                    },
                    onError: (error) => {
                      toast({
                        title: "Couldn't update the zone",
                        description: error.message,
                        variant: 'destructive',
                      });
                    },
                  },
                );
              }}
            >
              {zone.active ? 'Switch off' : 'Switch on'}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function PricingPage(): React.JSX.Element {
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Ride pricing</h1>
          <p className="text-muted-foreground text-sm">
            Fares used to be hardcoded — changing a price meant a deploy. Every change here is
            recorded against the operator who made it.
          </p>
        </div>
        <FareTable />
        <CreateZoneForm />
        <ZoneList />
      </div>
    </AppShell>
  );
}
