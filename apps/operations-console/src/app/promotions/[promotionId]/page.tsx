'use client';

import { usePermission } from '@dripplex/hooks';
import { Card, CardContent, CardHeader, CardTitle, EmptyState, LoadingSpinner } from '@dripplex/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as React from 'react';

import { AppShell } from '@/components/app-shell';
import {
  AddPromoterForm,
  ApiErrorNotice,
  PerformanceStats,
  PromoterTable,
} from '@/components/promotions-panels';
import { CampaignStatusBadge } from '@/components/promotions-primitives';
import { useAddPromoter, useCampaign, useRemovePromoter } from '@/hooks/use-operations-promotions';

/**
 * One campaign: its rollup, its promoters, and the two management actions.
 *
 * The add and remove controls are hidden without `operations:promotions:manage`
 * so an operator is not offered a button that will 403. That is presentation
 * only — `POST .../promoters` and `DELETE .../promoters/:id` each check the
 * permission themselves, and nothing here weakens that.
 */
export function CampaignDetail({ promotionId }: { promotionId: string }): React.JSX.Element {
  const canManage = usePermission('operations:promotions:manage');
  const campaign = useCampaign(promotionId);
  const addPromoter = useAddPromoter(promotionId);
  const removePromoter = useRemovePromoter(promotionId);
  // From the campaign payload itself. The screen no longer fetches the rate to
  // do arithmetic with — every naira figure here was computed server-side, and
  // this is only used to label an equivalence the server already stated.
  const pointsPerNaira = campaign.data?.pointsPerNaira ?? null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/promotions" className="text-sm text-emerald-700 underline">
          ← All campaigns
        </Link>
      </div>

      {campaign.isLoading ? <LoadingSpinner /> : null}
      {campaign.isError ? (
        <ApiErrorNotice
          error={campaign.error}
          onRetry={() => {
            void campaign.refetch();
          }}
        />
      ) : null}

      {campaign.data ? (
        <>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{campaign.data.name}</h1>
            <div className="mt-2">
              <CampaignStatusBadge status={campaign.data.status} />
            </div>
            {campaign.data.startsAt !== null || campaign.data.endsAt !== null ? (
              <p className="mt-1 text-sm text-gray-600">
                {campaign.data.startsAt === null
                  ? 'No start date'
                  : new Date(campaign.data.startsAt).toLocaleDateString('en-NG', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                {' – '}
                {campaign.data.endsAt === null
                  ? 'no end date'
                  : new Date(campaign.data.endsAt).toLocaleDateString('en-NG', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
              </p>
            ) : null}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Campaign performance</CardTitle>
            </CardHeader>
            <CardContent>
              <PerformanceStats
                performance={campaign.data.performance}
                pointsPerNaira={pointsPerNaira}
              />
            </CardContent>
          </Card>

          {canManage ? (
            <Card>
              <CardHeader>
                <CardTitle>Add a promoter</CardTitle>
                <p className="text-sm text-gray-600">
                  Issues a private campaign token that attributes new customers to this person and
                  earns them the reward you set. Every addition is audited.
                </p>
              </CardHeader>
              <CardContent>
                <AddPromoterForm
                  isPending={addPromoter.isPending}
                  error={addPromoter.error}
                  onSubmit={(body) => {
                    addPromoter.mutate(body);
                  }}
                />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Promoters</CardTitle>
              <p className="text-sm text-gray-600">
                Removed promoters stay listed. Their past attributions and unpaid rewards still
                exist, and hiding them would hide a liability.
              </p>
            </CardHeader>
            <CardContent>
              {removePromoter.isError ? <ApiErrorNotice error={removePromoter.error} /> : null}
              {campaign.data.promoters.length === 0 ? (
                <EmptyState
                  title="No promoters yet"
                  description="Nobody is promoting this campaign. Add one to issue their token."
                />
              ) : (
                <PromoterTable
                  promoters={campaign.data.promoters}
                  pointsPerNaira={pointsPerNaira}
                  canManage={canManage}
                  removingId={removePromoter.isPending ? removePromoter.variables : null}
                  onRemove={(promoterId) => {
                    removePromoter.mutate(promoterId);
                  }}
                />
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

export default function CampaignDetailPage(): React.JSX.Element {
  const params = useParams<{ promotionId: string }>();
  return (
    <AppShell>
      <CampaignDetail promotionId={params.promotionId} />
    </AppShell>
  );
}
