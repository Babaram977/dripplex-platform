'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@dripplex/ui';
import * as React from 'react';

import { useDriverDashboard } from '@/hooks/use-driver-campaign';
import { formatNaira } from '@/lib/format';

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-display text-base font-semibold">{title}</h2>
      <div className="text-muted-foreground flex flex-col gap-2 text-sm leading-relaxed">
        {children}
      </div>
    </div>
  );
}

export function DriverEducation(): React.JSX.Element {
  const { data } = useDriverDashboard();
  const campaign = data?.campaign;

  const requiredTrips = campaign?.requiredTripsPerPassenger ?? 5;
  const silverThreshold = campaign?.silverThreshold ?? 50;
  const silverReward = campaign?.silverRewardAmount ?? 40000;
  const goldThreshold = campaign?.goldThreshold ?? 100;
  const goldReward = campaign?.goldRewardAmount ?? 100000;
  const goldRate = Math.round((campaign?.goldQualificationRate ?? 0.75) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>How the campaign works</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6">
          <Section title="Campaign basics">
            <p>
              Each campaign runs for one calendar month. To take part, you must be an active,
              verified driver on DrippleX.
            </p>
          </Section>

          <Section title="When does a passenger qualify?">
            <p>
              A passenger you refer qualifies once they register as a new DrippleX user with your
              driver code and complete {requiredTrips} successful paid trips within the campaign
              month. Cancelled rides don&apos;t count toward the {requiredTrips}-trip requirement.
            </p>
          </Section>

          <Section title="Reward tiers">
            <ul className="list-disc pl-5">
              <li>
                <span className="text-foreground font-medium">Silver</span> — {silverThreshold}{' '}
                qualified passengers in the month earns {formatNaira(silverReward)}.
              </li>
              <li>
                <span className="text-foreground font-medium">Gold</span> — {goldThreshold}{' '}
                qualified passengers, with at least a {goldRate}% qualification rate (qualified ÷
                registered), earns {formatNaira(goldReward)}.
              </li>
            </ul>
            <p>
              Only one tier is paid per campaign month — if you reach Gold, you receive the Gold
              reward instead of both.
            </p>
          </Section>

          <Section title="Fraud &amp; eligibility checks">
            <p>
              Every referral is screened automatically. Duplicate sign-ups, self-referrals, and
              other suspicious patterns are flagged and excluded from your qualified count before a
              reward is calculated.
            </p>
          </Section>

          <Section title="When do I get paid?">
            <p>
              Rewards are reviewed after the campaign month ends and, once approved, are credited
              directly to your DrippleX wallet. You can track the status of each reward on the
              Rewards tab.
            </p>
          </Section>

          <Section title="Frequently asked questions">
            <p>
              <span className="text-foreground font-medium">
                Can I refer the same passenger twice?
              </span>{' '}
              No — each passenger can only be credited to one referring driver.
            </p>
            <p>
              <span className="text-foreground font-medium">
                Does a cancelled ride count toward the trip requirement?
              </span>{' '}
              No, only successful paid trips count.
            </p>
            <p>
              <span className="text-foreground font-medium">
                What happens if I hit Gold&apos;s passenger count but not the qualification rate?
              </span>{' '}
              You&apos;ll still be paid the Silver reward if you&apos;ve met the Silver threshold.
            </p>
          </Section>
        </div>
      </CardContent>
    </Card>
  );
}
