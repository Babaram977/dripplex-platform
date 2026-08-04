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
  Label,
  LoadingSpinner,
  Select,
  toast,
} from '@dripplex/ui';
import * as React from 'react';

import { AppShell } from '@/components/app-shell';
import {
  useEndBreak,
  useEndShift,
  useShiftHistory,
  useShiftSummary,
  useStartBreak,
  useStartShift,
} from '@/hooks/use-driver-shift';
import {
  useCreatePlannedAvailability,
  useDeletePlannedAvailability,
  usePlannedAvailability,
} from '@/hooks/use-planned-availability';

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatHoursMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${String(minutes)}m`;
  return `${String(hours)}h ${String(minutes)}m`;
}

function minutesToTimeInput(minute: number): string {
  const hours = Math.floor(minute / 60);
  const mins = minute % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function timeInputToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Driver Slice 2 item 6 — Shift Management (founder-approved 2026-08-04,
 * safety scope added on approval of item 5): Start Shift/End Shift, break
 * mode, planned availability, and advisory (non-blocking) safety figures —
 * continuous driving time, today's total, break reminder, daily-limit and
 * fatigue warnings. Deliberately independent of the online/offline toggle
 * on the dashboard (that stays the real-time dispatch flag; a shift is a
 * separate work-session concept — see DRIVER-SLICE-2-AUDIT.md). */
export default function ShiftPage(): React.JSX.Element {
  const summary = useShiftSummary();
  const history = useShiftHistory();
  const startShift = useStartShift();
  const startBreak = useStartBreak();
  const endBreak = useEndBreak();
  const endShift = useEndShift();

  const plannedAvailability = usePlannedAvailability();
  const createEntry = useCreatePlannedAvailability();
  const deleteEntry = useDeletePlannedAvailability();

  const [dayOfWeek, setDayOfWeek] = React.useState('1');
  const [startTime, setStartTime] = React.useState('09:00');
  const [endTime, setEndTime] = React.useState('17:00');

  const onMutationError = (label: string) => () => {
    toast({ title: `Couldn't ${label}`, description: 'Please try again.', variant: 'destructive' });
  };

  const activeShift = summary.data?.activeShift ?? null;
  const isOnBreak = activeShift?.status === 'ON_BREAK';
  const isActive = activeShift?.status === 'ACTIVE';

  const onAddPlannedAvailability = (event: React.SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const startMinute = timeInputToMinutes(startTime);
    const endMinute = timeInputToMinutes(endTime);
    if (startMinute === null || endMinute === null || endMinute <= startMinute) {
      toast({
        title: "Couldn't add availability",
        description: 'End time must be after start time.',
        variant: 'destructive',
      });
      return;
    }
    createEntry.mutate(
      { dayOfWeek: Number(dayOfWeek), startMinute, endMinute },
      { onError: onMutationError('add availability') },
    );
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Shift</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Track your work session, take breaks, and let Operations see your planned schedule.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Current shift</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {summary.isLoading ? (
              <div className="flex justify-center py-4">
                <LoadingSpinner />
              </div>
            ) : summary.isError ? (
              <p className="text-destructive text-sm">
                Couldn&apos;t load your shift status. Safety reminders may not show until this loads
                — check your connection and try again.
              </p>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Badge variant={activeShift ? (isOnBreak ? 'outline' : 'success') : 'outline'}>
                    {activeShift ? activeShift.status.replace('_', ' ') : 'NOT STARTED'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Continuous driving</p>
                    <p className="font-medium">
                      {formatHoursMinutes(summary.data?.continuousDrivingMinutes ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total today</p>
                    <p className="font-medium">
                      {formatHoursMinutes(summary.data?.totalMinutesToday ?? 0)}
                    </p>
                  </div>
                </div>

                {summary.data?.breakReminderDue ? (
                  <div className="border-promotion/40 bg-promotion/10 rounded-md border p-3 text-sm">
                    You&apos;ve been driving a while — consider taking a break.
                  </div>
                ) : null}
                {summary.data?.fatigueWarning ? (
                  <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-3 text-sm">
                    Extended continuous driving detected. Please take a break when you can.
                  </div>
                ) : null}
                {summary.data?.dailyLimitExceeded ? (
                  <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-3 text-sm">
                    You&apos;ve exceeded the recommended daily driving hours today.
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {!activeShift ? (
                    <Button
                      type="button"
                      disabled={startShift.isPending}
                      onClick={() => {
                        startShift.mutate(undefined, { onError: onMutationError('start shift') });
                      }}
                    >
                      Start shift
                    </Button>
                  ) : null}
                  {isActive ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={startBreak.isPending}
                      onClick={() => {
                        startBreak.mutate(undefined, { onError: onMutationError('start break') });
                      }}
                    >
                      Start break
                    </Button>
                  ) : null}
                  {isOnBreak ? (
                    <Button
                      type="button"
                      disabled={endBreak.isPending}
                      onClick={() => {
                        endBreak.mutate(undefined, { onError: onMutationError('end break') });
                      }}
                    >
                      End break
                    </Button>
                  ) : null}
                  {activeShift ? (
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={endShift.isPending}
                      onClick={() => {
                        endShift.mutate(undefined, { onError: onMutationError('end shift') });
                      }}
                    >
                      End shift
                    </Button>
                  ) : null}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-3 text-lg font-semibold tracking-tight">Planned availability</h2>
          <p className="text-muted-foreground mb-3 text-sm">
            Let Operations know when you typically plan to be online. This is informational only —
            it doesn&apos;t automatically take you online or offline.
          </p>

          <Card className="mb-3">
            <CardContent className="pt-6">
              <form
                onSubmit={onAddPlannedAvailability}
                className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end"
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="planned-day">Day</Label>
                  <Select
                    id="planned-day"
                    value={dayOfWeek}
                    onChange={(event) => {
                      setDayOfWeek(event.target.value);
                    }}
                  >
                    {DAY_LABELS.map((label, index) => (
                      <option key={label} value={index}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="planned-start">From</Label>
                  <Input
                    id="planned-start"
                    type="time"
                    value={startTime}
                    onChange={(event) => {
                      setStartTime(event.target.value);
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="planned-end">To</Label>
                  <Input
                    id="planned-end"
                    type="time"
                    value={endTime}
                    onChange={(event) => {
                      setEndTime(event.target.value);
                    }}
                  />
                </div>
                <Button type="submit" disabled={createEntry.isPending}>
                  Add
                </Button>
              </form>
            </CardContent>
          </Card>

          {!plannedAvailability.isLoading && (plannedAvailability.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="No planned availability yet"
              description="Add windows above so Operations can see your typical schedule."
            />
          ) : null}

          <div className="flex flex-col gap-2">
            {(plannedAvailability.data ?? []).map((entry) => (
              <div
                key={entry.id}
                className="border-border/70 flex items-center justify-between rounded-md border p-3 text-sm"
              >
                <span>
                  {DAY_LABELS[entry.dayOfWeek]} — {minutesToTimeInput(entry.startMinute)} to{' '}
                  {minutesToTimeInput(entry.endMinute)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={deleteEntry.isPending}
                  onClick={() => {
                    deleteEntry.mutate(entry.id, { onError: onMutationError('remove entry') });
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold tracking-tight">Shift history</h2>
          {!history.isLoading && (history.data?.length ?? 0) === 0 ? (
            <EmptyState title="No shifts yet" description="Your past shifts will show up here." />
          ) : null}
          <div className="flex flex-col gap-2">
            {(history.data ?? []).slice(0, 10).map((shift) => (
              <div
                key={shift.id}
                className="border-border/70 flex items-center justify-between rounded-md border p-3 text-sm"
              >
                <span>{new Date(shift.startedAt).toLocaleString('en-NG')}</span>
                <Badge variant={shift.status === 'ENDED' ? 'outline' : 'success'}>
                  {shift.status.replace('_', ' ')}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
