'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  LoadingSpinner,
  toast,
} from '@dripplex/ui';
import * as React from 'react';

import type { SosAlertDto } from '@dripplex/types';

import { AppShell } from '@/components/app-shell';
import { useBatteryLevel } from '@/hooks/use-battery-level';
import { useSosAlerts, useTriggerSosAlert } from '@/hooks/use-sos-alerts';
import { formatDateTime } from '@/lib/format';

const STATUS_BADGE: Record<SosAlertDto['status'], 'outline' | 'success'> = {
  OPEN: 'outline',
  ACKNOWLEDGED: 'outline',
  RESOLVED: 'success',
};

const ARM_WINDOW_MS = 5_000;

/** Driver Slice 2 item 5 — SOS/Emergency (founder-approved 2026-08-04):
 * "DrippleX Operations first." Pressing SOS sends an immediate alert to
 * Operations with driver id, GPS, active trip, timestamp, vehicle, and
 * battery level (if available) — the backend auto-resolves the active
 * trip/vehicle, so nothing is asked of the driver here. The customer (if
 * any) is separately told assistance was requested. Two-tap confirm (press
 * once to arm, press again within 5s to send) guards against an accidental
 * tap while keeping it a true one-hand, no-typing action. Does NOT contact
 * emergency services or a personal emergency contact — deferred pending
 * country-specific legal/operational policy. */
export default function SosPage(): React.JSX.Element {
  const alerts = useSosAlerts();
  const trigger = useTriggerSosAlert();
  const batteryLevel = useBatteryLevel();

  const [armed, setArmed] = React.useState(false);
  const armTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (armTimeout.current) {
        clearTimeout(armTimeout.current);
      }
    };
  }, []);

  const disarm = (): void => {
    setArmed(false);
    if (armTimeout.current) {
      clearTimeout(armTimeout.current);
      armTimeout.current = null;
    }
  };

  const onPress = (): void => {
    if (!armed) {
      setArmed(true);
      armTimeout.current = setTimeout(disarm, ARM_WINDOW_MS);
      return;
    }

    disarm();
    trigger.mutate(
      { ...(batteryLevel !== null ? { batteryLevel } : {}) },
      {
        onSuccess: () => {
          toast({
            title: 'SOS sent',
            description: 'DrippleX Operations has been alerted.',
          });
        },
        onError: () => {
          toast({
            title: "Couldn't send SOS",
            description: 'Please try again, or call Support directly if this persists.',
            variant: 'destructive',
          });
        },
      },
    );
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Emergency assistance
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Use this only if you need help right now — an accident, a threat to your safety, or
            another emergency. DrippleX Operations is alerted immediately.
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <button
              type="button"
              onClick={onPress}
              disabled={trigger.isPending}
              className={`flex h-40 w-40 flex-col items-center justify-center rounded-full text-2xl font-bold tracking-wide text-white shadow-lg transition-transform active:scale-95 disabled:opacity-60 ${
                armed ? 'bg-destructive animate-pulse' : 'bg-destructive/90 hover:brightness-105'
              }`}
            >
              {trigger.isPending ? <LoadingSpinner /> : armed ? 'TAP AGAIN' : 'SOS'}
            </button>
            <p className="text-muted-foreground max-w-xs text-center text-sm">
              {armed
                ? 'Tap once more within 5 seconds to send the alert.'
                : 'Tap to start, then tap again to confirm and send.'}
            </p>
            {armed ? (
              <Button type="button" variant="ghost" size="sm" onClick={disarm}>
                Cancel
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-3 text-lg font-semibold tracking-tight">Your alerts</h2>

          {alerts.isLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : null}

          {!alerts.isLoading && (alerts.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="No alerts sent"
              description="Anything you send will show up here with our response."
            />
          ) : null}

          <div className="flex flex-col gap-3">
            {(alerts.data ?? []).map((alert) => (
              <Card key={alert.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                  <CardTitle className="text-sm font-medium">
                    {formatDateTime(alert.createdAt)}
                  </CardTitle>
                  <Badge variant={STATUS_BADGE[alert.status]}>{alert.status}</Badge>
                </CardHeader>
                {alert.adminNotes ? (
                  <CardContent className="pt-0">
                    <div className="border-border/70 bg-muted/40 rounded-md border p-2 text-sm">
                      <p className="text-muted-foreground text-xs font-medium">DrippleX Ops</p>
                      <p>{alert.adminNotes}</p>
                    </div>
                  </CardContent>
                ) : null}
              </Card>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
