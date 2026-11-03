import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../lib/api';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  setData: (value: T | null) => void;
}

/**
 * Small data-loading hook. The loader is kept in a ref so callers can pass an
 * inline closure and control re-fetching through the dependency list.
 */
export function useApi<T>(loader: () => Promise<T>, deps: unknown[] = []): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const sequence = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(async () => {
    const id = ++sequence.current;
    setLoading(true);
    setError(null);
    try {
      const result = await loaderRef.current();
      if (id !== sequence.current) return;
      setData(result);
    } catch (caught) {
      if (id !== sequence.current) return;
      setError(errorMessage(caught));
    } finally {
      if (id === sequence.current) setLoading(false);
    }
  }, deps);

  useEffect(() => {
    void reload();
    return () => {
      sequence.current += 1;
    };
  }, [reload]);

  return { data, loading, error, reload, setData };
}

interface AsyncAction {
  busy: boolean;
  error: string | null;
  setError: (value: string | null) => void;
  run: (
    task: () => Promise<unknown>,
    options?: { onSuccess?: (value: unknown) => void },
  ) => Promise<boolean>;
  reset: () => void;
}

export function useAsyncAction(): AsyncAction {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (task: () => Promise<unknown>, options?: { onSuccess?: (value: unknown) => void }) => {
      setBusy(true);
      setError(null);
      try {
        const value = await task();
        options?.onSuccess?.(value);
        return true;
      } catch (caught) {
        setError(errorMessage(caught));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const reset = useCallback(() => setError(null), []);

  return { busy, error, setError, run, reset };
}
