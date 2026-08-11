'use client';

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  LoadingSpinner,
} from '@dripplex/ui';
import { useParams } from 'next/navigation';
import * as React from 'react';

import { AppShell } from '@/components/app-shell';
import { InspectionActions } from '@/components/inspection-actions';
import { useInspection } from '@/hooks/use-inspections';

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function InspectionReviewPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const inspectionId = params.id;
  const inspectionQuery = useInspection(inspectionId);
  const inspection = inspectionQuery.data;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {inspectionQuery.isLoading ? <LoadingSpinner /> : null}
        {inspectionQuery.isError ? (
          <EmptyState
            title="Inspection not found"
            description="This inspection could not be loaded."
          />
        ) : null}

        {inspection ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl font-semibold tracking-tight">Inspection</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                  Scheduled {formatDate(inspection.scheduledAt)}
                </p>
              </div>
              <Badge variant={inspection.status === 'PASSED' ? 'success' : 'outline'}>
                {inspection.status}
              </Badge>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>{inspection.status}</dd>
                  <dt className="text-muted-foreground">Driver</dt>
                  <dd className="font-mono text-xs">{inspection.driverId}</dd>
                  <dt className="text-muted-foreground">Vehicle</dt>
                  <dd className="font-mono text-xs">{inspection.vehicleId}</dd>
                  <dt className="text-muted-foreground">Centre</dt>
                  <dd className="font-mono text-xs">{inspection.centreId}</dd>
                  <dt className="text-muted-foreground">Completed</dt>
                  <dd>{formatDate(inspection.completedAt)}</dd>
                  {inspection.notes ? (
                    <>
                      <dt className="text-muted-foreground">Notes</dt>
                      <dd>{inspection.notes}</dd>
                    </>
                  ) : null}
                </dl>
              </CardContent>
            </Card>

            {inspection.checklist && inspection.checklist.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Recorded checklist</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="divide-border/70 border-border/70 divide-y rounded-md border">
                    {inspection.checklist.map((item) => (
                      <li
                        key={item.key}
                        className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                      >
                        <span>{item.label}</span>
                        <Badge variant={item.passed ? 'success' : 'outline'}>
                          {item.passed ? 'Pass' : 'Fail'}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Inspection decision</CardTitle>
              </CardHeader>
              <CardContent>
                <InspectionActions inspection={inspection} />
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
