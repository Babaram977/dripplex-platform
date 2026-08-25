'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  LoadingSpinner,
  toast,
} from '@dripplex/ui';
import * as React from 'react';

import type { AdminUtilityPurchaseDto, UtilityPurchaseStatus } from '@dripplex/types';

import { AppShell } from '@/components/app-shell';
import {
  useResolveUtilityPurchase,
  useUtilityFloat,
  useUtilityPurchases,
} from '@/hooks/use-utilities';

const naira = (value: number): string => `₦${value.toLocaleString('en-NG')}`;

/**
 * Bill payments — the provider float, the purchase register, and the queue of
 * purchases the provider never answered for.
 *
 * The float panel is not a dashboard nicety. Peyflex debits a prefunded
 * DrippleX float, so it running dry is not one unlucky customer: it is airtime,
 * data, electricity and cable all failing at once, presenting to customers as a
 * generic error with no clue as to the cause. The alarm fires on a threshold
 * rather than on zero, because zero is already too late.
 */

function FloatPanel(): React.JSX.Element {
  const float = useUtilityFloat();

  if (float.isLoading) return <LoadingSpinner />;
  if (float.isError) {
    return <EmptyState title="Couldn't read the float" description={float.error.message} />;
  }
  const status = float.data;
  if (!status) return <LoadingSpinner />;

  if (!status.configured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Provider float</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No provider credentials are configured, so bill payments are deployed but switched off.
            Customers see the tab badged as unavailable rather than a service that fails after they
            have chosen a bundle.
          </p>
        </CardContent>
      </Card>
    );
  }

  // A float that cannot be read is itself something Ops must see. Showing a
  // reassuring zero, or nothing at all, is how an outage goes unnoticed.
  if (status.balance === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Provider float</CardTitle>
        </CardHeader>
        <CardContent>
          <Badge variant="accent">Unreadable</Badge>
          <p className="text-muted-foreground mt-2 text-sm">
            {status.error ?? 'The provider did not answer.'} Until this clears, there is no way to
            know whether the float can cover the next purchase.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Provider float</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-baseline gap-3">
          <p className="text-3xl font-semibold">{naira(status.balance)}</p>
          {status.low ? (
            <Badge variant="accent">Low — top up</Badge>
          ) : (
            <Badge variant="outline">Healthy</Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          Every airtime, data, electricity and cable purchase on the platform is paid from this one
          balance. The alarm is set at {naira(status.threshold)}; when it runs out, all four
          services fail at once.
        </p>
      </CardContent>
    </Card>
  );
}

const STATUS_LABEL: Record<UtilityPurchaseStatus, string> = {
  AWAITING_PAYMENT: 'Awaiting payment',
  PENDING: 'Unresolved',
  SUCCESSFUL: 'Delivered',
  FAILED: 'Failed',
  REVERSED: 'Money returned',
};

function ResolveForm({ purchase }: { purchase: AdminUtilityPurchaseDto }): React.JSX.Element {
  const resolve = useResolveUtilityPurchase();
  const [note, setNote] = React.useState('');
  const [reference, setReference] = React.useState('');
  const [token, setToken] = React.useState('');

  const submit = (outcome: 'SUCCESSFUL' | 'REVERSED'): void => {
    if (note.trim().length < 5) {
      toast({
        title: 'Say what you found',
        description: 'A manual override with no stated reason cannot be audited later.',
        variant: 'destructive',
      });
      return;
    }
    resolve.mutate(
      {
        id: purchase.id,
        body: {
          outcome,
          note: note.trim(),
          ...(reference.trim() !== '' ? { providerReference: reference.trim() } : {}),
          ...(token.trim() !== '' ? { deliveredToken: token.trim() } : {}),
        },
      },
      {
        onSuccess: () => {
          toast({
            title:
              outcome === 'SUCCESSFUL'
                ? 'Recorded as delivered'
                : 'Reversed — the customer has been credited',
          });
          setNote('');
          setReference('');
          setToken('');
        },
        onError: (error) => {
          toast({
            title: "Couldn't resolve this purchase",
            description: error.message,
            variant: 'destructive',
          });
        },
      },
    );
  };

  return (
    <div className="bg-muted/30 mt-3 flex flex-col gap-3 rounded-md p-3">
      <p className="text-muted-foreground text-xs">
        The provider never answered for this one, so only a person looking at the provider dashboard
        can say whether the float was spent. Record what you found — the customer&apos;s money is
        still reserved until you do.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs">
          What you found
          <Input
            value={note}
            placeholder="e.g. Confirmed delivered on the provider dashboard"
            onChange={(event) => {
              setNote(event.target.value);
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Provider reference (optional)
          <Input
            value={reference}
            onChange={(event) => {
              setReference(event.target.value);
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Token, if any (optional)
          <Input
            value={token}
            onChange={(event) => {
              setToken(event.target.value);
            }}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={resolve.isPending}
          onClick={() => {
            submit('SUCCESSFUL');
          }}
        >
          It was delivered
        </Button>
        <Button
          variant="outline"
          disabled={resolve.isPending}
          onClick={() => {
            submit('REVERSED');
          }}
        >
          It never landed — refund
        </Button>
      </div>
    </div>
  );
}

function PurchaseRow({ purchase }: { purchase: AdminUtilityPurchaseDto }): React.JSX.Element {
  const margin =
    purchase.providerCost === null ? null : purchase.amountCharged - purchase.providerCost;

  return (
    <div className="flex flex-col border-b py-4 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">{purchase.serviceType.replace('_', ' ')}</p>
        <Badge variant="outline">{purchase.providerCode}</Badge>
        <Badge variant={purchase.status === 'PENDING' ? 'accent' : 'outline'}>
          {STATUS_LABEL[purchase.status]}
        </Badge>
        <span className="text-muted-foreground text-xs">{purchase.customerIdentifier}</span>
      </div>
      <div className="text-muted-foreground mt-1 flex flex-wrap gap-4 text-xs">
        <span>Charged {naira(purchase.amountCharged)}</span>
        {purchase.providerCost !== null ? <span>Cost {naira(purchase.providerCost)}</span> : null}
        {/* Both numbers are stored precisely so the spread is auditable rather
            than inferred from a monthly float reconciliation. */}
        {margin !== null ? <span>Margin {naira(margin)}</span> : null}
        {purchase.providerReference !== null ? <span>Ref {purchase.providerReference}</span> : null}
        <span>{new Date(purchase.createdAt).toLocaleString('en-NG')}</span>
      </div>
      {purchase.failureReason !== null ? (
        <p className="text-muted-foreground mt-1 text-xs">{purchase.failureReason}</p>
      ) : null}
      {/* What the provider actually said, rather than the sentence the
          customer was shown. The API has always returned this and no screen
          rendered it, so the one record that can explain a refusal — which
          field Peyflex objected to, whether it answered at all — was
          reachable only by reading the database by hand. Collapsed, because
          it is diagnosis and not the register's job. */}
      {purchase.providerResponse !== null ? (
        <details className="mt-1">
          <summary className="text-muted-foreground cursor-pointer text-xs">
            Provider response
          </summary>
          <pre className="text-muted-foreground mt-1 overflow-x-auto whitespace-pre-wrap text-xs">
            {JSON.stringify(purchase.providerResponse, null, 2)}
          </pre>
        </details>
      ) : null}
      {purchase.status === 'PENDING' ? <ResolveForm purchase={purchase} /> : null}
    </div>
  );
}

function PurchaseRegister(): React.JSX.Element {
  const [status, setStatus] = React.useState<UtilityPurchaseStatus | 'ALL'>('PENDING');
  const purchases = useUtilityPurchases({
    page: 1,
    pageSize: 50,
    ...(status === 'ALL' ? {} : { status }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bill payments</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-2">
          {(['PENDING', 'SUCCESSFUL', 'REVERSED', 'FAILED', 'ALL'] as const).map((option) => (
            <Button
              key={option}
              size="sm"
              variant={option === status ? 'default' : 'outline'}
              onClick={() => {
                setStatus(option);
              }}
            >
              {option === 'ALL' ? 'All' : STATUS_LABEL[option]}
            </Button>
          ))}
        </div>

        {purchases.isLoading ? <LoadingSpinner /> : null}
        {purchases.isError ? (
          <EmptyState title="Couldn't load bill payments" description={purchases.error.message} />
        ) : null}
        {purchases.data?.items.length === 0 ? (
          <EmptyState
            title={status === 'PENDING' ? 'Nothing waiting on a decision' : 'No purchases'}
            description={
              status === 'PENDING'
                ? 'Every purchase has a confirmed outcome.'
                : 'Nothing matches this filter yet.'
            }
          />
        ) : null}
        {purchases.data?.items.map((purchase) => (
          <PurchaseRow key={purchase.id} purchase={purchase} />
        ))}
      </CardContent>
    </Card>
  );
}

export default function UtilitiesPage(): React.JSX.Element {
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Bill payments</h1>
          <p className="text-muted-foreground text-sm">
            The float every utility purchase draws on, and the purchases the provider never answered
            for. The provider offers no way to ask what happened after a timeout, so those need a
            person.
          </p>
        </div>
        <FloatPanel />
        <PurchaseRegister />
      </div>
    </AppShell>
  );
}
