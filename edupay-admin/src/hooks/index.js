// src/hooks/index.js
import { useState, useEffect, useCallback } from "react";

export function useApi(fn, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const run = useCallback(async (...args) => {
    setLoading(true); setError(null);
    try { const r = await fn(...args); setData(r); return r; }
    catch (e) { setError(e.message); }
    finally   { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { run(); }, [run]); // eslint-disable-line
  return { data, loading, error, refetch: run };
}

export function useToast() {
  const [toasts, setToasts] = useState([]);
  function toast(msg, type = "info") {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }
  return { toasts, toast };
}
