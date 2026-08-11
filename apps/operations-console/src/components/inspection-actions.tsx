'use client';

import { Button, Textarea, toast } from '@dripplex/ui';
import * as React from 'react';

import type { InspectionChecklistItem, InspectionDto } from '@dripplex/types';

import { useDecideInspection, useRecordChecklist } from '@/hooks/use-inspections';

interface InspectionActionsProps {
  inspection: InspectionDto;
}

/** Baseline checklist categories from DPX-DRIVER-002-INSPECTION-STANDARD.md
 * (§ "Structured checklist"). Not invented — the standard enumerates these
 * driver-side and vehicle-side items, each a pass/fail with an optional note. */
const BASELINE_CHECKLIST: { key: string; label: string }[] = [
  { key: 'identity_match', label: 'Physical identity match' },
  { key: 'facial_verification', label: 'Facial verification' },
  { key: 'licence_presented', label: 'Original licence presented' },
  { key: 'professional_appearance', label: 'Professional appearance' },
  { key: 'exterior_condition', label: 'Exterior condition' },
  { key: 'interior_cleanliness', label: 'Interior cleanliness' },
  { key: 'air_conditioning', label: 'Air conditioning' },
  { key: 'seat_belts', label: 'Seat belts' },
  { key: 'brakes', label: 'Brakes' },
  { key: 'tires', label: 'Tires' },
  { key: 'lights', label: 'Lights' },
  { key: 'horn', label: 'Horn' },
  { key: 'mirrors', label: 'Mirrors' },
  { key: 'windshield', label: 'Windshield' },
  { key: 'engine', label: 'Engine' },
  { key: 'suspension', label: 'Suspension' },
  { key: 'fire_extinguisher', label: 'Fire extinguisher' },
  { key: 'first_aid_kit', label: 'First aid kit' },
  { key: 'spare_tire', label: 'Spare tire' },
  { key: 'jack_and_spanner', label: 'Jack & wheel spanner' },
  { key: 'branding', label: 'Branding (if applicable)' },
];

const fail =
  (title: string) =>
  (error: Error): void => {
    toast({ title, description: error.message, variant: 'destructive' });
  };

/** Officer step — record a pass/fail against each baseline checklist item. */
function ChecklistForm({ inspection }: InspectionActionsProps): React.JSX.Element {
  const record = useRecordChecklist(inspection.id);
  const existing = React.useMemo(() => {
    const map = new Map<string, boolean>();
    for (const item of inspection.checklist ?? []) {
      map.set(item.key, item.passed);
    }
    return map;
  }, [inspection.checklist]);

  const [passed, setPassed] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const item of BASELINE_CHECKLIST) {
      initial[item.key] = existing.get(item.key) ?? true;
    }
    return initial;
  });
  const [notes, setNotes] = React.useState(inspection.notes ?? '');

  const onSave = (): void => {
    const checklist: InspectionChecklistItem[] = BASELINE_CHECKLIST.map((item) => ({
      key: item.key,
      label: item.label,
      passed: passed[item.key] ?? true,
    }));
    record.mutate(
      { checklist, notes: notes.trim() || undefined },
      {
        onSuccess: () => {
          toast({ title: 'Checklist recorded' });
        },
        onError: fail("Couldn't record checklist"),
      },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-border/70 border-border/70 divide-y rounded-md border">
        {BASELINE_CHECKLIST.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <span>{item.label}</span>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={passed[item.key] ?? true}
                onChange={(event) => {
                  setPassed((prev) => ({ ...prev, [item.key]: event.target.checked }));
                }}
              />
              <span
                className={(passed[item.key] ?? true) ? 'text-emerald-600' : 'text-destructive'}
              >
                {(passed[item.key] ?? true) ? 'Pass' : 'Fail'}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <Textarea
        value={notes}
        placeholder="Inspection notes (optional)"
        onChange={(event) => {
          setNotes(event.target.value);
        }}
      />
      <div>
        <Button disabled={record.isPending} onClick={onSave}>
          Save checklist
        </Button>
      </div>
    </div>
  );
}

/** Supervisor step — the final pass/fail decision. */
function DecidePanel({ inspection }: InspectionActionsProps): React.JSX.Element {
  const decide = useDecideInspection(inspection.id);
  const [notes, setNotes] = React.useState('');

  const submit = (isPassed: boolean): void => {
    decide.mutate(
      { passed: isPassed, notes: notes.trim() || undefined },
      {
        onSuccess: () => {
          toast({ title: isPassed ? 'Inspection passed' : 'Inspection failed' });
        },
        onError: fail("Couldn't record decision"),
      },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={notes}
        placeholder="Decision notes (optional)"
        onChange={(event) => {
          setNotes(event.target.value);
        }}
      />
      <div className="flex gap-2">
        <Button
          disabled={decide.isPending}
          onClick={() => {
            submit(true);
          }}
        >
          Mark passed
        </Button>
        <Button
          variant="outline"
          disabled={decide.isPending}
          onClick={() => {
            submit(false);
          }}
        >
          Mark failed
        </Button>
      </div>
    </div>
  );
}

export function InspectionActions({ inspection }: InspectionActionsProps): React.JSX.Element {
  if (inspection.status !== 'SCHEDULED') {
    return (
      <p className="text-muted-foreground text-sm">
        This inspection is {inspection.status.toLowerCase()} and can no longer be changed.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-2 text-sm font-medium">Checklist</h3>
        <ChecklistForm inspection={inspection} />
      </div>
      <div className="border-t pt-4">
        <h3 className="mb-2 text-sm font-medium">Decision</h3>
        <DecidePanel inspection={inspection} />
      </div>
    </div>
  );
}
