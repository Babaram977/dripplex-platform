'use client';

import { Badge, Button, Input, Label, toast } from '@dripplex/ui';
import * as React from 'react';

import type { MerchantProfileDto } from '@dripplex/types';

import { useSetMerchantNegotiatedRate } from '@/hooks/use-merchant-approvals';

/**
 * DPX-MERCHANT-016 — the commission rate agreed with one merchant.
 *
 * Every merchant used to share the platform-wide rate, and the only way to give
 * a single shop a different one was a commission campaign — a time-boxed
 * instrument standing in for a standing agreement. `Fleet` already had a
 * negotiated rate; this is the merchant equivalent, set from here.
 *
 * Entered as a **percentage**, because that is how the conversation with a
 * merchant actually happens ("we agreed seven and a half"). It is stored as a
 * fraction, and the conversion lives here so nobody has to remember which form
 * a given field wants.
 */
export function MerchantCommissionRate({
  merchant,
}: {
  merchant: MerchantProfileDto;
}): React.JSX.Element {
  // The profile id, not `merchantId` (the user id): the settlement path
  // resolves against the profile id, so anything else reads as "no agreement".
  const setRate = useSetMerchantNegotiatedRate(merchant.id);
  const agreed = merchant.negotiatedRate;

  const [percent, setPercent] = React.useState(agreed === null ? '' : String(agreed * 100));
  const [note, setNote] = React.useState(merchant.negotiationNote ?? '');

  const parsed = Number(percent);
  const valid = percent.trim() !== '' && Number.isFinite(parsed) && parsed > 0 && parsed < 100;

  const save = (): void => {
    if (!valid) {
      toast({ title: 'Enter a percentage between 0 and 100', variant: 'destructive' });
      return;
    }
    setRate.mutate(
      { rate: parsed / 100, ...(note.trim() === '' ? {} : { note: note.trim() }) },
      {
        onSuccess: () => {
          toast({ title: `Rate agreed at ${String(parsed)}%` });
        },
        onError: (error) => {
          toast({
            title: "Couldn't save the rate",
            description: error.message,
            variant: 'destructive',
          });
        },
      },
    );
  };

  const clear = (): void => {
    setRate.mutate(
      { rate: null },
      {
        onSuccess: () => {
          setPercent('');
          setNote('');
          toast({ title: 'Agreement cleared — back to the platform rate' });
        },
        onError: (error) => {
          toast({
            title: "Couldn't clear the rate",
            description: error.message,
            variant: 'destructive',
          });
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {agreed === null ? (
          <>
            <Badge variant="outline">Platform rate</Badge>
            <span className="text-muted-foreground">
              No individual agreement — this merchant is charged the platform-wide rate.
            </span>
          </>
        ) : (
          <>
            <Badge variant="accent">{`${String(Math.round(agreed * 10_000) / 100)}% agreed`}</Badge>
            <span className="text-muted-foreground">
              {merchant.negotiationNote ?? 'No note recorded.'}
            </span>
          </>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="negotiated-rate">Commission rate (%)</Label>
          <Input
            id="negotiated-rate"
            inputMode="decimal"
            placeholder="7.5"
            value={percent}
            onChange={(event) => {
              setPercent(event.target.value);
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="negotiation-note">What was agreed</Label>
          <Input
            id="negotiation-note"
            placeholder="High volume, agreed with owner"
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
            }}
          />
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        A commission campaign still overrides this for the window it runs — an agreed rate is what
        this merchant pays normally, not a promise that no promotion will beat it. Changing it never
        touches an order that has already settled.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={setRate.isPending || !valid}>
          {setRate.isPending ? 'Saving…' : 'Agree this rate'}
        </Button>
        {agreed === null ? null : (
          <Button variant="outline" onClick={clear} disabled={setRate.isPending}>
            Clear agreement
          </Button>
        )}
      </div>
    </div>
  );
}
