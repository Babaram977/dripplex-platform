'use client';

import * as React from 'react';

import type {
  CommercialCreditSettingDto,
  CommissionAccountDto,
  CommissionLedgerEntryDto,
  CommissionOwnerType,
  PaginatedResult,
} from '@dripplex/types';

import { describeSdkError, sdk } from '@/lib/sdk';

/**
 * DPX-COMMERCIAL-001 Slice 5 — Admin Portal's read surface for the
 * commercial engine (Slices 1-4). Mirrors AdminCommercialCreditSettingsClient
 * / AdminCommissionAccountsClient exactly (both already existed from
 * Slice 1 — nothing new added to the backend). Plain fetch-on-mount
 * hooks, matching merchant-portal's existing wallet page convention
 * (no react-query dependency in this app).
 */
interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useAdminCreditSetting(
  ownerType: CommissionOwnerType,
): AsyncState<CommercialCreditSettingDto> & {
  reload: () => void;
} {
  const [state, setState] = React.useState<AsyncState<CommercialCreditSettingDto>>({
    data: null,
    loading: true,
    error: null,
  });
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: null }));
    sdk.adminCommercialCreditSettings
      .get(ownerType)
      .then((data) => {
        if (!cancelled) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setState({ data: null, loading: false, error: describeSdkError(loadError).description });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ownerType, nonce]);

  return {
    ...state,
    reload: () => {
      setNonce((n) => n + 1);
    },
  };
}

export function useAdminCommissionAccount(
  ownerType: CommissionOwnerType,
  ownerId: string | null,
): AsyncState<CommissionAccountDto> & { reload: () => void } {
  const [state, setState] = React.useState<AsyncState<CommissionAccountDto>>({
    data: null,
    loading: false,
    error: null,
  });
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    if (ownerId === null) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    sdk.adminCommissionAccounts
      .get(ownerType, ownerId)
      .then((data) => {
        if (!cancelled) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setState({ data: null, loading: false, error: describeSdkError(loadError).description });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ownerType, ownerId, nonce]);

  return {
    ...state,
    reload: () => {
      setNonce((n) => n + 1);
    },
  };
}

export function useAdminCommissionLedger(
  ownerType: CommissionOwnerType,
  ownerId: string | null,
  page: number,
  pageSize: number,
): AsyncState<PaginatedResult<CommissionLedgerEntryDto>> & { reload: () => void } {
  const [state, setState] = React.useState<AsyncState<PaginatedResult<CommissionLedgerEntryDto>>>({
    data: null,
    loading: false,
    error: null,
  });
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    if (ownerId === null) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: null }));
    sdk.adminCommissionAccounts
      .listLedger(ownerType, ownerId, { page, pageSize })
      .then((data) => {
        if (!cancelled) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setState({ data: null, loading: false, error: describeSdkError(loadError).description });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ownerType, ownerId, page, pageSize, nonce]);

  return {
    ...state,
    reload: () => {
      setNonce((n) => n + 1);
    },
  };
}
