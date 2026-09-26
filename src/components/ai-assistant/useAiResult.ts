'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { primeJson, useCachedJson } from '@/lib/useCachedJson';

type Result<T> = { items: T[]; model: string; createdAt: string };
type Failure = { error: string; code?: string };

// Shows the cached AI result instantly (from memory on repeat visits) and generates one on first visit
export function useAiResult<T>(kind: 'insights' | 'recommendations') {
  const url = `/api/ai/${kind}`;
  const { data: cached } = useCachedJson<Result<T> | null>(url);
  const [generated, setGenerated] = useState<Result<T> | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [generating, setGenerating] = useState(false);
  const attempted = useRef(false);

  const generate = useCallback(async () => {
    attempted.current = true;
    setGenerating(true);
    setFailure(null);
    const res = await fetch(url, { method: 'POST' });
    const data = await res.json().catch(() => ({ error: 'Unexpected response' }));
    if (res.ok) {
      setGenerated(data);
      primeJson(url, data);
    } else {
      setFailure(data);
    }
    setGenerating(false);
  }, [url]);

  // Nothing cached yet: generate once automatically
  useEffect(() => {
    if (cached === null && !attempted.current) generate();
  }, [cached, generate]);

  const result = generated ?? cached ?? null;
  return { result, failure, loading: cached === undefined || (generating && !result), generating, generate };
}
