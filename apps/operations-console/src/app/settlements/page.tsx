'use client';

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  LoadingSpinner,
} from '@dripplex/ui';
import * as React from 'react';

import type {
  OperationsPayoutRequestDto,
  PayoutRequestStatus,
  PayoutRequesterType,
} from '@dripplex/types';

import { AppShell } from '@/components/app-shell';
import {
  useOperationsPayoutRequests,
  useOperationsPayoutSummary,
} from '@/hooks/use-operations-finance';

/**
 * DPX-OPS — every partner asking DrippleX for money, in one queue.
 *
 * They were never in one place. A driver's or rider's payout is a withdrawal
 * request; a merchant's is the same row drawn on a different bank record; a
 * fleet owner's is a settlement request in a separate table reviewed on a
 * separate screen. Operations had to know which persona they were dealing with
 * before they could find out who was waiting.
 *
 * This is deliberately a queue and not a control panel. Approving still happens
 * on the existing endpoints, because a withdrawal has already debited a wallet
 * and a fleet receivable has not been paid into one — collapsing their approval
 * paths into one button here would be a way to pay the wrong thing. Every row
 * carries the path that actions it.
 */

const REQUESTERS: { value: PayoutRequesterType; label: string }[] = [
  { value: 'DRIVER', label: 'Drivers' },
  { value: 'RIDER', label: 'Riders' },
  { value: 'MERCHANT', label: 'Merchants' },
  { value: 'FLEET_OWNER', label: 'Fleet owners' },
  { value: 'CUSTOMER', label: 'Customers' },
];

const STATUSES: PayoutRequestStatus[] = [
  'PENDING',
  'APPROVED',
  'PROCESSING',
  'PAID',
  'REJECTED',
  'CANCELLED',
];

const STATUS_TONE: Record<PayoutRequestStatus, 'success' | 'accent' | 'outline' | 'secondary'> = {
  PENDING: 'accent',
  APPROVED: 'accent',
  PROCESSING: 'accent',
  PAID: 'success',
  REJECTED: 'outline',
  CANCELLED: 'secondary',
};

const KIND_LABEL: Record<OperationsPayoutRequestDto['kind'], string> = {
  WALLET_PAYOUT: 'Wallet payout',
  FLEET_RECEIVABLE: 'Fleet receivable',
};

function naira(value: number): string {
  return `₦${value.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

function requesterLabel(requesterType: PayoutRequesterType): string {
  return REQUESTERS.find((entry) => entry.value === requesterType)?.label ?? requesterType;
}

function waitingFor(iso: string): string {
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${String(hours)}h`;
  return `${String(Math.floor(hours / 24))}d`;
}

export default function SettlementsPage(): React.JSX.Element {
  const [requesterType, setRequesterType] = React.useState<PayoutRequesterType | undefined>(
    undefined,
  );
  const [status, setStatus] = React.useState<PayoutRequestStatus | undefined>('PENDING');

  const summary = useOperationsPayoutSummary();
  const requests = useOperationsPayoutRequests({
    ...(requesterType === undefined ? {} : { requesterType }),
    ...(status === undefined ? {} : { status }),
  });
  const items = requests.data?.items ?? [];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Settlements &amp; payout requests
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Everyone asking DrippleX for money — drivers, riders, merchants and fleet owners — in
            one queue. Approving still happens on each request&apos;s own screen; this is where you
            find out who is waiting.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.isLoading ? <LoadingSpinner /> : null}
            {summary.isError ? (
              <p className="text-sm text-red-600">
                Couldn&apos;t load the outstanding total.{' '}
                <button
                  type="button"
                  onClick={() => {
                    void summary.refetch();
                  }}
                  className="font-semibold underline"
                >
                  Retry
                </button>
              </p>
            ) : null}
            {summary.data ? (
              <div className="flex flex-wrap items-baseline gap-x-10 gap-y-4">
                <div>
                  <p className="text-xs text-gray-500">Pending requests</p>
                  <p className="text-2xl font-semibold tabular-nums text-gray-900">
                    {summary.data.pendingCount.toLocaleString('en-NG')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Pending amount</p>
                  <p className="text-2xl font-semibold tabular-nums text-gray-900">
                    {naira(summary.data.pendingAmount)}
                  </p>
                </div>
                {summary.data.pendingByRequester.map((bucket) => (
                  <div key={bucket.requesterType}>
                    <p className="text-xs text-gray-500">{requesterLabel(bucket.requesterType)}</p>
                    <p className="text-lg font-medium tabular-nums text-gray-900">
                      {naira(bucket.amount)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {bucket.count.toLocaleString('en-NG')} waiting
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle>Requests</CardTitle>
            <div className="flex gap-2">
              <select
                value={requesterType ?? ''}
                onChange={(event) => {
                  setRequesterType(
                    event.target.value === ''
                      ? undefined
                      : (event.target.value as PayoutRequesterType),
                  );
                }}
                className="h-9 rounded-md border border-gray-300 px-3 text-sm"
              >
                <option value="">Everyone</option>
                {REQUESTERS.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
              <select
                value={status ?? ''}
                onChange={(event) => {
                  setStatus(
                    event.target.value === ''
                      ? undefined
                      : (event.target.value as PayoutRequestStatus),
                  );
                }}
                className="h-9 rounded-md border border-gray-300 px-3 text-sm"
              >
                <option value="">Any status</option>
                {STATUSES.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent>
            {requests.isLoading ? <LoadingSpinner /> : null}
            {requests.isError ? (
              <p className="text-sm text-red-600">
                Couldn&apos;t load the payout queue.{' '}
                <button
                  type="button"
                  onClick={() => {
                    void requests.refetch();
                  }}
                  className="font-semibold underline"
                >
                  Retry
                </button>
              </p>
            ) : null}
            {!requests.isLoading && !requests.isError && items.length === 0 ? (
              <EmptyState
                title="Nobody is waiting"
                description="No requests match this filter. Partners appear here the moment they ask to be paid."
              />
            ) : null}
            {items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                      <th className="pb-2 pr-4 font-medium">Requester</th>
                      <th className="pb-2 pr-4 font-medium">What</th>
                      <th className="pb-2 pr-4 text-right font-medium">Amount</th>
                      <th className="pb-2 pr-4 font-medium">Status</th>
                      <th className="pb-2 pr-4 font-medium">Waiting</th>
                      <th className="pb-2 font-medium">Action on</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((request) => (
                      <tr key={request.id} className="border-b border-gray-100 last:border-0">
                        <td className="py-3 pr-4">
                          <div className="font-medium text-gray-900">{request.requesterName}</div>
                          <div className="text-xs text-gray-500">
                            {requesterLabel(request.requesterType)}
                            {request.requesterReference === null
                              ? ''
                              : ` · ${request.requesterReference}`}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-gray-600">{KIND_LABEL[request.kind]}</td>
                        <td className="py-3 pr-4 text-right font-semibold tabular-nums text-gray-900">
                          {naira(request.amount)}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant={STATUS_TONE[request.status]}>{request.status}</Badge>
                          {request.note === null ? null : (
                            <div className="mt-1 max-w-[220px] text-xs text-gray-500">
                              {request.note}
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-gray-600">
                          {request.status === 'PENDING' ? waitingFor(request.requestedAt) : '—'}
                        </td>
                        <td className="py-3 font-mono text-xs text-gray-500">
                          {request.actionPath}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
