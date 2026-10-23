type CacheEntry = { data: unknown; at: number };

const store = new Map<string, CacheEntry>();
const listeners = new Set<() => void>();

const DEFAULT_TTL_MS = 120_000;
const STORAGE_KEY = "lifeos:fetch-cache:v1";
const MAX_PERSISTED = 80;

let hydrated = false;
let revision = 0;
let persistTimer: ReturnType<typeof setTimeout> | undefined;
const revisions = new Map<string, number>();
export function fetchCacheRevision(url: string) {
  if (!revisions.has(url)) revisions.set(url, revision);
  return revisions.get(url)!;
}

// Coalesce bursts of prefetched responses instead of serializing the whole cache per response.
function schedulePersist() {
  if (!canUseStorage() || persistTimer) return;
  persistTimer = setTimeout(() => { persistTimer = undefined; persistToSession(); }, 100);
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

function emitFetchCache() {
  for (const listener of listeners) listener();
}

export function subscribeFetchCache(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => { listeners.delete(onStoreChange); };
}

/** Load sessionStorage into memory. Safe in effects / getSnapshot, not during SSR render. */
export function hydrateFetchCacheFromSession(opts?: { silent?: boolean }) {
  if (hydrated || !canUseStorage()) return;
  hydrated = true;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
    let changed = false;
    for (const [url, entry] of Object.entries(parsed)) {
      if (entry && typeof entry.at === "number" && "data" in entry && !store.has(url)) {
        store.set(url, entry);
        changed = true;
      }
    }
    if (changed && !opts?.silent) emitFetchCache();
  } catch {
    // ignore corrupt cache
  }
}

function persistToSession() {
  if (!canUseStorage()) return;
  try {
    const entries = [...store.entries()]
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, MAX_PERSISTED);
    const obj: Record<string, CacheEntry> = {};
    for (const [url, entry] of entries) obj[url] = entry;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // quota / private mode
  }
}

/**
 * Memory-only read. Does not touch sessionStorage, so it is safe during SSR
 * and the hydration render (both see an empty store on a full page load).
 */
export function peekFetchCache<T>(url: string): T | null {
  const hit = store.get(url);
  return hit ? (hit.data as T) : null;
}

/** Fresh-only read. Prefer peekFetchCache + isFetchCacheFresh for SWR. */
export function getFetchCache<T>(url: string, ttlMs = DEFAULT_TTL_MS): T | null {
  hydrateFetchCacheFromSession();
  const hit = store.get(url);
  if (!hit) return null;
  if (Date.now() - hit.at > ttlMs) return null;
  return hit.data as T;
}

export function setFetchCache(url: string, data: unknown, at = Date.now()) {
  hydrateFetchCacheFromSession();
  store.set(url, { data, at });
  schedulePersist();
  emitFetchCache();
}

export function invalidateFetchCache(match?: string | RegExp) {
  revision += 1;
  const matches = (key: string) => {
    if (!match) return true;
    if (typeof match === "string") return key.startsWith(match);
    match.lastIndex = 0;
    return match.test(key);
  };
  for (const key of revisions.keys()) if (matches(key)) revisions.set(key, revision);
  hydrateFetchCacheFromSession();
  if (!match) {
    store.clear();
    try { if (canUseStorage()) sessionStorage.removeItem(STORAGE_KEY); } catch { /* storage can be blocked */ }
    emitFetchCache();
    return;
  }
  for (const key of store.keys()) {
    if (matches(key)) {
      store.delete(key);
    }
  }
  schedulePersist();
  emitFetchCache();
}

export function isFetchCacheFresh(url: string, ttlMs = DEFAULT_TTL_MS) {
  hydrateFetchCacheFromSession();
  const hit = store.get(url);
  return Boolean(hit && Date.now() - hit.at <= ttlMs);
}

export const FETCH_CACHE_DEFAULT_TTL = DEFAULT_TTL_MS;
