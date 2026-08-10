// ─── useApiCall — generic async hook ─────────────────────────────────────────
// Usage:
//   const { data, loading, error, run } = useApiCall(() => api.wallet.getBalance());
//   useEffect(() => { run(); }, []);

import { useState, useCallback } from 'react';
import { ApiError } from './api';

interface State<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApiCall<T>(fn: (...args: unknown[]) => Promise<T>) {
  const [state, setState] = useState<State<T>>({ data: null, loading: false, error: null });

  const run = useCallback(
    async (...args: unknown[]) => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const data = await fn(...args);
        setState({ data, loading: false, error: null });
        return data;
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : 'Something went wrong';
        setState((s) => ({ ...s, loading: false, error: msg }));
        return null;
      }
    },
    [fn],
  );

  return { ...state, run };
}
