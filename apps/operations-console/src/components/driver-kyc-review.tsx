'use client';

import { Badge, Button, EmptyState, Textarea, toast } from '@dripplex/ui';
import * as React from 'react';

import type { DriverKycDto } from '@dripplex/types';

import { useRejectKyc, useVerifyKyc } from '@/hooks/use-driver-approvals';

interface DriverKycReviewProps {
  driverId: string;
  documents: DriverKycDto[];
}

function statusBadgeVariant(status: string): 'success' | 'outline' {
  return status === 'VERIFIED' ? 'success' : 'outline';
}

function KycDocumentRow({
  driverId,
  document,
}: {
  driverId: string;
  document: DriverKycDto;
}): React.JSX.Element {
  const verify = useVerifyKyc(driverId);
  const reject = useRejectKyc(driverId);
  const [rejecting, setRejecting] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const pending = verify.isPending || reject.isPending;

  const onVerify = (): void => {
    verify.mutate(
      { kycId: document.id },
      {
        onSuccess: () => {
          toast({ title: 'Document verified' });
        },
        onError: (error) => {
          toast({
            title: "Couldn't verify document",
            description: error.message,
            variant: 'destructive',
          });
        },
      },
    );
  };

  const onReject = (): void => {
    if (reason.trim().length < 3) {
      toast({ title: 'A rejection reason is required', variant: 'destructive' });
      return;
    }
    reject.mutate(
      { kycId: document.id, remarks: reason.trim() },
      {
        onSuccess: () => {
          toast({ title: 'Document rejected' });
          setRejecting(false);
          setReason('');
        },
        onError: (error) => {
          toast({
            title: "Couldn't reject document",
            description: error.message,
            variant: 'destructive',
          });
        },
      },
    );
  };

  return (
    <div className="border-border/70 flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{document.documentType.replace(/_/g, ' ')}</p>
          <p className="text-muted-foreground text-xs">#{document.documentNumber}</p>
        </div>
        <Badge variant={statusBadgeVariant(document.verificationStatus)}>
          {document.verificationStatus}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <a
          href={document.frontImage}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline-offset-4 hover:underline"
        >
          Front image
        </a>
        {document.backImage !== null ? (
          <a
            href={document.backImage}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            Back image
          </a>
        ) : null}
      </div>

      {document.remarks !== null ? (
        <p className="text-muted-foreground text-xs">Remarks: {document.remarks}</p>
      ) : null}

      {rejecting ? (
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
          <Button size="sm" disabled={pending} onClick={onVerify}>
            Verify
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
      )}
    </div>
  );
}

export function DriverKycReview({ driverId, documents }: DriverKycReviewProps): React.JSX.Element {
  if (documents.length === 0) {
    return (
      <EmptyState
        title="No documents submitted"
        description="This driver hasn't uploaded any KYC documents yet."
      />
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {documents.map((document) => (
        <KycDocumentRow key={document.id} driverId={driverId} document={document} />
      ))}
    </div>
  );
}
