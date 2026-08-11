'use client';

import { Badge, Button, Textarea, toast } from '@dripplex/ui';
import * as React from 'react';

import { useVerifyDriverIdentity } from '@/hooks/use-driver-approvals';

interface DriverIdentityVerifyProps {
  driverId: string;
  verified: boolean;
}

/** DPX-DRIVER (task #15) — manual identity review. The reviewer confirms the
 * driver's identity against their submitted ID/KYC documents (shown in the KYC
 * card above) and marks it verified, clearing the activation identity gate
 * without an external vendor. */
export function DriverIdentityVerify({
  driverId,
  verified,
}: DriverIdentityVerifyProps): React.JSX.Element {
  const verify = useVerifyDriverIdentity(driverId);
  const [remarks, setRemarks] = React.useState('');

  if (verified) {
    return <Badge variant="success">Identity verified</Badge>;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-sm">
        Confirm the driver&apos;s identity against their submitted ID / KYC documents, then mark it
        verified.
      </p>
      <Textarea
        value={remarks}
        placeholder="Reviewer note (optional) — e.g. matched against driver's licence"
        onChange={(event) => {
          setRemarks(event.target.value);
        }}
      />
      <div>
        <Button
          disabled={verify.isPending}
          onClick={() => {
            verify.mutate(remarks.trim() || undefined, {
              onSuccess: () => {
                toast({ title: 'Identity verified' });
              },
              onError: (error) => {
                toast({
                  title: "Couldn't verify identity",
                  description: error.message,
                  variant: 'destructive',
                });
              },
            });
          }}
        >
          Mark identity verified
        </Button>
      </div>
    </div>
  );
}
