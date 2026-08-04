'use client';

import { Badge, Skeleton } from '@dripplex/ui';
import * as React from 'react';

import { useIdentityVerificationStatus } from '@/hooks/use-identity-verification';
import { formatDate } from '@/lib/format';

/** Driver Slice 2 item 9 — view-only security status, per the founder's
 * field-level decision. The selfie-capture/re-verification flow itself is
 * Driver-001 scope, not this item — this only surfaces the read-only
 * status the founder asked for, reusing the already-existing (but until
 * now unconsumed) useIdentityVerificationStatus hook and SDK client. */
export function SecurityStatus(): React.JSX.Element {
  const status = useIdentityVerificationStatus(undefined);

  if (status.isLoading) {
    return <Skeleton className="h-16 w-full" />;
  }

  if (!status.data) {
    return <p className="text-muted-foreground text-sm">Security status unavailable.</p>;
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs">Identity verification</p>
        {status.data.locked ? (
          <Badge variant="outline" className="text-destructive border-destructive/40">
            Locked
          </Badge>
        ) : status.data.required ? (
          <Badge variant="outline">Re-verification required</Badge>
        ) : (
          <Badge variant="success">Verified</Badge>
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        {status.data.lastVerifiedAt
          ? `Last verified ${formatDate(status.data.lastVerifiedAt)}`
          : 'Never verified'}
      </p>
    </div>
  );
}
