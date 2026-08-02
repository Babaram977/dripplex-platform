'use client';

import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton, toast } from '@dripplex/ui';
import { Check, Copy, Share2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import * as React from 'react';

import type { DriverReferralDto } from '@dripplex/types';

import { useDriverCode, useRecordInvite } from '@/hooks/use-driver-campaign';
import { buildShareChannels, shareReferralCode } from '@/lib/share';

function CodeSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-4">
      <Skeleton className="h-40 w-40" />
      <Skeleton className="h-10 w-48" />
    </div>
  );
}

function CopyButton({ code }: { code: string }): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);

  const onCopy = async (): Promise<void> => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast({ title: 'Code copied', description: `${code} is on your clipboard.` });
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={() => void onCopy()}>
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? 'Copied' : 'Copy code'}
    </Button>
  );
}

function ShareButtons({ code }: { code: string }): React.JSX.Element {
  const recordInvite = useRecordInvite();
  const channels = buildShareChannels(code);

  const onChannelClick = (): void => {
    recordInvite.mutate();
  };

  const onNativeShare = async (): Promise<void> => {
    await shareReferralCode(code, (text) => {
      toast({ title: 'Share text copied', description: text });
    });
    recordInvite.mutate();
  };

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="default" onClick={() => void onNativeShare()}>
        <Share2 className="h-4 w-4" />
        Share invite
      </Button>
      <div className="flex flex-wrap gap-2">
        {channels.map((channel) => (
          <a
            key={channel.id}
            href={channel.href}
            target="_blank"
            rel="noreferrer"
            onClick={onChannelClick}
            className="border-border bg-background/70 hover:bg-muted inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium transition-colors"
          >
            {channel.label}
          </a>
        ))}
      </div>
    </div>
  );
}

function CodeDisplay({ referral }: { referral: DriverReferralDto }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="shadow-elevation-1 rounded-lg bg-white p-4">
        <QRCodeSVG value={referral.code} size={160} level="M" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="font-display text-2xl font-semibold tracking-wider">{referral.code}</span>
        <CopyButton code={referral.code} />
      </div>
      <ShareButtons code={referral.code} />
    </div>
  );
}

export function ReferralCodeCard(): React.JSX.Element {
  const { data, isLoading, isError } = useDriverCode();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your referral code</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <CodeSkeleton /> : null}
        {isError ? (
          <p className="text-muted-foreground text-sm">
            No active campaign right now — check back when a new one starts.
          </p>
        ) : null}
        {data ? <CodeDisplay referral={data.referral} /> : null}
      </CardContent>
    </Card>
  );
}
