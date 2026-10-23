"use client";

import { useCallback, useEffect, useState } from "react";
import { Timer, Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

type HabitSummary = {
  habitId: string;
  name: string;
  color: string;
  count: number;
  minutes: number;
};

type SummaryData = {
  totalCount: number;
  totalMinutes: number;
  byHabit: HabitSummary[];
};

type TimeBlockHabit = {
  id: string;
  name: string;
  color: string;
  startTime: string | null;
  endTime: string | null;
};

type PomodoroTodayCardProps = {
  date: string;
  title?: string;
};

export function PomodoroTodayCard({ date, title = "番茄钟" }: PomodoroTodayCardProps) {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [habits, setHabits] = useState<TimeBlockHabit[]>([]);

  const load = useCallback(async () => {
    const [summaryRes, habitsRes] = await Promise.all([
      fetch(`/api/pomodoro?summary=1&date=${date}`),
      fetch(`/api/pomodoro/habits?date=${date}`),
    ]);
    if (summaryRes.ok) setSummary(await summaryRes.json());
    if (habitsRes.ok) {
      const data = await habitsRes.json();
      setHabits(data.habits ?? []);
    }
  }, [date]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    const onUpdate = () => void load();
    window.addEventListener("lifeos:pomodoro-updated", onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener("lifeos:pomodoro-updated", onUpdate);
    };
  }, [load]);

  const startForHabit = (habitId: string) => {
    window.dispatchEvent(new CustomEvent("lifeos:start-pomodoro", { detail: { habitId } }));
  };

  const byHabitMap = new Map(summary?.byHabit.map((b) => [b.habitId, b]) ?? []);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b border-zinc-100 shrink-0">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Timer className="h-4 w-4 text-red-500" />
          {title}
        </CardTitle>
        {summary && summary.totalCount > 0 && (
          <span className="text-xs text-zinc-500">
            {summary.totalCount} 番茄 · {summary.totalMinutes} 分钟
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-1.5 p-3 pt-3 flex-1 min-h-0">
        {habits.length === 0 ? (
          <p className="text-sm text-zinc-500">未找到研究 / 创业 / 整理</p>
        ) : (
          habits.map((h) => {
            const stat = byHabitMap.get(h.id);
            return (
              <div
                key={h.id}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 group"
              >
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: h.color }} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-zinc-800 truncate block">{h.name}</span>
                  {h.startTime && h.endTime && (
                    <span className="text-[10px] text-zinc-400">{h.startTime}–{h.endTime}</span>
                  )}
                </div>
                {stat ? (
                  <span className="text-[11px] text-zinc-400 tabular-nums shrink-0">
                    {stat.count}🍅 {stat.minutes}m
                  </span>
                ) : (
                  <span className="text-[11px] text-zinc-300 shrink-0">—</span>
                )}
                <button
                  type="button"
                  onClick={() => startForHabit(h.id)}
                  className={cn(
                    "p-1 rounded-md text-red-500 hover:bg-red-50 transition-opacity",
                    "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  )}
                  title="开始番茄"
                >
                  <Play className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        )}
        {summary && summary.totalCount === 0 && habits.length > 0 && (
          <p className="text-xs text-zinc-400 pt-1">点击 ▶ 开始研究 / 创业 / 整理</p>
        )}
      </CardContent>
    </Card>
  );
}
