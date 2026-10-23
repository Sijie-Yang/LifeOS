"use client";

/* Existing daily page effects hydrate form state from fetched data. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Textarea, Label, Field, Input } from "@/components/ui/Input";
import {
  CachedContent,
  fetchJson,
  invalidateFetchCache,
  peekFetchCache,
  shouldShowPageLoading,
} from "@/components/ui/PageState";
import { toDateString, cn } from "@/lib/utils";
import type { MustDoItem } from "@/lib/accountability";
import { ArrowRight, Moon, Repeat, Sun } from "lucide-react";
import { DateNav } from "@/components/ui/DateNav";
import Link from "next/link";
import { addDays, format, parseISO, subDays } from "date-fns";
import { TodayTimeBlocks } from "@/components/daily/TodayTimeBlocks";
import { DEFAULT_BEDTIME_TARGET, DEFAULT_EMAIL_REMIND_DAYS, DEFAULT_PLANNED_SLEEP } from "@/lib/app-settings";
import { WELLNESS_SCALE, WELLNESS_SCORES, describeWellness, type WellnessScale, type WellnessScore } from "@/lib/wellness-scores";
import {
  bedtimeDelayMinutes,
  formatBedtimeDelay,
  formatSleepDuration,
  sleepDurationHours,
} from "@/lib/sleep-window";
import { DailyHabitGrid } from "@/components/daily/DailyHabitGrid";
import { CloseReplay, extractTodayFocus } from "@/components/daily/CloseReplay";
import type { LifePowerLever, LifePowersResult, MustDoResolved } from "@/lib/life-powers";
import { DayFlowStepper, DayRecord, MorningHabitsRow, ProjectAlignCard, TodayAgenda } from "@/components/daily/DayFlow";
import { PROJECT_ALIGN_HABIT_NAME, defaultDayPhase, pickMorningHabits, type DayPhase } from "@/lib/day-flow";
import { NinePowersMap, toggleLifePowerLever } from "@/components/daily/NinePowersMap";
import { RoomPlan } from "@/components/daily/RoomPlan";
import { setRoomZone, type RoomScore, type RoomZoneKey, type RoomZones } from "@/lib/room-plan";
import { DayTrends } from "@/components/daily/DayTrends";
import type { RecordExtra, RecordKind, RecordNotes } from "@/lib/day-record";
import { buildDayReviewPrompt } from "@/lib/day-review";
import { UrgeTransferActions, type UrgeTodayEvent } from "@/components/daily/UrgeTransfer";
import { URGE_ACTIONS, URGE_TRANSFER_LABEL } from "@/lib/urge-transfer";

/** 每台设备记一下「今天已开工」；读不到时按时间自动判断 */
function readFlag(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    /* 存储不可用时只在本次生效 */
  }
}

