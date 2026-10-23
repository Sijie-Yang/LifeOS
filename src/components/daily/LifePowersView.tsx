"use client";

import { useCallback, useEffect, useState } from "react";
import { CachedContent, fetchJson, invalidateFetchCache } from "@/components/ui/PageState";
import { NinePowersMap, toggleLifePowerLever } from "@/components/daily/NinePowersMap";
import { toDateString } from "@/lib/utils";
import type { LifePowerLever, LifePowersResult } from "@/lib/life-powers";

type PowersData = {
  date: string;
  lifePowers?: LifePowersResult;
};

export function LifePowersView() {
  const today = toDateString();
  const [data, setData] = useState<PowersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (force = false) => {
    if (force) invalidateFetchCache("/api/daily-log");
    setError(null);
    try {
      const next = await fetchJson<PowersData>(`/api/daily-log?date=${today}`, { force });
      setData(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const toggleLever = async (lever: LifePowerLever) => {
    setBusy(true);
    try {
      await toggleLifePowerLever(lever, today);
      invalidateFetchCache("/api/daily-log");
      invalidateFetchCache("/api/stream");
      await load(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CachedContent loading={loading} error={error} onRetry={() => void load(true)} hasData={!!data}>
      {data?.lifePowers ? (
        <NinePowersMap
          lifePowers={data.lifePowers}
          date={data.date}
          onRefresh={() => void load(true)}
          onLeverToggle={(lever) => void toggleLever(lever)}
          busy={busy}
        />
      ) : (
        <p className="rounded-2xl border border-dashed border-zinc-200 bg-white px-4 py-12 text-center text-sm text-zinc-500">
          今天还没有九力数据。
        </p>
      )}
    </CachedContent>
  );
}
