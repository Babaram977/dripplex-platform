'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  LoadingSpinner,
  Select,
  Textarea,
  toast,
} from '@dripplex/ui';
import * as React from 'react';

import type { VehicleApprovalStatus, VehicleDto } from '@dripplex/types';

import { AppShell } from '@/components/app-shell';
import {
  useApproveVehicle,
  useRejectVehicle,
  useVehicleApprovals,
} from '@/hooks/use-vehicle-approvals';

const STATUS_OPTIONS: { value: VehicleApprovalStatus | 'ALL'; label: string }[] = [
  { value: 'PENDING', label: 'Pending approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ALL', label: 'All vehicles' },
];

function statusBadgeVariant(status: VehicleApprovalStatus): 'success' | 'outline' {
  return status === 'APPROVED' ? 'success' : 'outline';
}

function VehicleRow({ vehicle }: { vehicle: VehicleDto }): React.JSX.Element {
  const approve = useApproveVehicle();
  const reject = useRejectVehicle();
  const [rejecting, setRejecting] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const pending = approve.isPending || reject.isPending;

  const onApprove = (): void => {
    approve.mutate(vehicle.id, {
      onSuccess: () => {
        toast({ title: 'Vehicle approved' });
      },
      onError: (error) => {
        toast({
          title: "Couldn't approve vehicle",
          description: error.message,
          variant: 'destructive',
        });
      },
    });
  };

  const onReject = (): void => {
    if (reason.trim().length < 3) {
      toast({ title: 'A rejection reason is required', variant: 'destructive' });
      return;
    }
    reject.mutate(
      { id: vehicle.id, reason: reason.trim() },
      {
        onSuccess: () => {
          toast({ title: 'Vehicle rejected' });
          setRejecting(false);
          setReason('');
        },
        onError: (error) => {
          toast({
            title: "Couldn't reject vehicle",
            description: error.message,
            variant: 'destructive',
          });
        },
      },
    );
  };

  return (
    <div className="border-border/70 flex flex-col gap-2 rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">
            {vehicle.make} {vehicle.model} · {vehicle.year}
          </p>
          <p className="text-muted-foreground text-xs">
            {vehicle.plateNumber} · {vehicle.color} · {vehicle.rideCategory}
            {vehicle.seats !== null ? ` · ${String(vehicle.seats)} seats` : ''}
          </p>
        </div>
        <Badge variant={statusBadgeVariant(vehicle.approvalStatus)}>{vehicle.approvalStatus}</Badge>
      </div>

      {vehicle.rejectedReason !== null ? (
        <p className="text-muted-foreground text-xs">Reason: {vehicle.rejectedReason}</p>
      ) : null}

      {vehicle.approvalStatus === 'PENDING' ? (
        rejecting ? (
          <div className="flex flex-col gap-2">
            <Textarea
              value={reason}
              placeholder="Reason for rejection (min 3 characters)"
              onChange={(event) => {
                setReason(event.target.value);
              }}
            />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={pending} onClick={onReject}>
                Confirm reject
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setRejecting(false);
                  setReason('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" disabled={pending} onClick={onApprove}>
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setRejecting(true);
              }}
            >
              Reject
            </Button>
          </div>
        )
      ) : null}
    </div>
  );
}

export default function VehicleApprovalsPage(): React.JSX.Element {
  const [status, setStatus] = React.useState<VehicleApprovalStatus | 'ALL'>('PENDING');
  const query = useVehicleApprovals(status === 'ALL' ? undefined : status);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Vehicle Approvals
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Review driver-submitted vehicles and approve or reject them. A driver can&apos;t be
              activated until their vehicle is approved.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="vehicle-status-filter" className="text-muted-foreground text-xs">
              Filter
            </label>
            <Select
              id="vehicle-status-filter"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as VehicleApprovalStatus | 'ALL');
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

        <Card>
          <CardHeader>
            <CardTitle>Vehicles</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {query.isLoading ? <LoadingSpinner /> : null}
            {query.data?.items.length === 0 ? (
              <EmptyState
                title="No vehicles in this queue"
                description="Nothing to review for the selected status."
              />
            ) : null}
            {query.data?.items.map((vehicle) => (
              <VehicleRow key={vehicle.id} vehicle={vehicle} />
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