function ScoreRow({
  label,
  scale,
  value,
  disabled,
  tone,
  compact,
  onChange,
}: {
  label: string;
  scale: WellnessScale;
  /** 窄栏：按钮只显示数字 */
  compact?: boolean;
  value: number | null;
  disabled?: boolean;
  tone: "indigo" | "rose" | "sky";
  onChange: (score: WellnessScore) => void;
}) {
  const selected =
    tone === "rose" ? "bg-rose-600 text-white" : tone === "sky" ? "bg-sky-600 text-white" : "bg-indigo-600 text-white";
  const current = describeWellness(scale, value);
  return (
    <div>
      <p className="text-[11px] text-zinc-500 mb-1">
        {label}
        <span className="ml-1 text-zinc-400">{scale === "drain" ? "（越高越耗）" : scale === "urge" ? "（越高越强）" : "（越高越足）"}</span>
      </p>
      <div className="flex gap-0.5">
        {WELLNESS_SCORES.map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            title={describeWellness(scale, n) ?? undefined}
            className={cn(
              "h-7 flex-1 rounded-md text-xs font-medium",
              value === n ? selected : "bg-zinc-100 text-zinc-600"
            )}
          >
            {n}
            {!compact && <span className="ml-1 hidden sm:inline">{WELLNESS_SCALE[scale][n].name}</span>}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-zinc-600">{current ?? "还没打分 · 悬停按钮看每个分数的意思"}</p>
    </div>
  );
}

/** 精力 / 内耗 1–5 的完整对照 */
function WellnessLegend() {
  return (
    <details className="rounded-lg border border-zinc-100 bg-zinc-50/60 text-[11px]">
      <summary className="cursor-pointer select-none px-2.5 py-1.5 text-zinc-500 hover:text-zinc-700">分数说明</summary>
      <div className="grid gap-3 border-t border-zinc-100 p-2.5 sm:grid-cols-3">
        {(["energy", "drain", "urge"] as const).map((scale) => (
          <div key={scale}>
            <p className="mb-1 font-medium text-zinc-700">
              {scale === "energy" ? "精力 · 越高越足" : scale === "drain" ? "内耗 · 越高越耗" : "冲动 · 越高越强"}
            </p>
            <ul className="space-y-0.5 text-zinc-600">
              {WELLNESS_SCORES.map((n) => (
                <li key={n}>{describeWellness(scale, n)}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

/** 每半小时一个，一行 5 个、两行 */
const WAKE_PRESETS = ["05:30", "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00"];
const EXERCISE_PRESETS = ["06:30", "07:00", "07:30", "12:00", "12:30", "17:00", "17:30", "18:00", "18:30", "19:00"];
const SLEEP_PRESETS = ["21:30", "22:00", "22:30", "23:00", "23:30", "00:00", "00:30", "01:00", "01:30", "02:00"];

function shiftClock(value: string, minutes: number): string {
  const [h, m] = value.split(":").map(Number);
  const total = ((h! * 60 + m! + minutes) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** 选时间：常用时间一键点，− / + 微调 15 分钟；起床时间可以直接点「现在」 */
function ClockField({
  label,
  value,
  presets,
  fallback,
  allowNow,
  disabled,
  onChange,
}: {
  label: string;
  value: string | null;
  presets: string[];
  /** 没有值时 − / + 从这里开始 */
  fallback: string;
  allowNow?: boolean;
  disabled?: boolean;
  onChange: (value: string | null) => void;
}) {
  const step = (minutes: number) => onChange(shiftClock(value ?? fallback, minutes));
  const chip = "rounded px-1.5 py-0.5 text-[11px] tabular-nums disabled:opacity-50";
  return (
    <div>
      <p className="mb-0.5 text-[11px] text-zinc-500">{label}</p>
      <div className="flex items-center gap-0.5">
        <button type="button" disabled={disabled} onClick={() => step(-15)} className={cn(chip, "bg-zinc-100 text-zinc-600 hover:bg-zinc-200")} title="早 15 分钟">
          −
        </button>
        <span className={cn("w-12 text-center text-sm font-semibold tabular-nums", value ? "text-zinc-900" : "text-zinc-300")}>
          {value ?? "--:--"}
        </span>
        <button type="button" disabled={disabled} onClick={() => step(15)} className={cn(chip, "bg-zinc-100 text-zinc-600 hover:bg-zinc-200")} title="晚 15 分钟">
          +
        </button>
        {allowNow && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(format(new Date(), "HH:mm"))}
            className={cn(chip, "ml-1 bg-amber-100 text-amber-800 hover:bg-amber-200")}
          >
            现在
          </button>
        )}
      </div>
      <div className="mt-1 grid grid-cols-5 gap-0.5">
        {presets.map((t) => (
          <button
            key={t}
            type="button"
            disabled={disabled}
            onClick={() => onChange(t)}
            className={cn(chip, value === t ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200")}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 数字小输入框：失焦保存；服务器值变了就重置（key 跟着值走） */
function NumberField({
  label,
  unit,
  value,
  step,
  placeholder,
  disabled,
  onSave,
}: {
  label: string;
  unit: string;
  value: number | null;
  step?: number;
  placeholder?: string;
  disabled?: boolean;
  onSave: (value: number | null) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] text-zinc-500">
      {label}
      <input
        key={value ?? "empty"}
        type="number"
        inputMode="decimal"
        min={0}
        step={step ?? 1}
        defaultValue={value ?? ""}
        placeholder={placeholder}
        disabled={disabled}
        onBlur={(e) => {
          const raw = e.currentTarget.value.trim();
          const next = raw === "" ? null : Number(raw);
          if (next !== value && (next == null || Number.isFinite(next))) onSave(next);
        }}
        className="w-16 rounded-md border border-zinc-200 px-1.5 py-0.5 text-right text-sm tabular-nums text-zinc-900 disabled:opacity-60"
      />
      {unit}
    </label>
  );
}

const WEIGHT_INTS = [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70];
const WEIGHT_DECIMALS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** 体重：点整数再点小数（68 → .6 = 68.6），± 0.1 微调；当天没称时从上一次开始 */
function WeightField({
  value,
  last,
  disabled,
  onChange,
}: {
  value: number | null;
  last: { kg: number; date: string } | null;
  disabled?: boolean;
  onChange: (value: number | null) => void;
}) {
  const base = value ?? last?.kg ?? 65;
  const int = Math.floor(base + 1e-6);
  const tenth = Math.round((base - int) * 10) % 10;
  const set = (next: number) => onChange(Math.round(next * 10) / 10);
  const chip = "rounded px-1.5 py-0.5 text-[11px] tabular-nums disabled:opacity-50";
  const on = (active: boolean) => (active ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200");
  return (
    <div>
      <p className="mb-0.5 text-[11px] text-zinc-500">
        体重
        {value == null && last && (
          <span className="ml-1 text-zinc-400">今天还没称 · 上次 {last.kg}kg（{last.date.slice(5)}）</span>
        )}
      </p>
      <div className="flex items-center gap-0.5">
        <button type="button" disabled={disabled} onClick={() => set(base - 0.1)} className={cn(chip, on(false))}>
          −
        </button>
        <span className={cn("w-16 text-center text-sm font-semibold tabular-nums", value != null ? "text-zinc-900" : "text-zinc-300")}>
          {base.toFixed(1)}kg
        </span>
        <button type="button" disabled={disabled} onClick={() => set(base + 0.1)} className={cn(chip, on(false))}>
          +
        </button>
      </div>
      <div className="mt-1 grid grid-cols-11 gap-0.5">
        {WEIGHT_INTS.map((n) => (
          <button key={n} type="button" disabled={disabled} onClick={() => set(n + tenth / 10)} className={cn(chip, "px-0", on(value != null && int === n))}>
            {n}
          </button>
        ))}
      </div>
      <div className="mt-0.5 grid grid-cols-11 gap-0.5">
        {WEIGHT_DECIMALS.map((d) => (
          <button key={d} type="button" disabled={disabled} onClick={() => set(int + d / 10)} className={cn(chip, "px-0", on(value != null && tenth === d))}>
            .{d}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 和房间清洁绑定的两个习惯：放在开工的房间平面图上面，样式和晨间习惯一样 */
const ROOM_HABITS = ["整理房间", "收拾衣物"];

type DailyData = {
  date: string;
  lastWeight?: { kg: number; date: string } | null;
  /** 房间：分数（今天没打分时沿用最近一次）、沿用自哪天、今天打勾的分区 */
  room?: { zones: RoomZones; carriedFrom: string | null; done: RoomZoneKey[] };
  urge?: {
    categoryId: string;
    morning: number | null;
    today: Array<UrgeTodayEvent & { redirect: string | null; intensity: number; trigger: string | null }>;
    streak: number;
    brokeToday: boolean;
  };
  log: {
    content?: string | null;
    mustDo: MustDoItem[];
    closedAt: string | null;
    closeNote: string | null;
    energy: number | null;
    mood: number | null;
    sleepHours: number | null;
    energyMorning: number | null;
    drainMorning: number | null;
    wakeTime: string | null;
    plannedSleepTime: string | null;
    sleepTime: string | null;
    energyEvening: number | null;
    drainEvening: number | null;
    reflection: string | null;
    recordNotes?: RecordNotes;
    recordExtras?: RecordExtra[];
    planScore?: number | null;
    planScoreNote?: string | null;
    weightKg?: number | null;
    exerciseStartTime?: string | null;
    exerciseMinutes?: number | null;
    exerciseCalories?: number | null;
    roomZones?: RoomZones;
  } | null;
  previousBedtime?: string | null;
  mustDoItems: MustDoResolved[];
  lifePowers?: LifePowersResult;
  /** 今天自动排到的项目步骤（已顺延） */
  planSteps?: Array<{ id: string; title: string; done: boolean; projectId: string; projectName: string }>;
  tasks?: Array<{ id: string; title: string; completed: boolean }>;
  habits: Array<{
    id: string;
    name: string;
    color: string;
    checked: boolean;
    cue?: string | null;
    minimumVersion?: string | null;
    level?: string | null;
    startTime?: string | null;
    power?: string | null;
  }>;
};

export function DailyPlanPanel({ embedded = false }: { embedded?: boolean }) {
  const today = toDateString();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateFromUrl = searchParams.get("date");
  const initialDate =
    dateFromUrl && /^\d{4}-\d{2}-\d{2}$/.test(dateFromUrl) ? dateFromUrl : today;
  const [date, setDate] = useState(initialDate);
  const [data, setData] = useState<DailyData | null>(() =>
    peekFetchCache<DailyData>(`/api/daily-log?date=${initialDate}`)
  );
  const [energyMorning, setEnergyMorning] = useState<number | null>(null);
  const [drainMorning, setDrainMorning] = useState<number | null>(null);
  const [wakeTime, setWakeTime] = useState<string | null>(null);
  const [plannedSleepTime, setPlannedSleepTime] = useState<string | null>(DEFAULT_PLANNED_SLEEP);
  const [lastNightBedtime, setLastNightBedtime] = useState<string | null>(null);
  const lastNightEdited = useRef(false);
  const [todayBedtime, setTodayBedtime] = useState(DEFAULT_BEDTIME_TARGET);
  const [energyEvening, setEnergyEvening] = useState<number | null>(null);
  const [drainEvening, setDrainEvening] = useState<number | null>(null);
  const [reflection, setReflection] = useState("");
  const [windDownItems, setWindDownItems] = useState<string[]>([]);
  const [windDownDone, setWindDownDone] = useState<Record<string, boolean>>({});
  const [wellnessStatus, setWellnessStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [emailRemindersEnabled, setEmailRemindersEnabled] = useState(false);
  const [reminderEmail, setReminderEmail] = useState("");
  const [emailRemindDaysText, setEmailRemindDaysText] = useState(
    DEFAULT_EMAIL_REMIND_DAYS.join(",")
  );
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [emailTestStatus, setEmailTestStatus] = useState<string | null>(null);
  const wellnessBaseline = useRef<string | null>(null);
  const formRev = useRef(0);
  const applyingServerForm = useRef(false);
  const [loading, setLoading] = useState(() =>
    shouldShowPageLoading([`/api/daily-log?date=${initialDate}`])
  );
  const [error, setError] = useState<string | null>(null);
  const [replayOpen, setReplayOpen] = useState(false);

  const load = useCallback(async (d: string, force = false) => {
    const rev = formRev.current;
    if (force) invalidateFetchCache("/api/daily-log");
    if (shouldShowPageLoading([`/api/daily-log?date=${d}`])) setLoading(true);
    setError(null);
    try {
      const res = await fetchJson<DailyData>(`/api/daily-log?date=${d}`, { force });
      setData(res);
      if (rev !== formRev.current) return;
      applyingServerForm.current = true;
      setEnergyMorning(res.log?.energyMorning ?? null);
      setDrainMorning(res.log?.drainMorning ?? null);
      setWakeTime(res.log?.wakeTime ?? null);
      setPlannedSleepTime(res.log?.plannedSleepTime || DEFAULT_PLANNED_SLEEP);
      if (!lastNightEdited.current || res.previousBedtime) {
        setLastNightBedtime(res.previousBedtime ?? null);
      }
      setTodayBedtime(res.log?.sleepTime || DEFAULT_BEDTIME_TARGET);
      setEnergyEvening(res.log?.energyEvening ?? null);
      setDrainEvening(res.log?.drainEvening ?? null);
      setReflection(res.log?.reflection || res.log?.closeNote || "");
      wellnessBaseline.current = JSON.stringify({
        energyMorning: res.log?.energyMorning ?? null,
        drainMorning: res.log?.drainMorning ?? null,
        wakeTime: res.log?.wakeTime ?? null,
        plannedSleepTime: res.log?.plannedSleepTime || DEFAULT_PLANNED_SLEEP,
        energyEvening: res.log?.energyEvening ?? null,
        drainEvening: res.log?.drainEvening ?? null,
        reflection: res.log?.reflection || res.log?.closeNote || "",
      });
      setWellnessStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (applyingServerForm.current) {
      applyingServerForm.current = false;
      return;
    }
    formRev.current += 1;
  }, [energyMorning, drainMorning, wakeTime, plannedSleepTime, energyEvening, drainEvening, reflection]);

  useEffect(() => {
    if (dateFromUrl && /^\d{4}-\d{2}-\d{2}$/.test(dateFromUrl) && dateFromUrl !== date) {
      setDate(dateFromUrl);
    }
  }, [dateFromUrl, date]);

  const setDateAndUrl = (next: string) => {
    setDate(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === today) params.delete("date");
    else params.set("date", next);
    params.set("scale", "day");
    params.delete("start");
    params.delete("end");
    router.replace(`/timeline?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    void load(date);
  }, [date, load]);

  useEffect(() => {
    if (date !== today) return;
    void fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        if (s.windDownChecklistParsed) setWindDownItems(s.windDownChecklistParsed);
        setEmailRemindersEnabled(Boolean(s.emailRemindersEnabled));
        setReminderEmail(s.reminderEmail || "");
        setEmailRemindDaysText(
          (s.emailRemindDaysParsed || DEFAULT_EMAIL_REMIND_DAYS).join(",")
        );
        setEmailConfigured(Boolean(s.emailConfigured));
      })
      .catch(() => null);
  }, [date, today]);

  useEffect(() => {
    if (!data?.log?.closedAt) return;
    void fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => setWindDownItems(s.windDownChecklistParsed ?? []))
      .catch(() => null);
  }, [data?.log?.closedAt]);

  const saveMustDo = async (mustDo: MustDoItem[]) => {
    await fetch("/api/daily-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, mustDo }),
    });
    void load(date, true);
  };

  const toggleMustDo = (type: "habit" | "task", id: string) => {
    const current = (data?.log?.mustDo ?? []).filter(
      (m): m is Extract<MustDoItem, { type: "habit" | "task" }> =>
        m.type === "habit" || m.type === "task"
    );
    const exists = current.some((m) => m.type === type && m.id === id);
    if (exists) {
      void saveMustDo((data?.log?.mustDo ?? []).filter((m) => !(m.type === type && m.id === id)));
      return;
    }
    if ((data?.log?.mustDo ?? []).length >= 3) {
      alert("今日必做最多 3 项");
      return;
    }
    void saveMustDo([...(data?.log?.mustDo ?? []), { type, id }]);
  };

  const saveWellness = useCallback(async () => {
    setWellnessStatus("saving");
    await fetch("/api/daily-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        energyMorning,
        drainMorning,
        wakeTime,
        plannedSleepTime: plannedSleepTime || DEFAULT_PLANNED_SLEEP,
        energyEvening,
        drainEvening,
        reflection,
      }),
    });
    invalidateFetchCache("/api/daily-log");
    invalidateFetchCache("/api/dashboard");
    invalidateFetchCache("/api/briefing");
    wellnessBaseline.current = JSON.stringify({
      energyMorning,
      drainMorning,
      wakeTime,
      plannedSleepTime,
      energyEvening,
      drainEvening,
      reflection,
    });
    setWellnessStatus("saved");
    setTimeout(() => setWellnessStatus("idle"), 2500);
  }, [date, energyMorning, drainMorning, wakeTime, plannedSleepTime, energyEvening, drainEvening, reflection]);

  useEffect(() => {
    if (date !== today || data?.log?.closedAt) return;
    const snapshot = JSON.stringify({
      energyMorning,
      drainMorning,
      wakeTime,
      plannedSleepTime,
      energyEvening,
      drainEvening,
      reflection,
    });
    if (wellnessBaseline.current === null) return;
    if (wellnessBaseline.current === snapshot) return;
    const timer = setTimeout(() => {
      void saveWellness();
    }, 800);
    return () => clearTimeout(timer);
  }, [
    energyMorning,
    drainMorning,
    wakeTime,
    plannedSleepTime,
    energyEvening,
    drainEvening,
    reflection,
    date,
    today,
    data?.log?.closedAt,
    saveWellness,
  ]);

  const saveLastNight = async (value: string | null) => {
    lastNightEdited.current = true;
    setLastNightBedtime(value);
    if (!value) return;
    const yesterday = format(subDays(parseISO(date), 1), "yyyy-MM-dd");
    await fetch("/api/daily-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: yesterday, sleepTime: value }),
    });
    if (wakeTime) {
      await fetch("/api/daily-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, wakeTime }),
      });
    }
    invalidateFetchCache("/api/daily-log");
  };

  const saveTodayBedtime = async (value: string) => {
    const bedtime = value || DEFAULT_BEDTIME_TARGET;
    setTodayBedtime(bedtime);
    await fetch("/api/daily-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, sleepTime: bedtime }),
    });
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bedtimeTarget: bedtime }),
    });
    invalidateFetchCache("/api/daily-log");
  };

  // 记录段：批注一条条存，多做的事整体存
  const saveRecordNote = async (key: string, text: string) => {
    setData((prev) => {
      if (!prev?.log) return prev;
      const recordNotes = { ...(prev.log.recordNotes ?? {}) };
      if (text.trim()) recordNotes[key] = text.trim();
      else delete recordNotes[key];
      return { ...prev, log: { ...prev.log, recordNotes } };
    });
    await fetch("/api/daily-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, recordNote: { key, text } }),
    });
    void load(date, true);
  };

  const saveRecordExtras = async (recordExtras: RecordExtra[]) => {
    setData((prev) => (prev?.log ? { ...prev, log: { ...prev.log, recordExtras } } : prev));
    await fetch("/api/daily-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, recordExtras }),
    });
    void load(date, true);
  };

  /** 体重 / 运动：单独保存，不走状态自动保存 */
  const saveBody = async (patch: {
    urgeMorning?: number | null;
    weightKg?: number | null;
    exerciseStartTime?: string | null;
    exerciseMinutes?: number | null;
    exerciseCalories?: number | null;
  }) => {
    setData((prev) => (prev?.log ? { ...prev, log: { ...prev.log, ...patch } } : prev));
    await fetch("/api/daily-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, ...patch }),
    });
    invalidateFetchCache("/api/daily-log");
  };

  /** 房间平面图：改一个分区的清洁分（null 清掉） */
  const scoreRoomZone = async (key: RoomZoneKey, score: RoomScore | null) => {
    setData((prev) =>
      prev?.room ? { ...prev, room: { ...prev.room, zones: setRoomZone(prev.room.zones, key, score), carriedFrom: null } } : prev
    );
    await fetch("/api/daily-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, roomZone: { key, score } }),
    });
    invalidateFetchCache("/api/daily-log");
  };

  /** 房间清洁策略打勾：做完的分区自动按「良」算，计入清洁力 */
  const toggleRoomTask = async (key: RoomZoneKey, done: boolean) => {
    setData((prev) =>
      prev?.room
        ? { ...prev, room: { ...prev.room, done: done ? [...new Set([...prev.room.done, key])] : prev.room.done.filter((k) => k !== key) } }
        : prev
    );
    await fetch("/api/daily-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, roomTask: { key, done } }),
    });
    void load(date, true);
  };

  /** 冲动 · 转化：记一次冲动；选「运动」时顺手把运动开始时间记成现在 */
  const recordUrge = async (key: (typeof URGE_ACTIONS)[number]["key"]) => {
    const action = URGE_ACTIONS.find((a) => a.key === key);
    if (!action || !data?.urge) return;
    await fetch("/api/urges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        categoryId: data.urge.categoryId,
        outcome: action.outcome,
        redirect: action.outcome === "redirected" ? action.key : null,
        intensity: data.urge.morning ?? 3,
      }),
    });
    if (key === "exercise" && !data.log?.exerciseStartTime) {
      await saveBody({ exerciseStartTime: format(new Date(), "HH:mm") });
    }
    invalidateFetchCache("/api/urges");
    void load(date, true);
  };

  const deleteUrge = async (id: string) => {
    await fetch(`/api/urges/${id}`, { method: "DELETE" });
    invalidateFetchCache("/api/urges");
    void load(date, true);
  };

  const isMustDo = (type: "habit" | "task" | "priority", id: string) =>
    (data?.log?.mustDo ?? []).some((m) => m.type === type && m.id === id);

  const closeDay = async () => {
    await fetch("/api/daily-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        close: true,
        closeNote: reflection.trim() || null,
        energyMorning,
        drainMorning,
        wakeTime,
        plannedSleepTime: plannedSleepTime || DEFAULT_PLANNED_SLEEP,
        sleepTime: todayBedtime || DEFAULT_BEDTIME_TARGET,
        energyEvening,
        drainEvening,
        reflection,
      }),
    });
    setReplayOpen(true);
    void load(date, true);
  };

  const checkInHabit = async (
    habitId: string,
    level: "full" | "minimum" | "skip",
    currentlyChecked: boolean
  ) => {
    const next = level === "skip" ? false : true;
    if (currentlyChecked && level === "full") {
      setData((prev) =>
        prev
          ? {
              ...prev,
              habits: prev.habits.map((h) =>
                h.id === habitId ? { ...h, checked: false, level: null } : h
              ),
            }
          : prev
      );
      await fetch(`/api/habits/${habitId}/checkin?date=${date}`, { method: "DELETE" });
      invalidateFetchCache("/api/habits");
      invalidateFetchCache("/api/stream");
      void load(date, true);
      return;
    }
    setData((prev) =>
      prev
        ? {
            ...prev,
            habits: prev.habits.map((h) =>
              h.id === habitId ? { ...h, checked: next, level } : h
            ),
          }
        : prev
    );
    const res = await fetch(`/api/habits/${habitId}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, completed: next, level }),
    });
    if (!res.ok) {
      void load(date, true);
      return;
    }
    invalidateFetchCache("/api/habits");
    invalidateFetchCache("/api/dashboard");
    invalidateFetchCache("/api/stream");
    void load(date, true);
  };

  const [leverBusy, setLeverBusy] = useState(false);
  const toggleLever = async (lever: LifePowerLever) => {
    setLeverBusy(true);
    try {
      await toggleLifePowerLever(lever, date);
      invalidateFetchCache("/api/habits");
      invalidateFetchCache("/api/stream");
      await load(date, true);
    } finally {
      setLeverBusy(false);
    }
  };

  /** 记录段：点勾把一条改成做了 / 没做（步骤、任务、习惯） */
  const toggleRecordItem = async (type: RecordKind, id: string, done: boolean) => {
    setLeverBusy(true);
    try {
      if (type === "habit") {
        await checkInHabit(id, "full", done);
        return;
      }
      if (type === "step") {
        await fetch(`/api/plan-steps/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(done ? { done: false, doneDate: null } : { done: true, doneDate: date }),
        });
      } else {
        await fetch(`/api/tasks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: !done }),
        });
      }
      invalidateFetchCache("/api/stream");
      invalidateFetchCache("/api/projects");
      invalidateFetchCache("/api/tasks");
      await load(date, true);
    } finally {
      setLeverBusy(false);
    }
  };

  const shift = (delta: number) => {
    setDateAndUrl(format(addDays(parseISO(`${date}T12:00:00`), delta), "yyyy-MM-dd"));
  };

  const closed = Boolean(data?.log?.closedAt);
  const isToday = date === today;

  // 三段流程：按时间 / 是否开工 / 是否关账自动选，也可以手动切
  const startedKey = `day-started:${date}`;
  const [startedFor, setStartedFor] = useState<string | null>(null);
  const started = startedFor === date || readFlag(startedKey);
  const autoPhase = defaultDayPhase({ date, today, hour: new Date().getHours(), started, closed });
  const [phaseFor, setPhaseState] = useState<{ date: string; phase: DayPhase } | null>(null);
  const phase = phaseFor?.date === date ? phaseFor.phase : autoPhase;
  const setPhaseFor = (next: DayPhase) => setPhaseState({ date, phase: next });
  const startDay = () => {
    setStartedFor(date);
    writeFlag(startedKey);
    setPhaseFor("do");
  };
  const projectAlignHabit = data?.habits.find((h) => h.name === PROJECT_ALIGN_HABIT_NAME) ?? null;
  const morningHabits = pickMorningHabits(data?.habits ?? []);
  const todayProjectCount = new Set((data?.planSteps ?? []).map((st) => st.projectId)).size;
  const label = format(parseISO(`${date}T12:00:00`), "M月d日 EEE");
  const habitsDone = data?.habits.filter((h) => h.checked).length ?? 0;
  const habitsTotal = data?.habits.length ?? 0;
  const mustDoDone = data?.mustDoItems.filter((m) => m.done).length ?? 0;
  const mustDoTotal = data?.mustDoItems.length ?? 0;

  return (
    <>
      {!embedded && (
        <PageHeader
          title="今日"
          description="此刻的习惯、专注与关账"
        />
      )}


      <CachedContent loading={loading} error={error} onRetry={() => load(date)} hasData={!!data}>
        <DateNav
          label={label}
          prevLabel="前一天"
          nextLabel="后一天"
          onPrev={() => shift(-1)}
          onNext={() => shift(1)}
        />

        <DayFlowStepper phase={phase} autoPhase={autoPhase} onChange={setPhaseFor} />

        {phase === "start" && (
          <div className="mb-4 space-y-4">
            {isToday && (
              <Card className="border-indigo-100">
                <CardHeader className="py-3 px-4 border-b border-zinc-100">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Sun className="h-4 w-4 text-amber-500" />
                    1 · 起床状态
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium text-zinc-700">早上</p>
                    <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                      <ScoreRow label="精力" scale="energy" value={energyMorning} disabled={closed} tone="indigo" onChange={setEnergyMorning} />
                      <ScoreRow label="内耗" scale="drain" value={drainMorning} disabled={closed} tone="rose" onChange={setDrainMorning} />
                    </div>
                    <WellnessLegend />
                    <div className="grid gap-x-4 gap-y-2 sm:grid-cols-3">
                      <ClockField
                        label="昨晚就寝"
                        value={lastNightBedtime}
                        presets={SLEEP_PRESETS}
                        fallback={DEFAULT_PLANNED_SLEEP}
                        disabled={closed}
                        onChange={(value) => void saveLastNight(value)}
                      />
                      <ClockField
                        label="起床时间"
                        value={wakeTime}
                        presets={WAKE_PRESETS}
                        fallback="06:30"
                        allowNow
                        disabled={closed}
                        onChange={setWakeTime}
                      />
                      <ClockField
                        label="今晚计划睡眠"
                        value={plannedSleepTime || DEFAULT_PLANNED_SLEEP}
                        presets={SLEEP_PRESETS}
                        fallback={DEFAULT_PLANNED_SLEEP}
                        disabled={closed}
                        onChange={setPlannedSleepTime}
                      />
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      睡眠时间{" "}
                      {formatSleepDuration(sleepDurationHours(lastNightBedtime, wakeTime)) ??
                        "补上昨晚就寝和起床时间后算出"}
                    </p>
                    <div className="grid gap-x-4 gap-y-3 border-t border-zinc-100 pt-2 sm:grid-cols-2">
                      <WeightField
                        value={data?.log?.weightKg ?? null}
                        last={data?.lastWeight ?? null}
                        disabled={closed}
                        onChange={(weightKg) => void saveBody({ weightKg })}
                      />
                      {data?.urge && (
                        <div className="space-y-1.5">
                          <div>
                            <ScoreRow
                              label={URGE_TRANSFER_LABEL}
                              scale="urge"
                              value={data.urge.morning}
                              disabled={closed}
                              tone="sky"
                              onChange={(urgeMorning) => void saveBody({ urgeMorning }).then(() => load(date, true))}
                            />
                          </div>
                          <UrgeTransferActions
                            morning={data.urge.morning}
                            today={data.urge.today}
                            streak={data.urge.streak}
                            brokeToday={data.urge.brokeToday}
                            disabled={closed}
                            onAction={(key) => void recordUrge(key)}
                            onDelete={(id) => void deleteUrge(id)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            <DayTrends date={date} />
            {isToday && (
              <MorningHabitsRow
                habits={morningHabits}
                onCheck={closed ? undefined : (id, checked) => void checkInHabit(id, "full", checked)}
              />
            )}
            {isToday && (
              <ProjectAlignCard
                habit={projectAlignHabit}
                projectCount={todayProjectCount}
                onCheck={closed ? undefined : (id, checked) => void checkInHabit(id, "full", checked)}
                onFinish={
                  closed
                    ? undefined
                    : () =>
                        projectAlignHabit && !projectAlignHabit.checked
                          ? void checkInHabit(projectAlignHabit.id, "full", false)
                          : void load(date, true)
                }
              />
            )}
            {data?.lifePowers && (
              <NinePowersMap
                lifePowers={data.lifePowers}
                date={date}
                onRefresh={() => void load(date, true)}
                onLeverToggle={isToday && !closed ? (lever) => void toggleLever(lever) : undefined}
                busy={leverBusy}
              />
            )}
            {isToday && (
              <MorningHabitsRow
                title="房间习惯"
                habits={(data?.habits ?? []).filter((h) => ROOM_HABITS.includes(h.name))}
                onCheck={closed ? undefined : (id, checked) => void checkInHabit(id, "full", checked)}
              />
            )}
            <RoomPlan
              zones={data?.room?.zones ?? data?.log?.roomZones ?? {}}
              carriedFrom={data?.room?.carriedFrom ?? null}
              done={data?.room?.done ?? []}
              onScore={isToday && !closed ? (key, score) => void scoreRoomZone(key, score) : undefined}
              onToggleDone={isToday && !closed ? (key, done) => void toggleRoomTask(key, done) : undefined}
            />
            {isToday && !closed && (
              <div className="flex justify-end">
                <Button onClick={startDay}>
                  开工 · 看今天的自动排程 <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        {phase === "do" && (
          <div className="mb-4 space-y-4">
            {data?.lifePowers && (
              <TodayAgenda
                title="今日自动排程"
                lifePowers={data.lifePowers}
                planSteps={data.planSteps ?? []}
                onLeverToggle={isToday && !closed ? (lever) => void toggleLever(lever) : undefined}
                busy={leverBusy}
              />
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          <Card className="border-emerald-100/80 shadow-sm h-full flex flex-col">
              <CardHeader className="py-3 px-4 border-b border-emerald-50 flex flex-row items-center justify-between shrink-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-emerald-600" />
                  习惯打卡
                </CardTitle>
                <Link href="/habits" className="text-xs text-indigo-600 hover:underline">
                  全部
                </Link>
              </CardHeader>
              <CardContent className="p-3 pt-3 flex-1 min-h-0">
                <DailyHabitGrid
                  habits={data?.habits ?? []}
                  done={habitsDone}
                  total={habitsTotal}
                  interactive={isToday}
                  closed={closed}
                  isMustDo={(id) => isMustDo("habit", id)}
                  onToggle={(id, checked) => void checkInHabit(id, "full", checked)}
                  onMinimum={(id) => void checkInHabit(id, "minimum", false)}
                  onToggleMustDo={(id) => toggleMustDo("habit", id)}
                />
              </CardContent>
            </Card>
            <TodayTimeBlocks
              date={date}
              wakeTime={wakeTime}
              endTime={todayBedtime}
            />
            </div>
            {data?.lifePowers && (
              <NinePowersMap
                compact
                lifePowers={data.lifePowers}
                date={date}
                onRefresh={() => void load(date, true)}
                onLeverToggle={isToday && !closed ? (lever) => void toggleLever(lever) : undefined}
                busy={leverBusy}
              />
            )}
          </div>
        )}

        {phase === "record" && (
          <div className="mb-4 grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            <div className="space-y-4 lg:col-span-2">
              <DayRecord
                steps={data?.planSteps ?? []}
                tasks={data?.tasks ?? []}
                habits={(data?.habits ?? []).map((h) => ({
                  id: h.id,
                  name: h.name,
                  checked: h.checked,
                  base: h.power === "base",
                }))}
                notes={data?.log?.recordNotes ?? {}}
                extras={data?.log?.recordExtras ?? []}
                planScore={data?.log?.planScore ?? null}
                planScoreNote={data?.log?.planScoreNote ?? null}
                editable={date <= today}
                onSaveNote={(key, text) => void saveRecordNote(key, text)}
                onSaveExtras={(extras) => void saveRecordExtras(extras)}
                onToggle={closed ? undefined : (type, id, done) => void toggleRecordItem(type, id, done)}
                buildPrompt={() =>
                  buildDayReviewPrompt({
                    date,
                    closed,
                    wellness: {
                      lastNightBedtime,
                      wakeTime,
                      sleepHours: sleepDurationHours(lastNightBedtime, wakeTime),
                      energyMorning,
                      drainMorning,
                      energyEvening,
                      drainEvening,
                      reflection: reflection.trim() || null,
                      weightKg: data?.log?.weightKg ?? null,
                      exerciseStartTime: data?.log?.exerciseStartTime ?? null,
                      exerciseMinutes: data?.log?.exerciseMinutes ?? null,
                      exerciseCalories: data?.log?.exerciseCalories ?? null,
                    },
                    steps: data?.planSteps ?? [],
                    tasks: data?.tasks ?? [],
                    habits: data?.habits ?? [],
                    notes: data?.log?.recordNotes ?? {},
                    extras: data?.log?.recordExtras ?? [],
                    lifePowers: data?.lifePowers ?? null,
                    planScore: data?.log?.planScore ?? null,
                    urge: data?.urge ?? null,
                  })
                }
              />
              {data?.lifePowers && (
                <NinePowersMap
                  compact
                  lifePowers={data.lifePowers}
                  date={date}
                  onRefresh={() => void load(date, true)}
                  onLeverToggle={isToday && !closed ? (lever) => void toggleLever(lever) : undefined}
                  busy={leverBusy}
                />
              )}
            </div>
          <Card className="border-indigo-100 h-full flex flex-col">
              <CardHeader className="py-3 px-4 border-b border-zinc-100 shrink-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Moon className="h-4 w-4 text-indigo-600" />
                  晚上 · 关账
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 flex-1">
                {isToday ? (
                  <>
                    <div className="space-y-2">
                      <p className="text-[11px] font-medium text-zinc-700">晚上</p>
                      <ScoreRow label="精力" scale="energy" compact value={energyEvening} disabled={closed} tone="indigo" onChange={setEnergyEvening} />
                      <ScoreRow label="内耗" scale="drain" compact value={drainEvening} disabled={closed} tone="rose" onChange={setDrainEvening} />
                    </div>
                    <WellnessLegend />
                    <ClockField
                      label="运动开始"
                      value={data?.log?.exerciseStartTime ?? null}
                      presets={EXERCISE_PRESETS}
                      fallback="18:00"
                      allowNow
                      disabled={closed}
                      onChange={(exerciseStartTime) => void saveBody({ exerciseStartTime })}
                    />
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                      <NumberField
                        label="运动"
                        unit="分钟"
                        placeholder="0"
                        value={data?.log?.exerciseMinutes ?? null}
                        disabled={closed}
                        onSave={(exerciseMinutes) => void saveBody({ exerciseMinutes })}
                      />
                      <NumberField
                        label="消耗"
                        unit="千卡"
                        placeholder="0"
                        value={data?.log?.exerciseCalories ?? null}
                        disabled={closed}
                        onSave={(exerciseCalories) => void saveBody({ exerciseCalories })}
                      />
                    </div>
                    <Field>
                      <Label className="text-[11px]">今日一句话</Label>
                      <Textarea
                        value={reflection}
                        onChange={(e) => setReflection(e.target.value)}
                        disabled={closed}
                        className="min-h-[52px] text-sm"
                        placeholder="win / block…"
                      />
                    </Field>
                    <ClockField
                      label="今日就寝时间"
                      value={todayBedtime || DEFAULT_BEDTIME_TARGET}
                      presets={SLEEP_PRESETS}
                      fallback={DEFAULT_BEDTIME_TARGET}
                      allowNow
                      disabled={closed}
                      onChange={(value) => void saveTodayBedtime(value ?? DEFAULT_BEDTIME_TARGET)}
                    />
                    <p
                      className={cn(
                        "text-[11px]",
                        (bedtimeDelayMinutes(plannedSleepTime || DEFAULT_PLANNED_SLEEP, todayBedtime) ?? 0) > 0
                          ? "text-rose-600"
                          : "text-zinc-500"
                      )}
                    >
                      {formatBedtimeDelay(bedtimeDelayMinutes(plannedSleepTime || DEFAULT_PLANNED_SLEEP, todayBedtime))}
                    </p>
                    {!closed && (
                      <details className="group rounded-lg border border-zinc-100 bg-zinc-50/60 text-xs">
                        <summary className="cursor-pointer select-none list-none px-2.5 py-1.5 text-zinc-500 hover:text-zinc-700">
                          提醒设置 · {emailRemindersEnabled ? "邮件已开" : "邮件未开"}
                        </summary>
                      <div className="space-y-2 border-t border-zinc-100 p-2.5">
                        <label className="flex items-center gap-2 text-xs text-zinc-700">
                          <input
                            type="checkbox"
                            checked={emailRemindersEnabled}
                            onChange={async (e) => {
                              const enabled = e.target.checked;
                              setEmailRemindersEnabled(enabled);
                              await fetch("/api/settings", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ emailRemindersEnabled: enabled }),
                              });
                            }}
                          />
                          任务/机会邮件提醒
                        </label>
                        <Input
                          type="email"
                          className="text-sm"
                          placeholder="收件邮箱"
                          value={reminderEmail}
                          onChange={(e) => setReminderEmail(e.target.value)}
                          onBlur={async () => {
                            await fetch("/api/settings", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ reminderEmail }),
                            });
                          }}
                        />
                        <Input
                          className="text-sm"
                          placeholder="提前天数，如 14,7,3,1,0"
                          value={emailRemindDaysText}
                          onChange={(e) => setEmailRemindDaysText(e.target.value)}
                          onBlur={async () => {
                            const days = emailRemindDaysText
                              .split(/[,，\s]+/)
                              .map((x) => Number(x.trim()))
                              .filter((n) => Number.isFinite(n));
                            await fetch("/api/settings", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ emailRemindDays: days }),
                            });
                          }}
                        />
                        <p className="text-[10px] text-zinc-500 leading-relaxed">
                          {emailConfigured
                            ? "已配置 RESEND_API_KEY，可发真邮件。"
                            : "未配置 RESEND_API_KEY 时只会 dry-run / 报错。浏览器开着时仍会推系统通知。"}
                        </p>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="w-full"
                          onClick={async () => {
                            setEmailTestStatus("发送中…");
                            const res = await fetch("/api/reminders/email", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ force: true }),
                            });
                            const payload = await res.json();
                            if (payload.sent) setEmailTestStatus(`已发送 · ${payload.total} 项`);
                            else if (payload.dryRun) setEmailTestStatus(`dry-run · ${payload.total} 项`);
                            else setEmailTestStatus(payload.reason || payload.error || "未发送");
                          }}
                        >
                          立刻发一封截止提醒
                        </Button>
                        {emailTestStatus && (
                          <p className="text-[10px] text-zinc-600">{emailTestStatus}</p>
                        )}
                      </div>
                      </details>
                    )}
                    {!closed && wellnessStatus !== "idle" && (
                      <p className="text-[11px] text-zinc-500">
                        {wellnessStatus === "saving" && "保存中…"}
                        {wellnessStatus === "saved" && <span className="text-emerald-600">已保存 ✓</span>}
                      </p>
                    )}
                    {closed ? (
                      <>
                        <p className="text-xs text-emerald-700">
                          已于 {format(new Date(data!.log!.closedAt!), "HH:mm")} 关账
                        </p>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full"
                          onClick={() => setReplayOpen(true)}
                        >
                          再看今日回放
                        </Button>
                        {windDownItems.length > 0 && (
                          <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-2.5 space-y-1.5">
                            {windDownItems.map((item) => (
                              <label key={item} className="flex items-center gap-2 text-xs text-zinc-700">
                                <input
                                  type="checkbox"
                                  checked={Boolean(windDownDone[item])}
                                  onChange={(e) =>
                                    setWindDownDone({ ...windDownDone, [item]: e.target.checked })
                                  }
                                />
                                {item}
                              </label>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <Button onClick={() => void closeDay()} className="w-full" size="sm">
                        今日关账 · 看回放
                      </Button>
                    )}
                  </>
                ) : closed ? (
                  <p className="text-sm text-emerald-700">
                    已于 {format(new Date(data!.log!.closedAt!), "HH:mm")} 关账
                    {data?.log?.reflection || data?.log?.closeNote
                      ? ` · ${data.log.reflection || data.log.closeNote}`
                      : ""}
                  </p>
                ) : (
                  <p className="text-sm text-zinc-500">当日未关账</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <CloseReplay
          open={replayOpen}
          onClose={() => setReplayOpen(false)}
          input={{
            date,
            focus:
              extractTodayFocus(data?.log?.content) ||
              data?.mustDoItems.find((m) => !m.done)?.label ||
              data?.mustDoItems[0]?.label ||
              null,
            mustDoDone,
            mustDoTotal,
            mustDoTitles: (data?.mustDoItems ?? [])
              .filter((m) => m.done)
              .map((m) => m.label),
            habitsDone,
            habitsTotal,
            tasksDone: 0,
            tasksTotal: 0,
            energyMorning,
            drainMorning,
            sleepHours: sleepDurationHours(lastNightBedtime, wakeTime),
            wakeTime,
            plannedSleepTime: plannedSleepTime || DEFAULT_PLANNED_SLEEP,
            sleepTime: todayBedtime,
            energyEvening,
            drainEvening,
            reflection: reflection.trim() || data?.log?.reflection || data?.log?.closeNote || null,
          }}
        />
      </CachedContent>
    </>
  );
}
