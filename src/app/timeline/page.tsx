"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  CachedContent,
  PageSkeleton,
  fetchJson,
  invalidateFetchCache,
  peekFetchCache,
  usePeekFetchCache,
} from "@/components/ui/PageState";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { TimelineGantt } from "@/components/timeline/TimelineGantt";
import { DailyPlanPanel } from "@/components/daily/DailyPlanPanel";
import { LifePowersView } from "@/components/daily/LifePowersView";
import {
  defaultWindow,
  isGanttView,
  parseView,
  shiftWindow,
  timelineQuery,
  timelineViewQuery,
  todayKey,
  VIEW_LABELS,
  TIMELINE_VIEWS,
  type TimelinePayload,
  type TimelineScale,
  type TimelineView,
} from "@/lib/timeline";

function readView(search: URLSearchParams) {
  const view = parseView(search.get("scale"));
  if (view === "day") {
    return { view, start: "", end: "", date: search.get("date") ?? "" };
  }
  if (view === "powers") {
    return { view, start: "", end: "", date: "" };
  }
  const fallback = defaultWindow(view);
  return {
    view,
    start: search.get("start") ?? fallback.start,
    end: search.get("end") ?? fallback.end,
    date: "",
  };
}

function cacheKey(scale: TimelineScale, start: string, end: string) {
  return `/api/timeline?${timelineQuery(scale, start, end)}`;
}

const VIEW_TABS = TIMELINE_VIEWS.map((key) => ({
  key,
  label: VIEW_LABELS[key],
}));

export default function TimelinePage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="时间线" description="日看习惯与关账，九力看底线，月年和十年看项目排期。" />
          <PageSkeleton />
        </>
      }
    >
      <TimelinePageInner />
    </Suspense>
  );
}

