'use client';

import { useCallback, useEffect, useState } from 'react';

type Result<T> = { items: T[]; model: string; createdAt: string };
type Failure = { error: string; code?: string };

// Loads a cached AI result and generates one on first visit
export function useAiResult<T>(kind: 'insights' | 'recommendations') {
  const [result, setResult] = useState<Result<T> | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const generate = useCallback(async () => {
    setGenerating(true);
    setFailure(null);
    const res = await fetch(`/api/ai/${kind}`, { method: 'POST' });
    const data = await res.json().catch(() => ({ error: 'Unexpected response' }));
    if (res.ok) setResult(data);
    else setFailure(data);
    setGenerating(false);
  }, [kind]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/ai/${kind}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((cached) => {
        if (cancelled) return;
        setLoading(false);
        if (cached) setResult(cached);
        else generate();
      })
      .catch(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [kind, generate]);

  return { result, failure, loading: loading || (generating && !result), generating, generate };
}
