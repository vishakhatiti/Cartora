import { useCallback, useEffect, useState } from 'react';

/**
 * Run an async loader and track its state. The loader gets an AbortSignal; a newer run (or unmount)
 * cancels the older request so a slow response can never overwrite a fresh one.
 */
export function useRemote(loader, deps) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ status: 'loading', data: s.data, error: null }));
    loader(controller.signal)
      .then((data) => setState({ status: 'ready', data, error: null }))
      .catch((error) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', data: null, error });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
