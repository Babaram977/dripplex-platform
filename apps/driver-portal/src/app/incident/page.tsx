'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Label,
  LoadingSpinner,
  Select,
  Textarea,
  toast,
} from '@dripplex/ui';
import * as React from 'react';

import type { IncidentCategory, IncidentReportDto, IncidentSeverity } from '@dripplex/types';

import { AppShell } from '@/components/app-shell';
import { useActiveRide } from '@/hooks/rides/use-active-ride';
import { useCurrentLocation } from '@/hooks/rides/use-current-location';
import { useCreateIncidentReport, useIncidentReports } from '@/hooks/use-incident-reports';
import { formatDateTime } from '@/lib/format';

const CATEGORY_LABEL: Record<IncidentCategory, string> = {
  ACCIDENT: 'Accident',
  PASSENGER_ALTERCATION: 'Passenger altercation',
  VEHICLE_BREAKDOWN: 'Vehicle breakdown',
  SAFETY_CONCERN: 'Safety concern',
  OTHER: 'Other',
};

const SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

const STATUS_BADGE: Record<IncidentReportDto['status'], 'outline' | 'success'> = {
  OPEN: 'outline',
  ACKNOWLEDGED: 'outline',
  RESOLVED: 'success',
};

const SEVERITY_BADGE_CLASS: Record<IncidentSeverity, string> = {
  LOW: '',
  MEDIUM: '',
  HIGH: 'text-destructive border-destructive/40',
  CRITICAL: 'text-destructive border-destructive/40',
};

/** Driver Slice 2 item 4 — Incident Reporting (founder-approved
 * 2026-08-04): safety-relevant (accident, passenger altercation, vehicle
 * breakdown) — distinct from general Driver Support. Automatically
 * attaches the current active ride (if any) and the driver's current GPS
 * location when available, since both are real safety-relevant context an
 * ops reviewer needs. */
export default function IncidentPage(): React.JSX.Element {
  const activeRide = useActiveRide();
  const location = useCurrentLocation();
  const reports = useIncidentReports();
  const createReport = useCreateIncidentReport();

  const [category, setCategory] = React.useState<IncidentCategory>('SAFETY_CONCERN');
  const [severity, setSeverity] = React.useState<IncidentSeverity>('MEDIUM');
  const [description, setDescription] = React.useState('');

  const onSubmit = (event: React.SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const activeRideId =
      activeRide.data && activeRide.data.status !== 'COMPLETED' ? activeRide.data.id : undefined;
    createReport.mutate(
      {
        category,
        severity,
        description,
        ...(activeRideId !== undefined ? { rideId: activeRideId } : {}),
        ...(location.latitude !== null ? { latitude: location.latitude } : {}),
        ...(location.longitude !== null ? { longitude: location.longitude } : {}),
      },
      {
        onSuccess: () => {
          toast({ title: 'Incident reported', description: 'Our team will follow up in-app.' });
          setDescription('');
          setCategory('SAFETY_CONCERN');
          setSeverity('MEDIUM');
        },
        onError: () => {
          toast({
            title: "Couldn't submit report",
            description: 'Please try again.',
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
          <h1 className="font-display text-2xl font-semibold tracking-tight">Report an incident</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Accidents, passenger altercations, vehicle breakdowns, or other safety concerns. For
            general account/payout/app issues, use Support instead.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>New incident report</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="incident-category">Category</Label>
                  <Select
                    id="incident-category"
                    value={category}
                    onChange={(event) => {
                      setCategory(event.target.value as IncidentCategory);
                    }}
                  >
                    {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="incident-severity">Severity</Label>
                  <Select
                    id="incident-severity"
                    value={severity}
                    onChange={(event) => {
                      setSeverity(event.target.value as IncidentSeverity);
                    }}
                  >
                    {Object.entries(SEVERITY_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="incident-description">What happened?</Label>
                <Textarea
                  id="incident-description"
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                  }}
                  minLength={10}
                  maxLength={2000}
                  rows={4}
                  required
                />
              </div>
              <p className="text-muted-foreground text-xs">
                {activeRide.data && activeRide.data.status !== 'COMPLETED'
                  ? 'This will be linked to your active trip.'
                  : "Not linked to a trip — you're not currently on one."}{' '}
                {location.status === 'ready'
                  ? 'Your current location will be included.'
                  : "Your current location isn't available and won't be included."}
              </p>
              <Button
                type="submit"
                variant="destructive"
                disabled={createReport.isPending}
                className="w-fit"
              >
                Submit report
              </Button>
            </form>
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-3 text-lg font-semibold tracking-tight">Your reports</h2>

          {reports.isLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : null}

          {!reports.isLoading && (reports.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="No reports yet"
              description="Anything you report will show up here with our response."
            />
          ) : null}

          <div className="flex flex-col gap-3">
            {(reports.data ?? []).map((report) => (
              <Card key={report.id}>
                <CardContent className="flex flex-col gap-2 pt-6">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{CATEGORY_LABEL[report.category]}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatDateTime(report.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={SEVERITY_BADGE_CLASS[report.severity]}>
                        {SEVERITY_LABEL[report.severity]}
                      </Badge>
                      <Badge variant={STATUS_BADGE[report.status]}>{report.status}</Badge>
                    </div>
                  </div>
                  <p className="text-sm">{report.description}</p>
                  {report.adminNotes ? (
                    <div className="border-border/70 bg-muted/40 rounded-md border p-2 text-sm">
                      <p className="text-muted-foreground text-xs font-medium">DrippleX Ops</p>
                      <p>{report.adminNotes}</p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
