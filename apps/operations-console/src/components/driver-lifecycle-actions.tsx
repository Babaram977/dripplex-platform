'use client';

import { Button, Textarea, toast } from '@dripplex/ui';
import * as React from 'react';

import type { DriverProfileDto } from '@dripplex/types';

import {
  useApproveDriver,
  useReactivateDriver,
  useRejectDriver,
  useSuspendDriver,
} from '@/hooks/use-driver-approvals';

interface DriverLifecycleActionsProps {
  driver: DriverProfileDto;
}

/** A button that collects a required reason before firing its mutation. */
function ReasonAction({
  label,
  placeholder,
  pending,
  onConfirm,
}: {
  label: string;
  placeholder: string;
  pending: boolean;
  onConfirm: (reason: string) => void;
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');

  if (!open) {
    return (
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => {
          setOpen(true);
        }}
      >
        {label}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={reason}
        placeholder={placeholder}
        onChange={(event) => {
          setReason(event.target.value);
        }}
      />
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => {
            if (reason.trim().length < 5) {
              toast({
                title: 'A reason of at least 5 characters is required',
                variant: 'destructive',
              });
              return;
            }
            onConfirm(reason.trim());
          }}
        >
          Confirm {label.toLowerCase()}
        </Button>
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setReason('');
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function DriverLifecycleActions({ driver }: DriverLifecycleActionsProps): React.JSX.Element {
  const driverId = driver.driverId;
  const approve = useApproveDriver(driverId);
  const reject = useRejectDriver(driverId);
  const suspend = useSuspendDriver(driverId);
  const reactivate = useReactivateDriver(driverId);

  const fail = (title: string) => (error: Error) => {
    toast({ title, description: error.message, variant: 'destructive' });
  };

  if (driver.status === 'APPROVED') {
    return (
      <ReasonAction
        label="Suspend driver"
        placeholder="Reason for suspension (min 5 characters)"
        pending={suspend.isPending}
        onConfirm={(reason) => {
          suspend.mutate(reason, {
            onSuccess: () => {
              toast({ title: 'Driver suspended' });
            },
            onError: fail("Couldn't suspend driver"),
          });
        }}
      />
    );
  }

  if (driver.status === 'SUSPENDED') {
    return (
      <Button
        disabled={reactivate.isPending}
        onClick={() => {
          reactivate.mutate(undefined, {
            onSuccess: () => {
              toast({ title: 'Driver reactivated' });
            },
            onError: fail("Couldn't reactivate driver"),
          });
        }}
      >
        Reactivate driver
      </Button>
    );
  }

  // PENDING / UNDER_REVIEW / REJECTED — reviewable.
  return (
    <div className="flex flex-col gap-3">
      <Button
        disabled={approve.isPending}
        onClick={() => {
          approve.mutate(undefined, {
            onSuccess: () => {
              toast({ title: 'Driver approved' });
            },
            onError: fail("Couldn't approve driver"),
          });
        }}
      >
        Approve driver
      </Button>
      <ReasonAction
        label="Reject driver"
        placeholder="Reason for rejection (min 5 characters)"
        pending={reject.isPending}
        onConfirm={(reason) => {
          reject.mutate(reason, {
            onSuccess: () => {
              toast({ title: 'Driver rejected' });
            },
            onError: fail("Couldn't reject driver"),
          });
        }}
      />
      <p className="text-muted-foreground text-xs">
        Approval runs the full activation gate (identity, documents, vehicle, inspection,
        agreement). If any check fails, approval is blocked with the reason.
      </p>
    </div>
  );
}
