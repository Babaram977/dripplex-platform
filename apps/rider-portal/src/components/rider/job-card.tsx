'use client';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, toast } from '@dripplex/ui';
import * as React from 'react';

import type { DeliverOrderDto, DeliveryJobDto, DeliveryStatus } from '@dripplex/types';

import { DeliverProofForm } from '@/components/rider/deliver-proof-form';
import {
  useAcceptJob,
  useArrivedJob,
  useConfirmCash,
  useDeliverJob,
  useFailJob,
  usePickUpJob,
  useRejectJob,
  useReturnJob,
} from '@/hooks/deliveries/use-job-actions';
import { describeSdkError } from '@/lib/sdk';

const STATUS_VARIANT: Record<DeliveryStatus, 'default' | 'secondary' | 'outline' | 'success'> = {
  PENDING: 'outline',
  ASSIGNED: 'default',
  ACCEPTED: 'secondary',
  PICKED_UP: 'secondary',
  ON_THE_WAY: 'secondary',
  ARRIVED: 'secondary',
  DELIVERED: 'success',
  FAILED: 'outline',
  RETURNED: 'outline',
  CANCELLED: 'outline',
};

function coord(lat: number, lng: number): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

export function JobCard({ job }: { job: DeliveryJobDto }): React.JSX.Element {
  const [showDeliver, setShowDeliver] = React.useState(false);

  const accept = useAcceptJob();
  const reject = useRejectJob();
  const pickUp = usePickUpJob();
  const arrived = useArrivedJob();
  const deliver = useDeliverJob();
  const confirmCash = useConfirmCash();
  const fail = useFailJob();
  const returnJob = useReturnJob();

  const onError = (error: unknown): void => {
    const described = describeSdkError(error);
    toast({ title: described.title, description: described.description, variant: 'destructive' });
  };

  const run = (
    action: () => Promise<DeliveryJobDto>,
    successTitle: string,
    onDone?: () => void,
  ): void => {
    action()
      .then(() => {
        toast({ title: successTitle });
        onDone?.();
      })
      .catch(onError);
  };

  const anyPending =
    accept.isPending ||
    reject.isPending ||
    pickUp.isPending ||
    arrived.isPending ||
    deliver.isPending ||
    confirmCash.isPending ||
    fail.isPending ||
    returnJob.isPending;

  const submitDeliver = (body: DeliverOrderDto): void => {
    run(
      () => deliver.mutateAsync({ jobId: job.id, body }),
      'Delivered',
      () => {
        setShowDeliver(false);
      },
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Order {job.orderId.slice(0, 8)}</CardTitle>
          <p className="text-muted-foreground mt-1 text-xs">Fee ₦{job.deliveryFee.toFixed(2)}</p>
        </div>
        <Badge variant={STATUS_VARIANT[job.status]}>{job.status}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Pickup (merchant)
            </p>
            <p className="mt-0.5">{coord(job.pickupLatitude, job.pickupLongitude)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Dropoff (customer)
            </p>
            <p className="mt-0.5">{coord(job.dropoffLatitude, job.dropoffLongitude)}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {job.status === 'ASSIGNED' ? (
            <>
              <Button
                type="button"
                size="sm"
                disabled={anyPending}
                onClick={() => {
                  run(() => accept.mutateAsync(job.id), 'Accepted');
                }}
              >
                Accept
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={anyPending}
                onClick={() => {
                  run(() => reject.mutateAsync(job.id), 'Rejected');
                }}
              >
                Reject
              </Button>
            </>
          ) : null}

          {job.status === 'ACCEPTED' ? (
            <Button
              type="button"
              size="sm"
              disabled={anyPending}
              onClick={() => {
                run(() => pickUp.mutateAsync(job.id), 'Picked up');
              }}
            >
              Mark picked up
            </Button>
          ) : null}

          {job.status === 'PICKED_UP' || job.status === 'ON_THE_WAY' ? (
            <Button
              type="button"
              size="sm"
              disabled={anyPending}
              onClick={() => {
                run(() => arrived.mutateAsync(job.id), 'Arrived at dropoff');
              }}
            >
              Mark arrived
            </Button>
          ) : null}

          {job.status === 'ARRIVED' ? (
            <Button
              type="button"
              size="sm"
              disabled={anyPending}
              onClick={() => {
                setShowDeliver((current) => !current);
              }}
            >
              {showDeliver ? 'Cancel' : 'Mark delivered'}
            </Button>
          ) : null}

          {job.status === 'DELIVERED' && job.cashConfirmedAt === null ? (
            <Button
              type="button"
              size="sm"
              disabled={anyPending}
              onClick={() => {
                run(
                  () =>
                    confirmCash.mutateAsync({
                      jobId: job.id,
                      body: { amountCollected: job.deliveryFee },
                    }),
                  'Cash confirmed',
                );
              }}
            >
              Confirm cash
            </Button>
          ) : null}

          {job.status === 'PICKED_UP' || job.status === 'ON_THE_WAY' || job.status === 'ARRIVED' ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={anyPending}
              onClick={() => {
                run(() => returnJob.mutateAsync({ jobId: job.id }), 'Returned');
              }}
            >
              Return
            </Button>
          ) : null}

          {job.status === 'ACCEPTED' ||
          job.status === 'PICKED_UP' ||
          job.status === 'ON_THE_WAY' ||
          job.status === 'ARRIVED' ||
          job.status === 'ASSIGNED' ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={anyPending}
              onClick={() => {
                run(() => fail.mutateAsync({ jobId: job.id }), 'Marked failed');
              }}
            >
              Fail
            </Button>
          ) : null}
        </div>

        {job.status === 'DELIVERED' && job.cashConfirmedAt !== null ? (
          <p className="text-muted-foreground text-xs">
            Cash confirmed · ₦{(job.cashCollectedAmount ?? 0).toFixed(2)}
          </p>
        ) : null}

        {showDeliver && job.status === 'ARRIVED' ? (
          <DeliverProofForm isPending={deliver.isPending} onSubmit={submitDeliver} />
        ) : null}
      </CardContent>
    </Card>
  );
}
