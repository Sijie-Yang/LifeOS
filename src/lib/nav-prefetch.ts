import { fetchJson } from "@/components/ui/PageState";
import { defaultWindow, timelineQuery, todayKey, type TimelineScale } from "@/lib/timeline";

const IDLE_CONCURRENCY = 2;

function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function timelineWindowUrls(today: string = todayKey()): string[] {
  return (["month", "year", "decade"] as TimelineScale[]).map((scale) => {
    const win = defaultWindow(scale, today);
    return `/api/timeline?${timelineQuery(scale, win.start, win.end)}`;
  });
}

/** API URLs to warm when hovering a sidebar link. Keys must match page cache keys. */
export const NAV_API_PREFETCH: Record<string, string[] | (() => string[])> = {
  "/projects": ["/api/projects", "/api/project-categories", "/api/contacts", "/api/goals"],
  "/loop": ["/api/projects/loop"],
  "/habits": ["/api/habits?view=all", "/api/projects", "/api/schedule"],
  "/calendar": () => timelineWindowUrls(),
  "/daily": () => [`/api/daily-log?date=${todayLocal()}`, "/api/reminders", "/api/insights"],
  "/timeline?scale=day": () => [`/api/daily-log?date=${todayLocal()}`, "/api/reminders", "/api/insights"],
  "/timeline?scale=powers": () => [`/api/daily-log?date=${todayLocal()}`],
  "/stream": () => {
    const shift = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      return `${y}-${m}-${String(d.getDate()).padStart(2, "0")}`;
    };
    return [`/api/stream?start=${shift(0)}&end=${shift(7)}`];
  },
  "/records": ["/api/records"],
  "/urges": ["/api/urges?includePrivate=1"],
  "/cooking": ["/api/cooking"],
  "/tasks": ["/api/tasks?filter=open"],
  "/checklists": ["/api/checklists"],
  "/meetings": ["/api/meetings"],
  "/travel": ["/api/travel"],
  "/timeline": () => timelineWindowUrls(),
  "/strategy": ["/api/strategy"],
  "/power": ["/api/power"],
  "/briefing": () => [`/api/briefing?date=${todayLocal()}`],
  "/contacts": ["/api/contacts"],
  "/opportunities": ["/api/opportunities?lane=career", "/api/contacts", "/api/projects", "/api/goals"],
  "/social": ["/api/opportunities?lane=life", "/api/contacts", "/api/projects", "/api/goals"],
  "/notes": ["/api/notes", "/api/projects"],
  "/reading": ["/api/reading"],
  "/library": ["/api/library", "/api/projects"],
  "/goals": ["/api/goals", "/api/achievements"],
  "/finance": ["/api/finance"],
  "/review": ["/api/review"],
  "/review/month": ["/api/review/period?type=month"],
  "/review/quarter": ["/api/review/period?type=quarter"],
  "/review/year": ["/api/review/period?type=year"],
  "/review/trends": ["/api/review"],
};

export function resolveNavPrefetchUrls(href: string): string[] {
  const entry = NAV_API_PREFETCH[href];
  if (!entry) return [];
  return typeof entry === "function" ? entry() : entry;
}

export function flattenPrefetchUrls(hrefs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const href of hrefs) {
    for (const url of resolveNavPrefetchUrls(href)) {
      if (seen.has(url)) continue;
      seen.add(url);
      out.push(url);
    }
  }
  return out;
}

export function prefetchNavRoute(href: string) {
  for (const url of resolveNavPrefetchUrls(href)) {
    void fetchJson(url).catch(() => {});
  }
}

export async function prefetchUrls(urls: string[], concurrency = IDLE_CONCURRENCY, signal?: AbortSignal) {
  let index = 0;
  const limit = Math.min(Math.max(concurrency, 1), Math.max(urls.length, 1));
  const worker = async () => {
    while (index < urls.length && !signal?.aborted) {
      const url = urls[index++];
      if (!url) break;
      await fetchJson(url).catch(() => {});
    }
  };
  await Promise.all(Array.from({ length: urls.length === 0 ? 0 : limit }, () => worker()));
}

export function scheduleIdlePrefetch(hrefs: string[], concurrency = IDLE_CONCURRENCY) {
  if (typeof window === "undefined" || hrefs.length === 0) return;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (connection?.saveData || ["slow-2g", "2g"].includes(connection?.effectiveType ?? "")) return;
  const controller = new AbortController();
  const start = () => {
    if (document.visibilityState === "hidden") return;
    void prefetchUrls(flattenPrefetchUrls(hrefs), concurrency, controller.signal);
  };
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(start, { timeout: 2500 });
    return () => { cancelIdleCallback(id); controller.abort(); };
  }
  const id = window.setTimeout(start, 400);
  return () => { window.clearTimeout(id); controller.abort(); };
}
