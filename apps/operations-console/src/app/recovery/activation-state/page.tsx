'use client';

import { Badge, Card, CardContent, CardHeader, CardTitle, LoadingSpinner } from '@dripplex/ui';
import * as React from 'react';

import { AppShell } from '@/components/app-shell';
import { useRecoveryActivationState } from '@/hooks/use-recovery-activation-state';

/**
 * DPX-ORDER-8D-RECOVERY — the operator's answer to "is the platform about to
 * cancel orders and move money by itself?"
 *
 * VISIBILITY ONLY. There is no arm, disarm, run-now, cancel, refund, reverse or
 * recognise control here, and there must not be. The activation boundary is a
 * code constant (`RECOVERY_ACTIVATION_AT`) changed only by reviewed deployment —
 * deliberately, so that no runtime surface can move a financial safety boundary.
 * A button on this page would defeat the entire reason the boundary lives in
 * code.
 *
 * AN ERROR IS NOT "OFF". If the request fails, this says so rather than
 * rendering the safe-looking state. "We could not ask" and "the backstop is
 * disarmed" are different facts, and showing the second when the first is true
 * is how an operator ends up reassured about something nobody checked.
 */
export default function RecoveryActivationStatePage(): React.JSX.Element {
  const query = useRecoveryActivationState();

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Automatic Recovery</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Whether the 24-hour backstop is armed. When it is, DrippleX can cancel a stalled order
            and reverse a DX Wallet payment without a person asking.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Activation state</CardTitle>
          </CardHeader>
          <CardContent>
            {query.isPending ? (
              <LoadingSpinner />
            ) : query.isError ? (
              <div className="flex flex-col gap-2">
                <Badge variant="outline">Unknown</Badge>
                <p className="text-sm font-medium">Couldn&apos;t read the activation state</p>
                <p className="text-muted-foreground text-sm">
                  This is not the same as the backstop being off — the platform could not be asked.
                  Do not treat this as confirmation that automatic recovery is disabled.
                </p>
              </div>
            ) : (
              <dl className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground text-sm">Automatic Recovery</dt>
                  <dd>
                    <Badge variant={query.data.activated ? 'accent' : 'secondary'}>
                      {query.data.activated ? 'ON' : 'OFF'}
                    </Badge>
                  </dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground text-sm">Activation boundary</dt>
                  <dd className="font-mono text-sm">{query.data.activationAt ?? 'Not set'}</dd>
                </div>
              </dl>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
