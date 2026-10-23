"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type DependencyList } from "react";
import { Button } from "@/components/ui/Button";
import {
  FETCH_CACHE_DEFAULT_TTL,
  fetchCacheRevision,
  getFetchCache,
  hydrateFetchCacheFromSession,
  invalidateFetchCache,
  isFetchCacheFresh,
  peekFetchCache,
  setFetchCache,
  subscribeFetchCache,
} from "@/lib/fetch-cache";

export { invalidateFetchCache, getFetchCache, peekFetchCache };

/** Client snapshot may include sessionStorage; server/hydration snapshot is always null. */
export function usePeekFetchCache<T>(url: string): T | null {
  return useSyncExternalStore(
    subscribeFetchCache,
    () => {
      hydrateFetchCacheFromSession({ silent: true });
      return peekFetchCache<T>(url);
    },
    () => null
  );
}

export function PageLoading({ label = "加载中..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex items-center gap-3 text-zinc-500 text-sm">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-500" />
        {label}
      </div>
    </div>
  );
}

export function PageError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-8 text-center">
      <p className="text-red-700 mb-4">{message}</p>
      {onRetry && <Button onClick={onRetry}>重试</Button>}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-3 animate-pulse" aria-hidden>
      <div className="h-4 w-36 rounded bg-zinc-200" />
      <div className="h-28 rounded-2xl bg-zinc-100" />
      <div className="h-28 rounded-2xl bg-zinc-100" />
      <div className="h-28 rounded-2xl bg-zinc-100" />
    </div>
  );
}

/** Content-area gate: keep headers visible; only the body waits. */
export function CachedContent({
  loading,
  error,
  onRetry,
  hasData,
  children,
}: {
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  hasData: boolean;
  children: React.ReactNode;
}) {
  if (error && !hasData) return <PageError message={error} onRetry={onRetry} />;
  if (loading && !hasData) return <PageSkeleton />;
  return <>
    {error && <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      <span>更新失败，当前显示已有数据。{error}</span>
      {onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>重试</Button>}
    </div>}
    {children}
  </>;
}

type FetchJsonOptions = {
  /** Skip cache and always fetch fresh data */
  force?: boolean;
  /** Freshness window in ms (default 120s). Stale entries still returned immediately. */
  ttl?: number;
};

const inflight = new Map<string, { promise: Promise<unknown>; revision: number }>();

async function fetchFresh<T>(url: string, revision: number): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(25_000) });
  } catch (e) {
    if (e instanceof DOMException && e.name === "TimeoutError") {
      throw new Error("请求超时，请刷新重试或确认 LifeOS 服务是否在运行");
    }
    throw new Error(e instanceof Error ? e.message : "网络请求失败，请确认开发服务是否在运行");
  }
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "请求失败");
  if (revision === fetchCacheRevision(url)) setFetchCache(url, json);
  return json as T;
}

/**
 * Stale-while-revalidate: returns cached data immediately (even past TTL),
 * and refreshes in the background when stale.
 */
export async function fetchJson<T>(url: string, opts?: FetchJsonOptions): Promise<T> {
  const ttl = opts?.ttl ?? FETCH_CACHE_DEFAULT_TTL;
  hydrateFetchCacheFromSession();

  const revision = fetchCacheRevision(url);
  const existing = inflight.get(url);
  const pending = existing?.revision === revision ? existing.promise as Promise<T> : undefined;
  const request = () => {
    if (pending) return pending;
    const promise = fetchFresh<T>(url, revision).finally(() => {
      if (inflight.get(url)?.promise === promise) inflight.delete(url);
    });
    inflight.set(url, { promise, revision });
    return promise;
  };

  if (!opts?.force) {
    const stale = peekFetchCache<T>(url);
    if (stale != null) {
      if (!isFetchCacheFresh(url, ttl)) void request().catch(() => { /* retain cached data on background failure */ });
      return stale;
    }
  }
  return request();
}

/** Checked writes: callers keep their form and show the error on failure. */
export async function mutateJson<T = unknown>(url: string, init: RequestInit): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(url, { ...init, headers });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(json?.error || `保存失败（${response.status}）`);
  const resource = url.split("?")[0].split("/").slice(0, 3).join("/");
  invalidateFetchCache(resource);
  if (resource === "/api/contacts" || resource === "/api/categories") {
    for (const prefix of ["/api/contacts", "/api/categories", "/api/reminders", "/api/dashboard", "/api/search"]) invalidateFetchCache(prefix);
  }
  return json as T;
}

/** After a mutation: bust cache prefix and fetch fresh data. */
export async function refetchJson<T>(url: string): Promise<T> {
  const prefix = url.split("?")[0] ?? url;
  invalidateFetchCache(prefix);
  return fetchJson<T>(url, { force: true });
}

/** True only when none of the keys have any cached data (including stale). */
export function shouldShowPageLoading(cacheKeys: string[]) {
  return !cacheKeys.some((key) => peekFetchCache(key) != null);
}

/**
 * Hydrate from cache on first paint; only show full-page spinner when cache is empty.
 * Pass a loader that uses fetchJson so SWR applies.
 */
export function useCachedPageData<T>(
  cacheKeys: string | string[],
  loader: () => Promise<T>,
  deps: DependencyList = []
) {
  const keys = Array.isArray(cacheKeys) ? cacheKeys : [cacheKeys];
  const primary = keys[0]!;

  const [data, setData] = useState<T | null>(() => peekFetchCache<T>(primary));
  const [loading, setLoading] = useState(() => shouldShowPageLoading(keys));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const cold = shouldShowPageLoading(keys);
    if (cold) setLoading(true);
    if (cold) setError(null);
    try {
      const next = await loader();
      setData(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo -- generic loader hook receives its dependency list from the caller
  }, deps);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    data,
    setData,
    loading,
    error,
    reload,
    showLoading: loading && data == null,
  };
}
