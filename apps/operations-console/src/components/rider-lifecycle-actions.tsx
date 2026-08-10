'use client';

import { Button, Textarea, toast } from '@dripplex/ui';
import * as React from 'react';

import type { RiderProfileDto } from '@dripplex/types';

import {
  useApproveRider,
  useReactivateRider,
  useRejectRider,
  useSuspendRider,
} from '@/hooks/use-rider-approvals';

interface RiderLifecycleActionsProps {
  rider: RiderProfileDto;
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

export function RiderLifecycleActions({ rider }: RiderLifecycleActionsProps): React.JSX.Element {
  const riderId = rider.riderId;
  const approve = useApproveRider(riderId);
  const reject = useRejectRider(riderId);
  const suspend = useSuspendRider(riderId);
  const reactivate = useReactivateRider(riderId);

  const fail = (title: string) => (error: Error) => {
    toast({ title, description: error.message, variant: 'destructive' });
  };

  if (rider.status === 'APPROVED') {
    return (
      <ReasonAction
        label="Suspend rider"
        placeholder="Reason for suspension (min 5 characters)"
        pending={suspend.isPending}
        onConfirm={(reason) => {
          suspend.mutate(reason, {
            onSuccess: () => {
              toast({ title: 'Rider suspended' });
            },
            onError: fail("Couldn't suspend rider"),
          });
        }}
      />
    );
  }

  if (rider.status === 'SUSPENDED') {
    return (
      <Button
        disabled={reactivate.isPending}
        onClick={() => {
          reactivate.mutate(undefined, {
            onSuccess: () => {
              toast({ title: 'Rider reactivated' });
            },
            onError: fail("Couldn't reactivate rider"),
          });
        }}
      >
        Reactivate rider
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
              toast({ title: 'Rider approved' });
            },
            onError: fail("Couldn't approve rider"),
          });
        }}
      >
        Approve rider
      </Button>
      <ReasonAction
        label="Reject rider"
        placeholder="Reason for rejection (min 5 characters)"
        pending={reject.isPending}
        onConfirm={(reason) => {
          reject.mutate(reason, {
            onSuccess: () => {
              toast({ title: 'Rider rejected' });
            },
            onError: fail("Couldn't reject rider"),
          });
        }}
      />
    </div>
  );
}
