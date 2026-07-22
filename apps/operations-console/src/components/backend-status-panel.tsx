'use client';

import { useAuth } from '@dripplex/hooks';
import { Button, EmptyState } from '@dripplex/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { describeSdkError, sdk } from '@/lib/sdk';

type ProbeState = 'idle' | 'loading' | 'ok' | 'empty' | 'error';

interface DomainProbe {
  id: string;
  label: string;
  state: ProbeState;
  detail?: string;
}

const INITIAL: DomainProbe[] = [
  { id: 'auth', label: 'Authentication / RBAC', state: 'idle' },
  { id: 'merchants', label: 'Merchants (admin)', state: 'idle' },
  { id: 'fraud', label: 'Fraud', state: 'idle' },
  { id: 'analytics', label: 'Analytics / Reports', state: 'idle' },
  { id: 'cms', label: 'CMS', state: 'idle' },
];

export function BackendStatusPanel(): React.JSX.Element {
  const router = useRouter();
  const { hydrated, isAuthenticated, user, setUser, clearSession } = useAuth();
  const [probes, setProbes] = React.useState<DomainProbe[]>(INITIAL);
  const [running, setRunning] = React.useState(false);

  const updateProbe = React.useCallback((id: string, patch: Partial<DomainProbe>) => {
    setProbes((current) =>
      current.map((probe) => (probe.id === id ? { ...probe, ...patch } : probe)),
    );
  }, []);

  const runProbes = React.useCallback(async () => {
    setRunning(true);
    setProbes(INITIAL.map((probe) => ({ ...probe, state: 'loading' as const })));

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
      return { detail: `${me.email} · perms ${String(me.permissions.length)}` };
    });
    await run('merchants', async () => {
      const list = await sdk.adminMerchants.listMerchants({ page: 1, limit: 1 });
      return {
        empty: list.items.length === 0,
        detail: `total ${String(list.meta.total)}`,
      };
    });
    await run('fraud', async () => {
      const queue = await sdk.adminFraud.queue({ page: 1, pageSize: 1 });
      return {
        empty: queue.items.length === 0,
        detail: `queue ${String(queue.meta.total)}`,
      };
    });
    await run('analytics', async () => {
      const rows = await sdk.analytics.admin({});
      return {
        empty: rows.length === 0,
        detail: rows.length === 0 ? 'No metrics' : `${String(rows.length)} row(s)`,
      };
    });
    await run('cms', async () => {
      const list = await sdk.adminCms.list({ page: 1, pageSize: 1 });
      return {
        empty: list.items.length === 0,
        detail: `total ${String(list.meta.total)}`,
      };
    });

    setRunning(false);
  }, [setUser, updateProbe]);

  React.useEffect(() => {
    if (hydrated && isAuthenticated) {
      void runProbes();
    }
  }, [hydrated, isAuthenticated, runProbes]);

  const onLogout = async (): Promise<void> => {
    try {
      await sdk.auth.logout();
    } catch {
      // Local clear still required.
    } finally {
      clearSession();
      router.push('/login');
    }
  };

  if (!hydrated) {
    return (
      <EmptyState title="Loading session" description="Restoring your session from this device." />
    );
  }

  if (!isAuthenticated) {
    return (
      <EmptyState
        title="Operations Console"
        description="Sign in to probe live Backend Core domains through the portal SDK barrel."
        action={
          <Button asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Operations Console</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Live Backend Core via <code className="text-xs">src/lib/sdk-admin.ts</code>
            {user ? ` · ${user.firstName} ${user.lastName}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={running}
            onClick={() => void runProbes()}
          >
            {running ? 'Probing…' : 'Retry'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => void onLogout()}>
            Sign out
          </Button>
        </div>
      </div>
      <ul className="divide-border/70 border-border/70 divide-y rounded-lg border">
        {probes.map((probe) => (
          <li key={probe.id} className="flex items-start justify-between gap-4 px-4 py-3">
            <div>
              <p className="text-sm font-medium">{probe.label}</p>
              <p className="text-muted-foreground mt-1 text-xs">{probe.detail ?? '—'}</p>
            </div>
            <span className="text-xs font-medium uppercase tracking-wide">{probe.state}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
