"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { EventTimerDto } from "./event-timers";
import { invalidateFetchCache } from "./fetch-cache";

type Snapshot = { timers: EventTimerDto[]; loading: boolean; error: string | null; offset: number; clock: number };
const EMPTY: Snapshot = { timers: [], loading: true, error: null, offset: 0, clock: 0 };
type Store = { snapshot: Snapshot; listeners: Set<() => void>; pending: Promise<void> | null; timer?: ReturnType<typeof setTimeout>; cleanup?: () => void };
const stores = new Map<string, Store>();
let revision = 0;
function getStore(date: string): Store {
  if (!stores.has(date)) {
    for (const [key, store] of stores) if (stores.size >= 8 && !store.listeners.size && !store.pending) stores.delete(key);
    stores.set(date, { snapshot: EMPTY, listeners: new Set(), pending: null });
  }
  return stores.get(date)!;
}
function publish(store: Store, next: Snapshot) {
  store.snapshot = next;
  for (const listener of store.listeners) listener();
}
async function pull(date: string, store: Store): Promise<void> {
  if (store.pending) return store.pending;
  clearTimeout(store.timer);
  const version = revision;
  store.pending = (async () => {
    try {
      const from = new Date(`${date}T00:00:00`), to = new Date(from); to.setDate(to.getDate() + 1);
      const qs = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
      const response = await fetch(`/api/event-timers?${qs}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "计时加载失败");
      if (version === revision) publish(store, { timers: data.timers, loading: false, error: null, offset: data.serverNow - Date.now(), clock: data.serverNow });
    } catch (error) {
      if (version === revision) publish(store, { ...store.snapshot, loading: false, error: error instanceof Error ? error.message : "计时加载失败" });
    } finally {
      store.pending = null;
      if (store.listeners.size && document.visibilityState !== "hidden") store.timer = setTimeout(() => void pull(date, store), 10_000);
    }
  })();
  return store.pending;
}
function subscribe(date: string, listener: () => void) {
  const store = getStore(date);
  store.listeners.add(listener);
  if (store.listeners.size === 1) {
    const resume = () => { clearTimeout(store.timer); if (document.visibilityState !== "hidden") void pull(date, store); };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    store.cleanup = () => { document.removeEventListener("visibilitychange", resume); window.removeEventListener("focus", resume); };
    resume();
  }
  return () => { store.listeners.delete(listener); if (!store.listeners.size) { clearTimeout(store.timer); store.cleanup?.(); } };
}
export function useEventTimers(date: string) {
  const sub = useCallback((listener: () => void) => subscribe(date, listener), [date]);
  return useSyncExternalStore(sub, () => getStore(date).snapshot, () => EMPTY);
}
export async function mutateEventTimer(url: string, body: unknown, method = "PATCH") {
  revision++;
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "计时保存失败");
  revision++;
  invalidateFetchCache("/api/daily-log");
  await Promise.all([...stores].filter(([, s]) => s.listeners.size).map(async ([date, store]) => {
    if (store.pending) await store.pending;
    await pull(date, store);
  }));
  return data as EventTimerDto;
}
