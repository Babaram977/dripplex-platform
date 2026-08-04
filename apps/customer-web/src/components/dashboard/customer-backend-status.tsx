'use client';

import { useAuth } from '@dripplex/hooks';
import { Button, EmptyState } from '@dripplex/ui';
import * as React from 'react';

import { useRequireAuth } from '@/hooks/use-require-auth';
import { describeSdkError, sdk } from '@/lib/sdk';

type ProbeState = 'idle' | 'loading' | 'ok' | 'empty' | 'error';

interface DomainProbe {
  id: string;
  label: string;
  state: ProbeState;
  detail?: string;
}

const INITIAL_PROBES: DomainProbe[] = [
  { id: 'auth', label: 'Authentication / Session', state: 'idle' },
  { id: 'notifications', label: 'Notifications', state: 'idle' },
  { id: 'search', label: 'Search', state: 'idle' },
  { id: 'wallet', label: 'Wallets', state: 'idle' },
  { id: 'loyalty', label: 'Loyalty', state: 'idle' },
  { id: 'promotions', label: 'Promotions', state: 'idle' },
  { id: 'wishlist', label: 'Wishlist', state: 'idle' },
  { id: 'cms', label: 'CMS', state: 'idle' },
];

export function CustomerBackendStatus(): React.JSX.Element {
  const { ready } = useRequireAuth();
  const { user, setUser } = useAuth();
  const [probes, setProbes] = React.useState<DomainProbe[]>(INITIAL_PROBES);
  const [running, setRunning] = React.useState(false);

  const updateProbe = React.useCallback((id: string, patch: Partial<DomainProbe>) => {
    setProbes((current) =>
      current.map((probe) => (probe.id === id ? { ...probe, ...patch } : probe)),
    );
  }, []);

  const runProbes = React.useCallback(async () => {
    setRunning(true);
    setProbes(INITIAL_PROBES.map((probe) => ({ ...probe, state: 'loading' as const })));

    const run = async (
      id: string,
      action: () => Promise<{ empty?: boolean; detail?: string }>,
    ): Promise<void> => {
      try {
        const result = await action();
        updateProbe(id, {
          state: result.empty ? 'empty' : 'ok',
          detail: result.detail ?? 'Connected',
        });
      } catch (error) {
        const described = describeSdkError(error);
        updateProbe(id, {
          state: 'error',
          detail: `${described.title}: ${described.description}`,
        });
      }
    };

    await run('auth', async () => {
      const me = await sdk.auth.me();
      setUser(me);
      return { detail: `${me.email} · roles ${me.roles.join(', ') || 'none'}` };
    });

    await run('notifications', async () => {
      const list = await sdk.notifications.list({ page: 1, limit: 1 });
      const count = list.items.length;
      return {
        empty: count === 0,
        detail: count === 0 ? 'No notifications' : `${String(count)} loaded`,
      };
    });

    await run('search', async () => {
      const popular = await sdk.search.popular({ limit: 5 });
      return {
        empty: popular.length === 0,
        detail:
          popular.length === 0 ? 'No popular queries' : `${String(popular.length)} suggestions`,
      };
    });

    await run('wallet', async () => {
      const wallet = await sdk.wallet.customerWallet();
      return { detail: `Wallet ${wallet.id}` };
    });

    await run('loyalty', async () => {
      const overview = await sdk.loyalty.account();
      return { detail: `Points ${String(overview.account.pointsBalance)}` };
    });

    await run('promotions', async () => {
      const list = await sdk.promotions.active();
      return {
        empty: list.length === 0,
        detail: list.length === 0 ? 'No active promotions' : `${String(list.length)} active`,
      };
    });

    await run('wishlist', async () => {
      const list = await sdk.wishlist.list();
      return {
        empty: list.length === 0,
        detail: list.length === 0 ? 'No wishlists' : `${String(list.length)} wishlist(s)`,
      };
    });

    await run('cms', async () => {
      const banners = await sdk.cms.banners();
      return {
        empty: banners.length === 0,
        detail: banners.length === 0 ? 'No banners' : `${String(banners.length)} banner(s)`,
      };
    });

    setRunning(false);
  }, [setUser, updateProbe]);

  React.useEffect(() => {
    if (ready) {
      void runProbes();
    }
  }, [ready, runProbes]);

  if (!ready) {
    return (
      <EmptyState
        title="Checking session"
        description="Connecting to Backend Core authentication before loading dashboard modules."
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Live Backend Core session
            {user ? ` for ${user.firstName} ${user.lastName}` : ''}. Product modules continue to
            land in later Program C phases — this surface verifies SDK integration.
          </p>
        </div>
        <Button type="button" variant="outline" disabled={running} onClick={() => void runProbes()}>
          {running ? 'Probing…' : 'Retry probes'}
        </Button>
      </div>
      <ul className="divide-border/70 border-border/70 divide-y rounded-lg border">
        {probes.map((probe) => (
          <li key={probe.id} className="flex items-start justify-between gap-4 px-4 py-3">
            <div>
              <p className="text-sm font-medium">{probe.label}</p>
              <p className="text-muted-foreground mt-1 text-xs">{probe.detail ?? '—'}</p>
            </div>
            <span className="text-xs font-medium uppercase tracking-wide">
              {probe.state === 'loading'
                ? 'Loading'
                : probe.state === 'ok'
                  ? 'OK'
                  : probe.state === 'empty'
                    ? 'Empty'
                    : probe.state === 'error'
                      ? 'Error'
                      : 'Idle'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
