import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchApiStatus } from '../lib/api.js';

/** Tracks the API status: 'checking' | 'ready' | 'db_down' | 'unreachable', with a recheck function. */
export function useApiStatus() {
  const [status, setStatus] = useState('checking');
  const controllerRef = useRef(null);

  const check = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus('checking');
    fetchApiStatus(controller.signal).then((result) => {
      if (!controller.signal.aborted) setStatus(result);
    });
  }, []);

  useEffect(() => {
    check();
    return () => controllerRef.current?.abort();
  }, [check]);

  return { status, check };
}
