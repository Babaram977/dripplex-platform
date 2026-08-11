'use client';

import { Badge, Button, Textarea, toast } from '@dripplex/ui';
import * as React from 'react';

import type { MerchantProfileDto } from '@dripplex/types';

import {
  useApproveMerchant,
  useReactivateMerchant,
  useRejectMerchant,
  useRejectMerchantKyc,
  useSuspendMerchant,
  useVerifyMerchantKyc,
} from '@/hooks/use-merchant-approvals';

interface MerchantLifecycleActionsProps {
  merchant: MerchantProfileDto;
}

const fail =
  (title: string) =>
  (error: Error): void => {
    toast({ title, description: error.message, variant: 'destructive' });
  };

/** A button that collects a required reason before firing its mutation. */
function ReasonAction({
  label,
  placeholder,
  pending,
  minLength = 5,
  onConfirm,
}: {
  label: string;
  placeholder: string;
  pending: boolean;
  minLength?: number;
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
            if (reason.trim().length < minLength) {
              toast({
                title: `A reason of at least ${String(minLength)} characters is required`,
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

/** KYC review — a merchant cannot be approved until its KYC is VERIFIED, so the
 * reviewer verifies (or rejects) the submitted document here first. */
function MerchantKycReview({ merchant }: MerchantLifecycleActionsProps): React.JSX.Element {
  const merchantId = merchant.merchantId;
  const verify = useVerifyMerchantKyc(merchantId);
  const reject = useRejectMerchantKyc(merchantId);
  const kyc = merchant.kyc;
  const pending = verify.isPending || reject.isPending;

  if (!kyc) {
    return (
      <p className="text-muted-foreground text-sm">
        No KYC document submitted yet. The merchant must submit KYC before it can be approved.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <p className="font-medium">{kyc.documentType}</p>
          <p className="text-muted-foreground">{kyc.documentNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={kyc.verificationStatus === 'VERIFIED' ? 'success' : 'outline'}>
            {kyc.verificationStatus}
          </Badge>
          {kyc.frontImage ? (
            <a
              href={kyc.frontImage}
              target="_blank"
              rel="noreferrer"
              className="text-primary text-sm underline"
            >
              View
            </a>
          ) : null}
        </div>
      </div>

      {kyc.verificationStatus === 'VERIFIED' ? null : (
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={pending}
            onClick={() => {
              verify.mutate(undefined, {
                onSuccess: () => {
                  toast({ title: 'KYC verified' });
                },
                onError: fail("Couldn't verify KYC"),
              });
            }}
          >
            Verify KYC
          </Button>
          <ReasonAction
            label="Reject KYC"
            placeholder="Reason for KYC rejection (min 5 characters)"
            pending={reject.isPending}
            onConfirm={(reason) => {
              reject.mutate(reason, {
                onSuccess: () => {
                  toast({ title: 'KYC rejected' });
                },
                onError: fail("Couldn't reject KYC"),
              });
            }}
          />
        </div>
      )}
    </div>
  );
}

export function MerchantLifecycleActions({
  merchant,
}: MerchantLifecycleActionsProps): React.JSX.Element {
  const merchantId = merchant.merchantId;
  const approve = useApproveMerchant(merchantId);
  const reject = useRejectMerchant(merchantId);
  const suspend = useSuspendMerchant(merchantId);
  const reactivate = useReactivateMerchant(merchantId);

  if (merchant.status === 'APPROVED') {
    return (
      <ReasonAction
        label="Suspend merchant"
        placeholder="Reason for suspension (min 5 characters)"
        pending={suspend.isPending}
        onConfirm={(reason) => {
          suspend.mutate(reason, {
            onSuccess: () => {
              toast({ title: 'Merchant suspended' });
            },
            onError: fail("Couldn't suspend merchant"),
          });
        }}
      />
    );
  }

  if (merchant.status === 'SUSPENDED') {
    return (
      <Button
        disabled={reactivate.isPending}
        onClick={() => {
          reactivate.mutate(undefined, {
            onSuccess: () => {
              toast({ title: 'Merchant reactivated' });
            },
            onError: fail("Couldn't reactivate merchant"),
          });
        }}
      >
        Reactivate merchant
      </Button>
    );
  }

  // PENDING / UNDER_REVIEW / REJECTED — reviewable. KYC must be verified before
  // approval; the backend enforces this and surfaces a clear error if not.
  const kycVerified = merchant.kyc?.verificationStatus === 'VERIFIED';
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="mb-2 text-sm font-medium">KYC review</h3>
        <MerchantKycReview merchant={merchant} />
      </div>

      <div className="flex flex-col gap-3 border-t pt-4">
        {kycVerified ? null : (
          <p className="text-muted-foreground text-sm">
            Verify the merchant&apos;s KYC above before approving.
          </p>
        )}
        <Button
          disabled={approve.isPending || !kycVerified}
          onClick={() => {
            approve.mutate(undefined, {
              onSuccess: () => {
                toast({ title: 'Merchant approved' });
              },
              onError: fail("Couldn't approve merchant"),
            });
          }}
        >
          Approve merchant
        </Button>
        <ReasonAction
          label="Reject merchant"
          placeholder="Reason for rejection (min 5 characters)"
          pending={reject.isPending}
          onConfirm={(reason) => {
            reject.mutate(reason, {
              onSuccess: () => {
                toast({ title: 'Merchant rejected' });
              },
              onError: fail("Couldn't reject merchant"),
            });
          }}
        />
      </div>
    </div>
  );
}
