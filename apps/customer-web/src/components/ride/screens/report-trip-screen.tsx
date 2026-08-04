'use client';

import {
  SuperAppRideActionButton,
  SuperAppRideHeader,
  SuperAppRideOptionRow,
  SuperAppRideTextarea,
  useSuperAppFonts,
} from '@dripplex/ui';
import * as React from 'react';

import type { RideProblemCategory } from '@dripplex/types';

import { useReportRideProblem } from '@/hooks/rides';

/**
 * Real source listed 7 freeform categories including "Wrong route" and
 * "Cancelled by driver" — neither maps to a real RideProblemCategory (the
 * backend has WRONG_FARE/DRIVER_BEHAVIOUR/UNSAFE_DRIVING/LOST_ITEM/
 * VEHICLE_ISSUE/OTHER only, and "cancelled by driver" isn't a problem
 * report at all, it's a ride-cancellation reason already captured
 * elsewhere). Dropped rather than mapped to something they don't mean. No
 * photo attachment either — ReportRideProblemRequest has no such field.
 */
const CATEGORIES: { id: RideProblemCategory; icon: string; label: string }[] = [
  { id: 'UNSAFE_DRIVING', icon: '🚨', label: 'Unsafe driving' },
  { id: 'WRONG_FARE', icon: '💰', label: 'Wrong fare' },
  { id: 'DRIVER_BEHAVIOUR', icon: '🚗', label: 'Driver behaviour' },
  { id: 'LOST_ITEM', icon: '📦', label: 'Lost item' },
  { id: 'VEHICLE_ISSUE', icon: '🔧', label: 'Vehicle issue' },
  { id: 'OTHER', icon: '❓', label: 'Other' },
];

export function ReportTripScreen({
  rideId,
  onBack,
  onSubmit,
}: {
  rideId: string;
  onBack: () => void;
  onSubmit: () => void;
}): React.JSX.Element {
  const [category, setCategory] = React.useState<RideProblemCategory | null>(null);
  const [description, setDescription] = React.useState('');
  const reportProblem = useReportRideProblem();
  const { body } = useSuperAppFonts();

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <SuperAppRideHeader onBack={onBack} title="Report an Issue" />
      <div className="flex-1 overflow-y-auto px-5">
        {CATEGORIES.map((issue) => (
          <SuperAppRideOptionRow
            key={issue.id}
            icon={issue.icon}
            label={issue.label}
            selected={category === issue.id}
            onClick={() => {
              setCategory(issue.id);
            }}
          />
        ))}
        <div className="mt-2">
          <SuperAppRideTextarea
            value={description}
            onChange={setDescription}
            placeholder="Describe what happened..."
            rows={4}
          />
        </div>
        {reportProblem.isError ? (
          <p className={`mt-3 text-[13px] ${body}`} style={{ color: '#EF4444' }}>
            Couldn&apos;t submit the report. Try again.
          </p>
        ) : null}
      </div>
      <div className="px-5 pb-8 pt-3">
        <SuperAppRideActionButton
          label="Submit Report"
          disabled={!category}
          loading={reportProblem.isPending}
          onClick={() => {
            if (!category) return;
            reportProblem.mutate(
              {
                rideId,
                body: {
                  category,
                  ...(description.trim() ? { description: description.trim() } : {}),
                },
              },
              { onSuccess: onSubmit },
            );
          }}
        />
      </div>
    </div>
  );
}