function TimelinePageInner() {
  const searchParams = useSearchParams();
  const initial = useMemo(() => readView(searchParams), [searchParams]);
  const [view, setView] = useState<TimelineView>(initial.view);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const cacheRef = useRef(new Map<string, TimelinePayload>());
  const gantt = isGanttView(view);
  const url = gantt ? cacheKey(view, start, end) : "";

  const cached = usePeekFetchCache<TimelinePayload>(url || "__timeline_idle__");
  const [data, setData] = useState<TimelinePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(gantt);
  const payload = data ?? (gantt ? cached : null);

  const applyPayload = useCallback((next: TimelinePayload, key: string) => {
    cacheRef.current.set(key, next);
    setData(next);
    setError(null);
    setLoading(false);
  }, []);

  const peekLocal = useCallback((key: string) => {
    return cacheRef.current.get(key) ?? peekFetchCache<TimelinePayload>(key);
  }, []);

  const syncUrl = useCallback((nextView: TimelineView, extra?: { start?: string; end?: string; date?: string }) => {
    window.history.replaceState(null, "", `/timeline?${timelineViewQuery(nextView, extra)}`);
  }, []);

  const loadWindow = useCallback(
    async (nextScale: TimelineScale, nextStart: string, nextEnd: string, background = false) => {
      const key = cacheKey(nextScale, nextStart, nextEnd);
      const hit = peekLocal(key);
      if (hit) {
        cacheRef.current.set(key, hit);
        if (!background) applyPayload(hit, key);
      } else if (!background) {
        setLoading(true);
      }
      try {
        const next = await fetchJson<TimelinePayload>(key);
        cacheRef.current.set(key, next);
        if (!background) applyPayload(next, key);
      } catch (e) {
        if (!background && !hit) {
          setError(e instanceof Error ? e.message : "加载失败");
          setLoading(false);
        }
      }
    },
    [applyPayload, peekLocal]
  );

  useEffect(() => {
    if (!gantt) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadWindow(view, start, end);
    });
    return () => {
      cancelled = true;
    };
  }, [gantt, loadWindow, view, start, end]);

  useEffect(() => {
    if (!gantt) return;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      const today = payload?.today ?? todayKey();
      for (const other of ["month", "year", "decade"] as TimelineScale[]) {
        if (other === view) continue;
        const win = defaultWindow(other, today);
        void loadWindow(other, win.start, win.end, true);
      }
      const prev = shiftWindow(view, start, end, -1);
      const next = shiftWindow(view, start, end, 1);
      void loadWindow(view, prev.start, prev.end, true);
      void loadWindow(view, next.start, next.end, true);
    };
    const id =
      typeof requestIdleCallback === "function"
        ? requestIdleCallback(run, { timeout: 1500 })
        : window.setTimeout(run, 200);
    return () => {
      cancelled = true;
      if (typeof cancelIdleCallback === "function") cancelIdleCallback(id);
      else clearTimeout(id);
    };
  }, [gantt, payload?.today, end, loadWindow, view, start]);

  useEffect(() => {
    const onPop = () => {
      const next = readView(new URLSearchParams(window.location.search));
      setView(next.view);
      setStart(next.start);
      setEnd(next.end);
      if (isGanttView(next.view)) {
        const key = cacheKey(next.view, next.start, next.end);
        const cachedWindow = peekLocal(key);
        if (cachedWindow) applyPayload(cachedWindow, key);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [applyPayload, peekLocal]);

  const jumpTo = (nextView: TimelineView, extra?: { start?: string; end?: string; date?: string }) => {
    setView(nextView);
    setStart(extra?.start ?? "");
    setEnd(extra?.end ?? "");
    syncUrl(nextView, extra);
    if (isGanttView(nextView) && extra?.start && extra?.end) {
      const key = cacheKey(nextView, extra.start, extra.end);
      const cachedWindow = peekLocal(key);
      if (cachedWindow) applyPayload(cachedWindow, key);
    } else {
      setLoading(false);
    }
  };

  const changeView = (nextView: TimelineView) => {
    const today = payload?.today ?? todayKey();
    if (nextView === "day") {
      jumpTo("day", { date: searchParams.get("date") || undefined });
      return;
    }
    if (nextView === "powers") {
      jumpTo("powers");
      return;
    }
    const win = defaultWindow(nextView, today);
    jumpTo(nextView, win);
  };

  const refreshTimeline = useCallback(async () => {
    if (!isGanttView(view)) return;
    cacheRef.current.clear();
    invalidateFetchCache("/api/timeline");
    await loadWindow(view, start, end);
  }, [end, loadWindow, view, start]);

  return (
    <>
      <PageHeader
        title="时间线"
        description="日看习惯与关账，九力看底线，月年和十年看项目排期。"
        action={
          view === "day" ? (
            <Link href="/stream" className="text-sm text-indigo-600 hover:underline">
              事件流 →
            </Link>
          ) : (
            <Link href="/timeline?scale=day" className="text-sm text-indigo-600 hover:underline">
              今日执行 →
            </Link>
          )
        }
      />
      <FilterTabs
        tabs={VIEW_TABS}
        value={view}
        onChange={(key) => changeView(key as TimelineView)}
        size="sm"
      />
      {view === "day" && <DailyPlanPanel embedded />}
      {view === "powers" && <LifePowersView />}
      {gantt && (
        <CachedContent
          loading={loading && !payload}
          error={error}
          onRetry={() => void loadWindow(view, start, end)}
          hasData={!!payload}
        >
          {payload && (
            <TimelineGantt
              key={view}
              data={payload}
              scale={view}
              windowStart={start}
              windowEnd={end}
              onShift={(delta) => {
                const win = shiftWindow(view, start, end, delta);
                jumpTo(view, win);
              }}
              onToday={() => {
                const win = defaultWindow(view, payload.today);
                jumpTo(view, win);
              }}
              onRefresh={refreshTimeline}
            />
          )}
        </CachedContent>
      )}
    </>
  );
}
