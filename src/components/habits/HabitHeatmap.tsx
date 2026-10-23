"use client";

import { useMemo } from "react";

type Entry = { date: string; rate: number; done: number; expected: number };

function intensityColor(rate: number): string {
  if (rate === 0) return "bg-zinc-100";
  if (rate < 40) return "bg-emerald-200";
  if (rate < 70) return "bg-emerald-400";
  if (rate < 100) return "bg-emerald-500";
  return "bg-emerald-600";
}

export function HabitHeatmap({ year, entries }: { year: number; entries: Entry[] }) {
  const byDate = useMemo(() => new Map(entries.map((e) => [e.date, e])), [entries]);

  const weeks: Array<Array<{ date: string; rate: number; label: string } | null>> = [];
  const start = new Date(year, 0, 1);
  const end = new Date(Math.min(Date.now(), new Date(year, 11, 31).getTime()));

  let cursor = new Date(start);
  const pad = (start.getDay() + 6) % 7;
  let week: Array<{ date: string; rate: number; label: string } | null> = Array(pad).fill(null);

  while (cursor <= end) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const entry = byDate.get(dateStr);
    week.push(
      entry
        ? { date: dateStr, rate: entry.rate, label: `${dateStr}: ${entry.done}/${entry.expected} (${entry.rate}%)` }
        : { date: dateStr, rate: 0, label: `${dateStr}: 无安排` }
    );
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
  }
  if (week.length) weeks.push([...week, ...Array(7 - week.length).fill(null)]);

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        {weeks.map((w, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {w.map((cell, di) =>
              cell ? (
                <div
                  key={cell.date}
                  className={`h-3 w-3 rounded-sm ${intensityColor(cell.rate)}`}
                  title={cell.label}
                />
              ) : (
                <div key={`e-${wi}-${di}`} className="h-3 w-3" />
              )
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3 text-xs text-zinc-500">
        <span>少</span>
        {[0, 40, 70, 100].map((r) => (
          <div key={r} className={`h-3 w-3 rounded-sm ${intensityColor(r)}`} />
        ))}
        <span>多</span>
        <span className="ml-2">{year} 习惯完成度</span>
      </div>
    </div>
  );
}
