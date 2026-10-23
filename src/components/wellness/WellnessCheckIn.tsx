"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Label, Field, Textarea } from "@/components/ui/Input";
import { ProgressBar } from "@/components/ui/Badge";
import { invalidateFetchCache } from "@/components/ui/PageState";
import { cn, toDateString } from "@/lib/utils";
import { WELLNESS_SCORES, type WellnessScore } from "@/lib/wellness-scores";
import { DEFAULT_BEDTIME_TARGET, DEFAULT_PLANNED_SLEEP } from "@/lib/app-settings";
import { formatSleepDuration, sleepDurationHours } from "@/lib/sleep-window";
import { format, parseISO, subDays } from "date-fns";
import { CheckCircle2, Circle, X } from "lucide-react";

type WellnessState = {
  energyMorning: number | null;
  drainMorning: number | null;
  wakeTime: string | null;
  plannedSleepTime: string | null;
  sleepTime: string | null;
  energyEvening: number | null;
  drainEvening: number | null;
  reflection: string;
};

type HabitItem = {
  id: string;
  name: string;
  color: string;
  checked: boolean;
};

function RatingPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: WellnessScore) => void;
}) {
  return (
    <Field>
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-1.5 mt-1">
        {WELLNESS_SCORES.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`h-8 flex-1 rounded-lg text-sm font-medium transition-colors ${
              value === n
                ? "bg-indigo-600 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </Field>
  );
}

export const WELLNESS_CHECKIN_EVENT = "lifeos:wellness-checkin";

export function WellnessCheckIn() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(WELLNESS_CHECKIN_EVENT, onOpen);
    return () => window.removeEventListener(WELLNESS_CHECKIN_EVENT, onOpen);
  }, []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [habits, setHabits] = useState<HabitItem[]>([]);
  const [habitBusy, setHabitBusy] = useState<string | null>(null);
  const [lastNightBedtime, setLastNightBedtime] = useState<string | null>(null);
  const [form, setForm] = useState<WellnessState>({
    energyMorning: null,
    drainMorning: null,
    wakeTime: null,
    plannedSleepTime: DEFAULT_PLANNED_SLEEP,
    sleepTime: DEFAULT_BEDTIME_TARGET,
    energyEvening: null,
    drainEvening: null,
    reflection: "",
  });

  const load = useCallback(async () => {
    const date = toDateString();
    const res = await fetch(`/api/daily-log?date=${date}`);
    if (!res.ok) return;
    const data = await res.json();
    setForm({
      energyMorning: data.log?.energyMorning ?? null,
      drainMorning: data.log?.drainMorning ?? null,
      wakeTime: data.log?.wakeTime ?? null,
      plannedSleepTime: data.log?.plannedSleepTime || DEFAULT_PLANNED_SLEEP,
      sleepTime: data.log?.sleepTime || DEFAULT_BEDTIME_TARGET,
      energyEvening: data.log?.energyEvening ?? null,
      drainEvening: data.log?.drainEvening ?? null,
      reflection: data.log?.reflection ?? "",
    });
    setLastNightBedtime(data.previousBedtime ?? null);
    setHabits(
      (data.habits ?? []).map((h: HabitItem) => ({
        id: h.id,
        name: h.name,
        color: h.color,
        checked: h.checked,
      }))
    );
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const toggleHabit = async (habitId: string, checked: boolean) => {
    const date = toDateString();
    setHabitBusy(habitId);
    setHabits((prev) =>
      prev.map((h) => (h.id === habitId ? { ...h, checked: !checked } : h))
    );
    try {
      if (checked) {
        await fetch(`/api/habits/${habitId}/checkin?date=${encodeURIComponent(date)}`, {
          method: "DELETE",
        });
      } else {
        const res = await fetch(`/api/habits/${habitId}/checkin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, completed: true }),
        });
        if (!res.ok) void load();
      }
      invalidateFetchCache("/api/daily-log");
      invalidateFetchCache("/api/habits");
      invalidateFetchCache("/api/stream");
      invalidateFetchCache("/api/dashboard");
      invalidateFetchCache("/api/calendar");
    } finally {
      setHabitBusy(null);
    }
  };

  const save = async () => {
    setSaving(true);
    const date = toDateString();
    await fetch("/api/daily-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        energyMorning: form.energyMorning,
        drainMorning: form.drainMorning,
        wakeTime: form.wakeTime,
        plannedSleepTime: form.plannedSleepTime || DEFAULT_PLANNED_SLEEP,
        sleepTime: form.sleepTime || DEFAULT_BEDTIME_TARGET,
        energyEvening: form.energyEvening,
        drainEvening: form.drainEvening,
        reflection: form.reflection,
      }),
    });
    invalidateFetchCache("/api/daily-log");
    invalidateFetchCache("/api/dashboard");
    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setOpen(false);
    }, 1200);
  };

  const habitsDone = habits.filter((h) => h.checked).length;
  const habitsTotal = habits.length;
  const habitsPct = habitsTotal > 0 ? Math.round((habitsDone / habitsTotal) * 100) : 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-md max-h-[min(90vh,640px)] overflow-y-auto rounded-2xl bg-white shadow-xl border border-zinc-200 p-5 space-y-4">
        <div className="flex items-center justify-between sticky top-0 bg-white pb-1 -mt-1 pt-1 z-10">
          <h3 className="font-semibold text-zinc-900">今日状态</h3>
          <button type="button" onClick={() => setOpen(false)} className="p-1 rounded hover:bg-zinc-100">
            <X className="h-4 w-4 text-zinc-500" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs font-semibold text-zinc-700">今日习惯</Label>
            <span className="text-[11px] text-zinc-500">
              {habitsDone}/{habitsTotal}
            </span>
          </div>
          {habitsTotal > 0 && <ProgressBar value={habitsPct} className="h-1.5" />}
          {habits.length === 0 ? (
            <p className="text-xs text-zinc-500 py-2 text-center rounded-lg border border-dashed border-zinc-200">
              今日无安排习惯
            </p>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {habits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  disabled={habitBusy === h.id}
                  onClick={() => void toggleHabit(h.id, h.checked)}
                  className={cn(
                    "w-full flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors",
                    h.checked
                      ? "border-emerald-200 bg-emerald-50/60 text-zinc-500"
                      : "border-zinc-100 bg-zinc-50/50 hover:border-zinc-200"
                  )}
                >
                  {h.checked ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-zinc-300" />
                  )}
                  <span
                    className={cn("flex-1 truncate", h.checked && "line-through")}
                    style={{ color: h.checked ? undefined : h.color }}
                  >
                    {h.name}
                  </span>
                </button>
              ))}
            </div>
          )}
          <Link
            href="/daily"
            className="text-[11px] text-indigo-600 hover:underline"
            onClick={() => setOpen(false)}
          >
            日计划 · 完整习惯与必做 →
          </Link>
        </div>

        <div className="border-t border-zinc-100 pt-4 space-y-4">
          <p className="text-xs font-semibold text-zinc-700">早上</p>
          <RatingPicker label="精力" value={form.energyMorning} onChange={(v) => setForm({ ...form, energyMorning: v })} />
          <RatingPicker label="内耗" value={form.drainMorning} onChange={(v) => setForm({ ...form, drainMorning: v })} />
          <div className="grid grid-cols-2 gap-2">
            <Field>
              <Label className="text-xs">起床时间</Label>
              <input
                type="time"
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm"
                value={form.wakeTime ?? ""}
                onChange={(e) => setForm({ ...form, wakeTime: e.target.value ? e.target.value.slice(0, 5) : null })}
              />
            </Field>
            <Field>
              <Label className="text-xs">计划睡眠</Label>
              <input
                type="time"
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm"
                value={form.plannedSleepTime ?? ""}
                onChange={(e) =>
                  setForm({ ...form, plannedSleepTime: e.target.value ? e.target.value.slice(0, 5) : null })
                }
              />
            </Field>
          </div>
          <Field>
            <Label className="text-xs">昨晚就寝</Label>
            <input
              type="time"
              className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm"
              value={lastNightBedtime ?? ""}
              onChange={async (e) => {
                const value = e.target.value ? e.target.value.slice(0, 5) : null;
                setLastNightBedtime(value);
                if (!value) return;
                const yesterday = format(subDays(parseISO(toDateString()), 1), "yyyy-MM-dd");
                await fetch("/api/daily-log", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ date: yesterday, sleepTime: value }),
                });
                if (form.wakeTime) {
                  await fetch("/api/daily-log", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ date: toDateString(), wakeTime: form.wakeTime }),
                  });
                }
                invalidateFetchCache("/api/daily-log");
              }}
            />
          </Field>
          <p className="text-xs text-zinc-500">
            睡眠时间{" "}
            {formatSleepDuration(sleepDurationHours(lastNightBedtime, form.wakeTime)) ??
              "补上昨晚就寝和起床时间后算出"}
            {lastNightBedtime ? ` · 昨晚就寝 ${lastNightBedtime}` : ""}
          </p>
          <Field>
            <Label className="text-xs">今日就寝时间</Label>
            <input
              type="time"
              className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm"
              value={form.sleepTime || DEFAULT_BEDTIME_TARGET}
              onChange={(e) =>
                setForm({ ...form, sleepTime: e.target.value ? e.target.value.slice(0, 5) : DEFAULT_BEDTIME_TARGET })
              }
            />
          </Field>
          <p className="text-xs font-semibold text-zinc-700">晚上</p>
          <RatingPicker label="精力" value={form.energyEvening} onChange={(v) => setForm({ ...form, energyEvening: v })} />
          <RatingPicker label="内耗" value={form.drainEvening} onChange={(v) => setForm({ ...form, drainEvening: v })} />
          <p className="text-[10px] text-zinc-400">精力、内耗按 1–5。睡眠时间由昨晚就寝和起床时间算出。</p>
          <Field>
            <Label className="text-xs">今日一句话</Label>
            <Textarea
              value={form.reflection}
              onChange={(e) => setForm({ ...form, reflection: e.target.value })}
              className="min-h-[60px] text-sm"
              placeholder="感觉如何 / 今日 win 或 block…"
            />
          </Field>
        </div>

        <Button onClick={() => void save()} disabled={saving} className="w-full sticky bottom-0">
          {saved ? "已保存 ✓" : saving ? "保存中…" : "保存状态"}
        </Button>
      </div>
    </div>
  );
}
