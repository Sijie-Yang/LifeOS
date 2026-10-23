"use client";

import { useCallback, useEffect, useState } from "react";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { DateNav } from "@/components/ui/DateNav";
import { ReviewStatsTrend, type ReviewTrendPoint } from "@/components/review/ReviewStatsTrend";
import { WellnessTrendChart, type WellnessTrendPoint } from "@/components/wellness/WellnessTrendChart";
import {
  CachedContent,
  fetchJson,
  peekFetchCache,
  shouldShowPageLoading,
} from "@/components/ui/PageState";

type TrendTab = "week" | "month" | "quarter" | "year";

const TABS: { key: TrendTab; label: string }[] = [
  { key: "week", label: "周" },
  { key: "month", label: "月" },
  { key: "quarter", label: "季" },
  { key: "year", label: "年" },
];

type WeekTrendData = {
  weekStart: string;
  weekLabel: string;
  prev: string;
  next: string;
  statsTrend: ReviewTrendPoint[];
};

type PeriodTrendData = {
  periodKey: string;
  periodLabel: string;
  prev: string;
  next: string;
  statsTrend: ReviewTrendPoint[];
};

export function ReviewTrendsPanel() {
  const [tab, setTab] = useState<TrendTab>("week");
  const [weekData, setWeekData] = useState<WeekTrendData | null>(() =>
    peekFetchCache<WeekTrendData>("/api/review")
  );
  const [periodData, setPeriodData] = useState<PeriodTrendData | null>(null);
  const [wellnessTrend, setWellnessTrend] = useState<WellnessTrendPoint[]>(
    () => peekFetchCache<{ wellnessTrend: WellnessTrendPoint[] }>("/api/insights?wellness=1")?.wellnessTrend ?? []
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => shouldShowPageLoading(["/api/review"]));

  const loadWeek = useCallback(async (weekStart?: string | null) => {
    const qs = weekStart ? `?weekStart=${encodeURIComponent(weekStart)}` : "";
    const key = `/api/review${qs}`;
    if (shouldShowPageLoading([key])) setLoading(true);
    setError(null);
    try {
      const week = await fetchJson<WeekTrendData>(key);
      setWeekData(week);
      const wellness = await fetchJson<{ wellnessTrend: WellnessTrendPoint[] }>(
        "/api/insights?wellness=1"
      ).catch(() => ({ wellnessTrend: [] as WellnessTrendPoint[] }));
      setWellnessTrend(wellness.wellnessTrend ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPeriod = useCallback(async (type: "month" | "quarter" | "year", key?: string | null) => {
    const qs = key ? `type=${type}&key=${encodeURIComponent(key)}` : `type=${type}`;
    const url = `/api/review/period?${qs}`;
    if (shouldShowPageLoading([url])) setLoading(true);
    setError(null);
    try {
      setPeriodData(await fetchJson<PeriodTrendData>(url));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "week") loadWeek();
    else loadPeriod(tab);
  }, [tab, loadWeek, loadPeriod]);

  const periodUnit =
    tab === "week" ? "周" : tab === "month" ? "月" : tab === "quarter" ? "季" : "年";
  const showFinance = tab !== "week";

  const navLabel = tab === "week" ? "周" : periodUnit;
  const currentLabel = tab === "week" ? weekData?.weekLabel : periodData?.periodLabel;
  const currentKey = tab === "week" ? weekData?.weekStart : periodData?.periodKey;
  const statsTrend = tab === "week" ? weekData?.statsTrend : periodData?.statsTrend;
  const prev = tab === "week" ? weekData?.prev : periodData?.prev;
  const next = tab === "week" ? weekData?.next : periodData?.next;

  const goPrev = () => {
    if (!prev) return;
    if (tab === "week") loadWeek(prev);
    else loadPeriod(tab, prev);
  };

  const goNext = () => {
    if (!next) return;
    if (tab === "week") loadWeek(next);
    else loadPeriod(tab, next);
  };

  return (
    <>
      <FilterTabs tabs={TABS} value={tab} onChange={(k) => setTab(k as TrendTab)} />

      <CachedContent
        loading={loading}
        error={error}
        onRetry={() => (tab === "week" ? loadWeek() : loadPeriod(tab))}
        hasData={!!(tab === "week" ? weekData : periodData)}
      >
          <DateNav
            label={currentLabel || "—"}
            prevLabel={`上${navLabel}`}
            nextLabel={`下${navLabel}`}
            onPrev={goPrev}
            onNext={goNext}
            prevDisabled={!prev || loading}
            nextDisabled={!next || loading}
          />

          {statsTrend && currentKey && (
            <>
              <ReviewStatsTrend
                data={statsTrend}
                currentKey={currentKey}
                showFinance={showFinance}
                periodUnit={periodUnit}
              />
              {tab === "week" && wellnessTrend.length > 0 && (
                <WellnessTrendChart data={wellnessTrend} />
              )}
            </>
          )}
      </CachedContent>
    </>
  );
}
