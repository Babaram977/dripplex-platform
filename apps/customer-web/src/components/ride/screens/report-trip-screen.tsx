'use client';

import * as React from 'react';

import { ActionButton, RideHeader } from '../ride-ui';

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

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <RideHeader onBack={onBack} title="Report an Issue" />
      <div className="flex-1 overflow-y-auto px-5">
        {CATEGORIES.map((issue) => (
          <button
            key={issue.id}
            type="button"
            onClick={() => {
              setCategory(issue.id);
            }}
            className="mb-2 flex w-full items-center gap-3 rounded-xl p-3.5 text-left"
            style={{
              background: category === issue.id ? 'rgba(34,197,94,.08)' : '#0D1B2E',
              border:
                category === issue.id ? '1.5px solid #47CF72' : '1px solid rgba(255,255,255,.08)',
            }}
          >
            <span style={{ fontSize: 16 }}>{issue.icon}</span>
            <p className="text-[14px]" style={{ fontFamily: "'Inter',sans-serif", color: '#fff' }}>
              {issue.label}
            </p>
          </button>
        ))}
        <textarea
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
          }}
          placeholder="Describe what happened..."
          rows={4}
          className="mt-2 w-full resize-none rounded-2xl px-4 py-3 outline-none"
          style={{
            background: '#112238',
            border: '1px solid rgba(255,255,255,.08)',
            fontFamily: "'Inter',sans-serif",
            fontSize: 14,
            color: '#fff',
          }}
        />
        {reportProblem.isError ? (
          <p
            className="mt-3 text-[13px]"
            style={{ fontFamily: "'Inter',sans-serif", color: '#EF4444' }}
          >
            Couldn&apos;t submit the report. Try again.
          </p>
        ) : null}
      </div>
      <div className="px-5 pb-8 pt-3">
        <ActionButton
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
