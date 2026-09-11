'use client';

import { Card, CardContent, CardHeader, CardTitle, EmptyState, LoadingSpinner } from '@dripplex/ui';
import { formatDate } from '@dripplex/utils';
import { useParams } from 'next/navigation';
import * as React from 'react';

import { AppShell } from '@/components/app-shell';
import { CaseControls } from '@/components/case-controls';
import { CaseNoteForm } from '@/components/case-note-form';
import { CaseTimeline } from '@/components/case-timeline';
import { LifecycleStatusBadge } from '@/components/lifecycle-status-badge';
import { PriorityBadge } from '@/components/priority-badge';
import { useCaseDetail } from '@/hooks/use-operations-case';

const CATEGORY_LABEL: Record<string, string> = {
  PAYMENT: 'Payment',
  RIDE: 'Ride',
  FOOD_ORDER: 'Food order',
  MERCHANT: 'Merchant',
  DRIVER_RIDER: 'Driver / rider',
  WALLET: 'Wallet',
  ACCOUNT: 'Account',
  TECHNICAL: 'Technical',
  SAFETY: 'Safety',
  OTHER: 'Other',
};

const PERSONA_LABEL: Record<string, string> = {
  CUSTOMER: 'Customer',
  RIDER: 'Rider',
  DRIVER: 'Driver',
  MERCHANT: 'Merchant',
  FLEET_OWNER: 'Fleet owner',
};

/** DPX-OPS-001 Slice 2 — support case detail. `adminResponse` (visible to the
 * person who filed) stays a separate field from the internal note timeline
 * below — same split Driver Slice 2's own admin surface uses.
 *
 * DPX-SUPPORT-001 — the filer can now be any persona, so the heading names the
 * persona rather than assuming a driver. */
export default function SupportCaseDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const query = useCaseDetail(params.id);
  const kase = query.data?.caseType === 'SUPPORT' ? query.data : undefined;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {query.isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner label="Loading support ticket…" />
          </div>
        ) : null}

        {query.isError ? (
          <EmptyState
            title="Couldn't load this support ticket"
            description="Check your connection and try again."
          />
        ) : null}

        {kase ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-3xl font-semibold tracking-tight">
                  {kase.userName} · {kase.subject}
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">
                  {PERSONA_LABEL[kase.persona] ?? kase.persona} ·{' '}
                  {CATEGORY_LABEL[kase.category] ?? kase.category} · Submitted{' '}
                  {formatDate(kase.createdAt, 'en-NG', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {kase.userPhone ? ` · ${kase.userPhone}` : ''}
                </p>
                {kase.requiresHumanHandling ? (
                  <p className="text-destructive mt-1 text-xs font-medium">
                    Must be answered by a person — payment, wallet and safety are never automated.
                  </p>
                ) : null}
                {kase.gateDetectedCategory && kase.gateDetectedCategory !== kase.category ? (
                  <p className="text-muted-foreground mt-1 text-xs">
                    Filed as {CATEGORY_LABEL[kase.category] ?? kase.category}, but their own words
                    read as {CATEGORY_LABEL[kase.gateDetectedCategory] ?? kase.gateDetectedCategory}
                    .
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <PriorityBadge priority={kase.priority} />
                <LifecycleStatusBadge status={kase.status} />
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Ticket</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <p>{kase.description}</p>
                <dl className="text-muted-foreground grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
                  {kase.contactEmail ? (
                    <div>
                      <dt className="inline font-medium">Contact email: </dt>
                      <dd className="inline">{kase.contactEmail}</dd>
                    </div>
                  ) : null}
                  {kase.contactPhone ? (
                    <div>
                      <dt className="inline font-medium">Contact phone: </dt>
                      <dd className="inline">{kase.contactPhone}</dd>
                    </div>
                  ) : null}
                  {kase.orderId ? (
                    <div>
                      <dt className="inline font-medium">Order: </dt>
                      <dd className="inline font-mono">{kase.orderId}</dd>
                    </div>
                  ) : null}
                  {kase.rideId ? (
                    <div>
                      <dt className="inline font-medium">Ride: </dt>
                      <dd className="inline font-mono">{kase.rideId}</dd>
                    </div>
                  ) : null}
                  {kase.appVersion ? (
                    <div>
                      <dt className="inline font-medium">App version: </dt>
                      <dd className="inline">{kase.appVersion}</dd>
                    </div>
                  ) : null}
                </dl>
                {kase.adminResponse ? (
                  <div className="border-border/70 rounded-md border p-3">
                    <p className="text-muted-foreground text-xs">
                      Response sent to the person who filed
                    </p>
                    <p className="mt-1">{kase.adminResponse}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Respond</CardTitle>
              </CardHeader>
              <CardContent>
                <CaseControls kase={kase} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <CaseTimeline events={kase.events} />
                <CaseNoteForm caseId={kase.caseId} />
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
