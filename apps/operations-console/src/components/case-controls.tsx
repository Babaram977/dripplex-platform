'use client';

import { Button, Label, Select, toast } from '@dripplex/ui';
import * as React from 'react';

import type {
  OperationsCaseDetailDto,
  OperationsLifecycleStatus,
  OperationsPriority,
} from '@dripplex/types';

import { useUpdateCase } from '@/hooks/use-operations-case';
import { useAssignableStaff } from '@/hooks/use-operations-staff';

const STATUS_OPTIONS: { value: OperationsLifecycleStatus; label: string }[] = [
  { value: 'NEW', label: 'New' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'WAITING', label: 'Waiting' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

const PRIORITY_OPTIONS: { value: OperationsPriority; label: string }[] = [
  { value: 'CRITICAL', label: '🔴 Critical' },
  { value: 'HIGH', label: '🟠 High' },
  { value: 'MEDIUM', label: '🟡 Medium' },
  { value: 'LOW', label: '🟢 Low' },
];

/** DPX-OPS-001 Slice 2 — the assign/prioritize/status-change controls
 * shared across all three case-detail screens. Every change is its own
 * `PATCH /operations/cases/:id` call — the backend logs a distinct
 * timeline event per field, so this deliberately doesn't batch a "Save"
 * across multiple fields at once. */
export function CaseControls({ kase }: { kase: OperationsCaseDetailDto }): React.JSX.Element {
  const updateCase = useUpdateCase(kase.caseId);
  const staff = useAssignableStaff();
  const [assigneeSelection, setAssigneeSelection] = React.useState('');

  const onMutationError = (label: string) => () => {
    toast({ title: `Couldn't ${label}`, description: 'Please try again.', variant: 'destructive' });
  };

  const onAssign = (event: React.SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!assigneeSelection) return;
    const member = staff.data?.find((s) => s.id === assigneeSelection);
    if (!member) return;
    updateCase.mutate(
      { assignedToId: member.id, assignedToRole: member.role },
      { onError: onMutationError('assign the case') },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="case-priority">Priority</Label>
          <Select
            id="case-priority"
            value={kase.priority}
            disabled={updateCase.isPending}
            onChange={(event) => {
              updateCase.mutate(
                { priority: event.target.value as OperationsPriority },
                { onError: onMutationError('change priority') },
              );
            }}
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="case-status">Status</Label>
          <Select
            id="case-status"
            value={kase.status}
            disabled={updateCase.isPending}
            onChange={(event) => {
              updateCase.mutate(
                { status: event.target.value as OperationsLifecycleStatus },
                { onError: onMutationError('change status') },
              );
            }}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="case-assignee">
          {kase.assignedToName
            ? `Assigned to ${kase.assignedToName} (${kase.assignedToRole === 'SUPERVISOR' ? 'supervisor' : 'operator'})`
            : 'Assign to'}
        </Label>
        <form className="flex flex-wrap gap-2" onSubmit={onAssign}>
          <Select
            id="case-assignee"
            className="max-w-xs"
            value={assigneeSelection}
            disabled={staff.isLoading || updateCase.isPending}
            onChange={(event) => {
              setAssigneeSelection(event.target.value);
            }}
          >
            <option value="">Select an operator or supervisor…</option>
            {staff.data?.map((member) => (
              <option key={member.id} value={member.id}>
                {member.firstName} {member.lastName} ·{' '}
                {member.role === 'SUPERVISOR' ? 'Supervisor' : 'Operator'}
              </option>
            ))}
          </Select>
          <Button
            type="submit"
            variant="outline"
            disabled={!assigneeSelection || updateCase.isPending}
          >
            Assign
          </Button>
          {kase.assignedToId ? (
            <Button
              type="button"
              variant="ghost"
              disabled={updateCase.isPending}
              onClick={() => {
                updateCase.mutate(
                  { assignedToId: null },
                  { onError: onMutationError('unassign the case') },
                );
              }}
            >
              Unassign
            </Button>
          ) : null}
        </form>
      </div>
    </div>
  );
}
