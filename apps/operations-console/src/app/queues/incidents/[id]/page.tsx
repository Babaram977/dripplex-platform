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

const CATEGORY_LABEL: Record<string, string> = {
  ACCIDENT: 'Accident',
  PASSENGER_ALTERCATION: 'Passenger altercation',
  VEHICLE_BREAKDOWN: 'Vehicle breakdown',
  SAFETY_CONCERN: 'Safety concern',
  OTHER: 'Other',
};

/** DPX-OPS-001 Slice 2 — Incident case detail. */
export default function IncidentCaseDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const query = useCaseDetail(params.id);
  const kase = query.data?.caseType === 'INCIDENT' ? query.data : undefined;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {query.isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner label="Loading incident report…" />
          </div>
        ) : null}

        {query.isError ? (
          <EmptyState
            title="Couldn't load this incident report"
            description="Check your connection and try again."
          />
        ) : null}

        {kase ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-3xl font-semibold tracking-tight">
                  {kase.driverName} · {CATEGORY_LABEL[kase.category] ?? kase.category}
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">
                  Reported{' '}
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
                <CardTitle>Report</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <p>{kase.description}</p>
                <p className="text-muted-foreground text-xs">
                  Related ride: {kase.rideId ?? 'None'}
                </p>
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
