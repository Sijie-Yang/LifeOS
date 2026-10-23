"use client";

import { useCallback, useSyncExternalStore } from "react";
import { AGENT_POLL_MS } from "./agent-activity";
import type { AgentPayload } from "./agent-projects";

type Snapshot = { data: AgentPayload | null; error: string | null; loading: boolean };
const EMPTY: Snapshot = { data: null, error: null, loading: true };
type Store = {
  snapshot: Snapshot; listeners: Set<() => void>; pending: Promise<void> | null;
  timer?: ReturnType<typeof setTimeout>; failures: number; cleanup?: () => void;
};
const stores = new Map<string, Store>();
function getStore(date: string): Store {
  if (!stores.has(date)) {
    // Keep only a small history; mounted widgets always retain their store.
    for (const [key, store] of stores) if (stores.size >= 7 && !store.listeners.size && !store.pending) stores.delete(key);
    stores.set(date, { snapshot: EMPTY, listeners: new Set(), pending: null, failures: 0 });
  }
  return stores.get(date)!;
}

function publish(store: Store, snapshot: Snapshot) {
  store.snapshot = snapshot;
  for (const listener of store.listeners) listener();
}

async function pull(date: string, store: Store): Promise<void> {
  if (store.pending) return store.pending;
  clearTimeout(store.timer);
  const request = (async () => {
    try {
      const response = await fetch(`/api/agents?date=${encodeURIComponent(date)}`, { signal: AbortSignal.timeout(25_000), cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Agent 活动加载失败");
      store.failures = 0;
      publish(store, { data, error: null, loading: false });
    } catch (error) {
      store.failures++;
      publish(store, { ...store.snapshot, loading: false, error: error instanceof Error ? error.message : "Agent 活动加载失败" });
    } finally {
      store.pending = null;
      if (store.listeners.size && document.visibilityState !== "hidden") {
        const delay = Math.min(60_000, AGENT_POLL_MS * 2 ** Math.min(store.failures, 4));
        store.timer = setTimeout(() => { void pull(date, store); }, delay);
      }
    }
  })();
  store.pending = request;
  return request;
}

function subscribe(date: string, listener: () => void) {
  const store = getStore(date);
  store.listeners.add(listener);
  if (store.listeners.size === 1) {
    const onVisibility = () => {
      clearTimeout(store.timer);
      if (document.visibilityState !== "hidden") void pull(date, store);
    };
    document.addEventListener("visibilitychange", onVisibility);
    store.cleanup = () => document.removeEventListener("visibilitychange", onVisibility);
    if (document.visibilityState !== "hidden") void pull(date, store);
  }
  return () => {
    store.listeners.delete(listener);
    if (!store.listeners.size) { clearTimeout(store.timer); store.cleanup?.(); }
  };
}

/** One polling loop per day shared by the Agent panel and the daily activity squares. */
export function useAgentActivity(date: string) {
  const sub = useCallback((listener: () => void) => subscribe(date, listener), [date]);
  const snapshot = useSyncExternalStore(sub, () => getStore(date).snapshot, () => EMPTY);
  const refresh = useCallback(async () => {
    const store = getStore(date);
    // If a mutation just completed, don't accept a response issued before the write.
    if (store.pending) await store.pending;
    await pull(date, store);
  }, [date]);
  return { ...snapshot, refresh };
}
