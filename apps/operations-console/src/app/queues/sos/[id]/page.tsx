'use client';

import { Card, CardContent, CardHeader, CardTitle, EmptyState, LoadingSpinner } from '@dripplex/ui';
import { formatDate } from '@dripplex/utils';
import { useParams } from 'next/navigation';
import * as React from 'react';

import { AppShell } from '@/components/app-shell';
import { CaseControls } from '@/components/case-controls';
import { CaseNoteForm } from '@/components/case-note-form';
import { CaseTimeline } from '@/components/case-timeline';
import { LifecycleStatusBadge } from '@/components/lifecycle-status-badge';
import { PriorityBadge } from '@/components/priority-badge';
import { useCaseDetail } from '@/hooks/use-operations-case';

/** DPX-OPS-001 Slice 2 — SOS case detail. Founder's own scope: active
 * alert, priority ordering, acknowledge (via the Status control moving
 * off New/Assigned), assign operator, incident timeline, resolve, audit
 * trail (the timeline itself). */
export default function SosCaseDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const query = useCaseDetail(params.id);
  const kase = query.data?.caseType === 'SOS' ? query.data : undefined;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {query.isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner label="Loading SOS alert…" />
          </div>
        ) : null}

        {query.isError ? (
          <EmptyState
            title="Couldn't load this SOS alert"
            description="Check your connection and try again."
          />
        ) : null}

        {kase ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-3xl font-semibold tracking-tight">
                  {kase.driverName}
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">
                  SOS triggered{' '}
                  {formatDate(kase.createdAt, 'en-NG', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {kase.driverPhone ? ` · ${kase.driverPhone}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <PriorityBadge priority={kase.priority} />
                <LifecycleStatusBadge status={kase.status} />
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Alert details</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <DetailRow
                  label="Location"
                  value={
                    kase.latitude !== null && kase.longitude !== null
                      ? `${kase.latitude.toFixed(4)}, ${kase.longitude.toFixed(4)}`
                      : 'No location on file'
                  }
                />
                <DetailRow
                  label="Battery level"
                  value={kase.batteryLevel !== null ? `${String(kase.batteryLevel)}%` : 'Unknown'}
                />
                <DetailRow label="Active ride" value={kase.rideId ?? 'No active ride'} />
                <DetailRow label="Vehicle on file" value={kase.vehicleId ?? 'None'} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Respond</CardTitle>
              </CardHeader>
              <CardContent>
                <CaseControls kase={kase} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <CaseTimeline events={kase.events} />
                <CaseNoteForm caseId={kase.caseId} />
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}

function DetailRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
