"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { IronLawsBanner } from "@/components/layout/IronLawsBanner";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge, EmptyState } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea, Label, Field } from "@/components/ui/Input";
import { HABIT_FREQUENCY, HABIT_SCHEDULE_MODE, toDateString, WEEKDAY_LABELS, isHabitScheduledOnDateForHabit, parseMonthDays, cn } from "@/lib/utils";
import { format, addDays, subDays, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Plus, Check, Trash2, Pencil, Pause, Play, GripVertical, CalendarDays } from "lucide-react";
import {
  CachedContent,
  fetchJson,
  invalidateFetchCache,
  peekFetchCache,
  shouldShowPageLoading,
} from "@/components/ui/PageState";
import { HabitHeatmap } from "@/components/habits/HabitHeatmap";
import { CardHeader, CardTitle } from "@/components/ui/Card";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { DateNav } from "@/components/ui/DateNav";
import { WeekScheduleGrid, type ScheduleBlockItem } from "@/components/schedule/WeekScheduleGrid";
import { ScheduleBlockModal, type ScheduleForm } from "@/components/schedule/ScheduleBlockModal";
import Link from "next/link";
import { HABIT_POWER_BASE, LIFE_POWERS, LIFE_POWER_META, isLifePowerKey } from "@/lib/life-powers";
import { UI_COPY } from "@/lib/ui-copy";

/** 习惯锁定的九力 */
function PowerChip({ power }: { power?: string | null }) {
  if (isLifePowerKey(power)) {
    return (
      <span className="shrink-0 rounded border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-700">
        {LIFE_POWER_META[power].label}
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] text-zinc-500">
      {power === HABIT_POWER_BASE ? "底盘" : "未锁定"}
    </span>
  );
}

type HabitBase = {
  id: string;
  name: string;
  description: string | null;
  projectId: string | null;
  project: { id: string; name: string } | null;
  frequency: string;
  scheduleMode: string;
  daysOfWeek: string;
  monthDays: string;
  startTime: string | null;
  endTime: string | null;
  color: string;
  isActive: boolean;
  cue?: string | null;
  minimumVersion?: string | null;
  /** 九力归属（锁定） */
  power?: string | null;
  checkIns: Array<{ id: string; date: string; completed: boolean; note?: string | null; level?: string | null }>;
  weekDone?: number;
  weekExpected?: number;
  weekDue?: number;
};

type Project = { id: string; name: string };
type View = "all" | "week";

const VIEWS: { key: View; label: string }[] = [
  { key: "all", label: "全部习惯" },
  { key: "week", label: "本周概览" },
];

const HABIT_GROUP_ORDER = ["DAILY", "WEEKLY", "MONTHLY"] as const;

const emptyForm = {
  name: "",
  description: "",
  projectId: "",
  frequency: "DAILY",
  scheduleMode: "none" as "none" | "weekly" | "monthly",
  daysOfWeek: [1, 2, 3, 4, 5, 6, 0] as number[],
  monthDays: [1] as number[],
  startTime: "",
  endTime: "",
  color: "#10b981",
  cue: "",
  minimumVersion: "",
  /** "" = 新建时按名字给默认值；编辑时 = 未锁定 */
  power: "",
};

const emptyScheduleForm: ScheduleForm = {
  title: "",
  description: "",
  dayOfWeek: 1,
  startTime: "09:00",
  endTime: "10:00",
  color: "#6366f1",
  habitId: "",
  goalId: "",
};

function parseDays(daysOfWeek: string): number[] {
  try {
    return JSON.parse(daysOfWeek);
  } catch {
    return [1, 2, 3, 4, 5, 6, 0];
  }
}

function parseMonthDaysValue(monthDays: string): number[] {
  return parseMonthDays(monthDays);
}

function isScheduledOnDate(
  habit: Pick<HabitBase, "scheduleMode" | "daysOfWeek" | "monthDays">,
  dateStr: string
): boolean {
  return isHabitScheduledOnDateForHabit(habit, dateStr);
}

function getMonday(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toDateString(d);
}

export default function HabitsPage() {
  const [view, setView] = useState<View>("all");
  const [habits, setHabits] = useState<HabitBase[]>(
    () => peekFetchCache<{ habits: HabitBase[] }>("/api/habits?view=all")?.habits ?? []
  );
  const [projects, setProjects] = useState<Project[]>(
    () => peekFetchCache<Project[]>("/api/projects") ?? []
  );
  const [weekStart, setWeekStart] = useState(getMonday());
  const [weekEnd, setWeekEnd] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<HabitBase | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(() =>
    shouldShowPageLoading(["/api/habits?view=all", "/api/projects"])
  );
  const [error, setError] = useState<string | null>(null);
  const [heatmap, setHeatmap] = useState<{ year: number; entries: Array<{ date: string; rate: number; done: number; expected: number }> } | null>(null);
  const [checkInModal, setCheckInModal] = useState<{ habitId: string; date: string; habitName: string } | null>(null);
  const [checkInNote, setCheckInNote] = useState("");
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlockItem[]>([]);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleEditing, setScheduleEditing] = useState<ScheduleBlockItem | null>(null);
  const [scheduleForm, setScheduleForm] = useState(emptyScheduleForm);
  const [dragHabitId, setDragHabitId] = useState<string | null>(null);
  const [dropHabitId, setDropHabitId] = useState<string | null>(null);

  const load = useCallback(async (opts?: { force?: boolean }) => {
    const force = opts?.force ?? false;
    if (force) invalidateFetchCache("/api/habits");
    let url = `/api/habits?view=${view}`;
    if (view === "week") url += `&weekStart=${weekStart}`;
    const keys = [url, "/api/projects"];
    if (force ? habits.length === 0 : shouldShowPageLoading(keys)) setLoading(true);
    setError(null);
    try {
      const [habitsData, projs, blocksData] = await Promise.all([
        fetchJson<{ habits: HabitBase[]; weekEnd?: string }>(url, { force }),
        fetchJson<Project[]>("/api/projects"),
        view === "week"
          ? fetchJson<ScheduleBlockItem[]>("/api/schedule")
          : Promise.resolve([] as ScheduleBlockItem[]),
      ]);
      setHabits(habitsData.habits);
      if (habitsData.weekEnd) setWeekEnd(habitsData.weekEnd);
      setProjects(projs);
      setScheduleBlocks(blocksData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [view, weekStart, habits.length]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const year = new Date().getFullYear();
    fetch(`/api/habits/heatmap?year=${year}`)
      .then((r) => r.json())
      .then(setHeatmap)
      .catch(() => {});
  }, [view, weekStart]);

  const patchCheckIn = (habitId: string, date: string, completed: boolean) => {
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== habitId) return h;
        const without = h.checkIns.filter((c) => c.date !== date);
        if (!completed) return { ...h, checkIns: without };
        return {
          ...h,
          checkIns: [...without, { id: `_local_${date}`, date, completed: true }],
        };
      })
    );
  };

  const toggleCheckIn = async (habitId: string, date: string, checked: boolean, habitName?: string) => {
    if (checked) {
      patchCheckIn(habitId, date, false);
      const res = await fetch(`/api/habits/${habitId}/checkin?date=${date}`, { method: "DELETE" });
      if (!res.ok) {
        patchCheckIn(habitId, date, true);
        const err = await res.json();
        alert(err.error || "取消失败");
        return;
      }
      invalidateFetchCache("/api/habits");
      invalidateFetchCache("/api/daily-log");
      invalidateFetchCache("/api/dashboard");
      invalidateFetchCache("/api/stream");
      void load({ force: true });
      return;
    }
    setCheckInModal({ habitId, date, habitName: habitName || "" });
    setCheckInNote("");
  };

  const confirmCheckIn = async () => {
    if (!checkInModal) return;
    const { habitId, date } = checkInModal;
    patchCheckIn(habitId, date, true);
    const res = await fetch(`/api/habits/${habitId}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, completed: true, note: checkInNote.trim() || null }),
    });
    if (!res.ok) {
      patchCheckIn(habitId, date, false);
      const err = await res.json();
      alert(err.error || "打卡失败");
      return;
    }
    setCheckInModal(null);
    setCheckInNote("");
    invalidateFetchCache("/api/habits");
    invalidateFetchCache("/api/daily-log");
    invalidateFetchCache("/api/dashboard");
    invalidateFetchCache("/api/stream");
    void load({ force: true });
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (h: HabitBase) => {
    setEditing(h);
    setForm({
      name: h.name,
      description: h.description || "",
      projectId: h.projectId || "",
      frequency: h.frequency,
      scheduleMode: (h.scheduleMode || "none") as "none" | "weekly" | "monthly",
      daysOfWeek: parseDays(h.daysOfWeek),
      monthDays: parseMonthDaysValue(h.monthDays || "[1]"),
      startTime: h.startTime || "",
      endTime: h.endTime || "",
      color: h.color,
      cue: h.cue || "",
      minimumVersion: h.minimumVersion || "",
      power: h.power || "",
    });
    setModalOpen(true);
  };

  const save = async () => {
    const payload = {
      ...form,
      projectId: form.projectId || null,
      startTime: form.startTime || null,
      endTime: form.endTime || null,
      // 新建且未选 → 交给服务端按名字建议；编辑时空 = 解除锁定
      power: form.power || (editing ? null : undefined),
    };
    if (editing) {
      await fetch(`/api/habits/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setModalOpen(false);
    load({ force: true });
  };

  const remove = async (id: string) => {
    if (!confirm("确定删除此习惯？")) return;
    await fetch(`/api/habits/${id}`, { method: "DELETE" });
    load({ force: true });
  };

  const toggleActive = async (habit: HabitBase) => {
    await fetch(`/api/habits/${habit.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !habit.isActive }),
    });
    load({ force: true });
  };

  const reorderHabits = async (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const from = habits.find((h) => h.id === fromId);
    const to = habits.find((h) => h.id === toId);
    if (!from || !to || from.frequency !== to.frequency) return;

    const sections = HABIT_GROUP_ORDER.map((freq) => habits.filter((h) => h.frequency === freq));
    const sectionIdx = HABIT_GROUP_ORDER.indexOf(from.frequency as (typeof HABIT_GROUP_ORDER)[number]);
    if (sectionIdx < 0) return;

    const group = [...sections[sectionIdx]];
    const fromIdx = group.findIndex((h) => h.id === fromId);
    const toIdx = group.findIndex((h) => h.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;

    const [item] = group.splice(fromIdx, 1);
    group.splice(toIdx, 0, item);
    sections[sectionIdx] = group;

    const list = sections.flat();
    const orderedIds = list.map((h) => h.id);
    const prev = habits;
    setHabits(list);

    const res = await fetch("/api/habits/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    });
    if (!res.ok) {
      setHabits(prev);
      const err = await res.json().catch(() => ({}));
      alert(err.error || "排序保存失败");
    }
  };

  const toggleDay = (day: number) => {
    const days = form.daysOfWeek.includes(day)
      ? form.daysOfWeek.filter((d) => d !== day)
      : [...form.daysOfWeek, day];
    setForm({ ...form, daysOfWeek: days.sort() });
  };

  const toggleMonthDay = (day: number) => {
    const days = form.monthDays.includes(day)
      ? form.monthDays.filter((d) => d !== day)
      : [...form.monthDays, day];
    setForm({ ...form, monthDays: days.sort((a, b) => a - b) });
  };

  const openScheduleCreate = (day?: number) => {
    setScheduleEditing(null);
    setScheduleForm({ ...emptyScheduleForm, dayOfWeek: day ?? 1 });
    setScheduleModalOpen(true);
  };

  const openScheduleEdit = (block: ScheduleBlockItem) => {
    setScheduleEditing(block);
    setScheduleForm({
      title: block.title,
      description: block.description || "",
      dayOfWeek: block.dayOfWeek,
      startTime: block.startTime,
      endTime: block.endTime,
      color: block.color,
      habitId: block.habitId || "",
      goalId: block.goalId || "",
    });
    setScheduleModalOpen(true);
  };

  const saveSchedule = async () => {
    const payload = {
      ...scheduleForm,
      habitId: scheduleForm.habitId || null,
      goalId: scheduleForm.goalId || null,
    };
    if (scheduleEditing) {
      await fetch(`/api/schedule/${scheduleEditing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setScheduleModalOpen(false);
    load({ force: true });
  };

  const removeSchedule = async () => {
    if (!scheduleEditing || !confirm("确定删除？")) return;
    await fetch(`/api/schedule/${scheduleEditing.id}`, { method: "DELETE" });
    setScheduleModalOpen(false);
    load({ force: true });
  };

  const today = toDateString();
  const weekDates = Array.from({ length: 7 }, (_, i) =>
    toDateString(addDays(parseISO(`${weekStart}T12:00:00`), i))
  );

  const HabitMeta = ({ habit, compact = false }: { habit: HabitBase; compact?: boolean }) => {
    const days = parseDays(habit.daysOfWeek);
    const monthDays = parseMonthDaysValue(habit.monthDays || "[1]");
    const weekdays =
      habit.scheduleMode === "monthly"
        ? `每月 ${monthDays.join("、")} 日`
        : days.map((d) => WEEKDAY_LABELS[d === 0 ? 6 : d - 1]).join("");
    const time =
      habit.startTime && habit.endTime
        ? `${habit.startTime}-${habit.endTime}`
        : habit.startTime || "";

    if (compact) {
      return (
        <div className="hidden md:flex items-center gap-1.5 min-w-0 text-[11px] text-zinc-400 truncate">
          {!habit.isActive && <Badge className="bg-amber-100 text-amber-700 text-[10px] px-1 py-0">暂停</Badge>}
          {time && <span className="shrink-0 font-mono">{time}</span>}
          <span className="truncate">{weekdays}</span>
          {habit.project && (
            <Badge className="bg-indigo-100 text-indigo-700 text-[10px] px-1 py-0 truncate max-w-[8rem]">
              {habit.project.name}
            </Badge>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 flex-wrap">
        {!habit.isActive && (
          <Badge className="bg-amber-100 text-amber-700">已暂停</Badge>
        )}
        <span>{HABIT_FREQUENCY[habit.frequency]}</span>
        {habit.scheduleMode !== "none" && (
          <Badge className="bg-sky-100 text-sky-700">
            {HABIT_SCHEDULE_MODE[habit.scheduleMode] || habit.scheduleMode}
          </Badge>
        )}
        {habit.startTime && (
          <span>{habit.startTime}{habit.endTime ? ` - ${habit.endTime}` : ""}</span>
        )}
        {habit.scheduleMode === "monthly" ? (
          <span>每月 {monthDays.join("、")} 日</span>
        ) : (
          <span>{days.map((d) => WEEKDAY_LABELS[d === 0 ? 6 : d - 1]).join(" ")}</span>
        )}
        {habit.project && (
          <Badge className="bg-indigo-100 text-indigo-700">{habit.project.name}</Badge>
        )}
      </div>
    );
  };

  const habitGroups = useMemo(() => {
    return HABIT_GROUP_ORDER.map((freq) => ({
      frequency: freq,
      label: HABIT_FREQUENCY[freq],
      items: habits.filter((h) => h.frequency === freq),
    })).filter((g) => g.items.length > 0);
  }, [habits]);

  const renderHabitRow = (habit: HabitBase) => {
    const weekDone = habit.weekDone ?? 0;
    const weekExpected = habit.weekExpected ?? 0;
    const weekDue = habit.weekDue ?? 0;
    const behind = weekDue > weekDone ? weekDue - weekDone : 0;
    const isDragging = dragHabitId === habit.id;
    const isDropTarget = dropHabitId === habit.id && dragHabitId !== habit.id;
    const dragged = dragHabitId ? habits.find((h) => h.id === dragHabitId) : null;
    const canDrop = !dragged || dragged.frequency === habit.frequency;

    return (
      <div
        key={habit.id}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1.5 hover:bg-zinc-50/80 transition-colors",
          !habit.isActive && "opacity-60",
          isDragging && "opacity-40",
          isDropTarget && canDrop && "bg-indigo-50 ring-1 ring-inset ring-indigo-300"
        )}
        onDragOver={(e) => {
          if (!canDrop) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDropHabitId(habit.id);
        }}
        onDragLeave={() => setDropHabitId((id) => (id === habit.id ? null : id))}
        onDrop={(e) => {
          e.preventDefault();
          if (!canDrop) return;
          const fromId = e.dataTransfer.getData("text/plain");
          if (fromId) reorderHabits(fromId, habit.id);
          setDragHabitId(null);
          setDropHabitId(null);
        }}
      >
        <span
          draggable
          onDragStart={(e) => {
            setDragHabitId(habit.id);
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", habit.id);
          }}
          onDragEnd={() => {
            setDragHabitId(null);
            setDropHabitId(null);
          }}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing p-0.5 text-zinc-300 hover:text-zinc-500 rounded"
          title="拖拽排序（组内）"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
        <span
          className="h-2.5 w-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: habit.color }}
        />
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span
            className="text-sm font-medium text-zinc-900 truncate shrink-0 max-w-[40%] sm:max-w-[28%]"
            title={habit.description ? `${habit.name}\n${habit.description}` : habit.name}
          >
            {habit.name}
          </span>
          <PowerChip power={habit.power} />
          <HabitMeta habit={habit} compact />
        </div>
        <span
          className="hidden sm:inline text-[11px] text-zinc-500 tabular-nums shrink-0"
          title="本周进度"
        >
          {weekExpected > 0
            ? `${weekDone}/${weekExpected}${behind > 0 ? ` ·-${behind}` : ""}`
            : "—"}
        </span>
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => toggleActive(habit)}
            title={habit.isActive ? "暂停习惯" : "恢复习惯"}
            className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
          >
            {habit.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => { setView("week"); setWeekStart(getMonday()); }}
            title="本周概览"
            className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 hidden sm:block"
          >
            <CalendarDays className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => openEdit(habit)}
            title="编辑"
            className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => remove(habit.id)}
            title="删除"
            className="p-1.5 rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="习惯打卡"
        description={UI_COPY.habits.description}
        action={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> 添加习惯
          </Button>
        }
      />
      <CachedContent loading={loading} error={error} onRetry={load} hasData={habits.length > 0}>

      <IronLawsBanner compact />

      <FilterTabs tabs={VIEWS} value={view} onChange={(k) => setView(k as View)} />

      {/* ── 全部习惯 ── */}
      {view === "all" && (
        <>
          {habits.length === 0 ? (
            <EmptyState title="还没有习惯" description="点击右上角添加你的第一个习惯" />
          ) : (
            <>
              <p className="text-xs text-zinc-500 mb-2">拖拽 ⋮⋮ 在同组内调整顺序 · 排序同步至日计划与本周概览</p>
              <div className="space-y-4">
                {habitGroups.map((group) => (
                  <div key={group.frequency}>
                    <div className="flex items-center gap-2 mb-1.5 px-1">
                      <h3 className="text-xs font-semibold text-zinc-700">{group.label}</h3>
                      <span className="text-[11px] text-zinc-400">{group.items.length} 项</span>
                    </div>
                    <div className="rounded-xl border border-zinc-200/80 bg-white divide-y divide-zinc-100 overflow-hidden">
                      {group.items.map((habit) => renderHabitRow(habit))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ── 本周概览 ── */}
      {view === "week" && (
        <>
          <DateNav
            variant="compact"
            label={
              <>
                {format(parseISO(`${weekStart}T12:00:00`), "M月d日", { locale: zhCN })}
                {" – "}
                {format(parseISO(`${weekEnd || weekDates[6]}T12:00:00`), "M月d日", { locale: zhCN })}
              </>
            }
            prevLabel="上一周"
            nextLabel="下一周"
            onPrev={() => setWeekStart(toDateString(subDays(parseISO(`${weekStart}T12:00:00`), 7)))}
            onNext={() => setWeekStart(toDateString(addDays(parseISO(`${weekStart}T12:00:00`), 7)))}
            trailing={
              weekStart !== getMonday() ? (
                <Button variant="secondary" size="sm" onClick={() => setWeekStart(getMonday())}>
                  本周
                </Button>
              ) : undefined
            }
          />

          {habits.length === 0 ? (
            <EmptyState title="还没有习惯" description="点击右上角添加习惯" />
          ) : (
            <Card className="overflow-x-auto">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-8 border-b border-zinc-100 bg-zinc-50/80">
                  <div className="px-2 py-1.5 text-xs font-medium text-zinc-500">习惯</div>
                  {weekDates.map((d, i) => {
                    const isToday = d === today;
                    return (
                      <div key={d} className={`px-1 py-1.5 text-center ${isToday ? "bg-indigo-50" : ""}`}>
                        <p className="text-[10px] text-zinc-500">{WEEKDAY_LABELS[i]}</p>
                        <p className={`text-xs font-medium ${isToday ? "text-indigo-700" : "text-zinc-700"}`}>
                          {format(parseISO(`${d}T12:00:00`), "d")}
                        </p>
                      </div>
                    );
                  })}
                </div>
                {habits.map((habit) => {
                  const checkedDates = new Set(
                    habit.checkIns.filter((c) => c.completed).map((c) => c.date)
                  );
                  return (
                    <div key={habit.id} className="grid grid-cols-8 border-b border-zinc-50 items-center">
                      <div className="px-2 py-1.5 min-w-0">
                        <button
                          type="button"
                          onClick={() => openEdit(habit)}
                          className="text-xs font-medium text-zinc-900 truncate block max-w-full text-left hover:text-indigo-600"
                          title={habit.name}
                        >
                          {habit.name}
                        </button>
                        {habit.startTime && (
                          <p className="text-[10px] text-zinc-400 font-mono truncate">
                            {habit.startTime}
                            {habit.endTime ? `–${habit.endTime}` : ""}
                          </p>
                        )}
                      </div>
                      {weekDates.map((d) => {
                        const scheduled = isScheduledOnDate(habit, d);
                        const checked = checkedDates.has(d);
                        const isFuture = d > today;
                        if (!scheduled) {
                          return (
                            <div key={d} className="p-1 flex justify-center">
                              <span className="h-6 w-6 rounded bg-zinc-50 flex items-center justify-center text-zinc-300 text-[10px]">—</span>
                            </div>
                          );
                        }
                        return (
                          <div key={d} className="p-1 flex justify-center">
                            <button
                              disabled={isFuture}
                              onClick={() => toggleCheckIn(habit.id, d, checked, habit.name)}
                              className={`h-6 w-6 rounded border flex items-center justify-center transition-all ${
                                checked
                                  ? "border-emerald-500 bg-emerald-500 text-white"
                                  : isFuture
                                    ? "border-zinc-100 bg-zinc-50 cursor-not-allowed"
                                    : "border-zinc-200 hover:border-emerald-400 cursor-pointer"
                              }`}
                              style={!checked && !isFuture ? { borderColor: `${habit.color}55` } : undefined}
                            >
                              {checked && <Check className="h-3 w-3" />}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
          <p className="text-xs text-zinc-400 mt-3">— 非执行日 · 点击格子打卡/取消 · 未来日期不可打卡 · 今日打卡请去日计划</p>

          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">习惯时间块</h2>
                <p className="text-xs text-zinc-500 mt-0.5">每周固定时间段，点击时间块可编辑</p>
              </div>
              <div className="flex gap-2">
                <Link
                  href="/calendar/week"
                  className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition-colors"
                >
                  打开周日历
                </Link>
                <Button size="sm" onClick={() => openScheduleCreate()}>
                  <Plus className="h-4 w-4" /> 添加时间块
                </Button>
              </div>
            </div>
            {scheduleBlocks.length === 0 ? (
              <EmptyState
                title="还没有时间块"
                description="为习惯安排固定时间段，比如周一 9:00-10:00 深度工作"
              />
            ) : (
              <WeekScheduleGrid
                blocks={scheduleBlocks}
                onBlockClick={openScheduleEdit}
                onAddClick={openScheduleCreate}
              />
            )}
          </div>
        </>
      )}

      {heatmap && heatmap.entries.length > 0 && (
        <Card className="mt-8">
          <CardHeader><CardTitle>完成度热力图</CardTitle></CardHeader>
          <CardContent>
            <HabitHeatmap year={heatmap.year} entries={heatmap.entries} />
          </CardContent>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "编辑习惯" : "添加习惯"} wide>
        <div className="grid grid-cols-2 gap-4">
          <Field className="col-span-2">
            <Label>习惯名称 *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如：每日阅读30分钟" />
          </Field>
          <Field className="col-span-2">
            <Label>描述</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field>
            <Label>触发线索</Label>
            <Input value={form.cue} onChange={(e) => setForm({ ...form, cue: e.target.value })} placeholder="如：午饭后、到家后" />
          </Field>
          <Field>
            <Label>最小版本（2 分钟规则）</Label>
            <Input value={form.minimumVersion} onChange={(e) => setForm({ ...form, minimumVersion: e.target.value })} placeholder="如：读 1 页、收 2 件衣服" />
          </Field>
          <Field>
            <Label>九力归属（锁定）</Label>
            <Select value={form.power} onChange={(e) => setForm({ ...form, power: e.target.value })}>
              <option value="">{editing ? "未锁定" : "按名字自动建议"}</option>
              <optgroup label="人体六力">
                {LIFE_POWERS.filter((p) => p.group === "body").map((p) => (
                  <option key={p.key} value={p.key}>{p.label} · {p.role}</option>
                ))}
              </optgroup>
              <optgroup label="群体三力">
                {LIFE_POWERS.filter((p) => p.group === "group").map((p) => (
                  <option key={p.key} value={p.key}>{p.label} · {p.role}</option>
                ))}
              </optgroup>
              <option value={HABIT_POWER_BASE}>生活底盘（不进九力）</option>
            </Select>
          </Field>
          <Field>
            <Label>关联项目</Label>
            <Select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
              <option value="">无关联</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field>
            <Label>频率</Label>
            <Select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
              {Object.entries(HABIT_FREQUENCY).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>
          <Field className="col-span-2">
            <Label>时间表模式</Label>
            <Select
              value={form.scheduleMode}
              onChange={(e) => setForm({ ...form, scheduleMode: e.target.value as "none" | "weekly" | "monthly" })}
            >
              {Object.entries(HABIT_SCHEDULE_MODE).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
            {form.scheduleMode === "weekly" && (
              <p className="text-xs text-zinc-500 mt-1">保存后自动在日历周视图中为每个执行日生成时间块</p>
            )}
            {form.scheduleMode === "monthly" && (
              <p className="text-xs text-zinc-500 mt-1">按每月固定日期打卡；有时间则会显示在日历周视图</p>
            )}
          </Field>
          {(form.scheduleMode === "weekly" || form.scheduleMode === "monthly") && (
            <>
              <Field>
                <Label>开始时间 *</Label>
                <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              </Field>
              <Field>
                <Label>结束时间 *</Label>
                <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </Field>
            </>
          )}
          {form.scheduleMode === "none" && (
            <>
              <Field>
                <Label>开始时间</Label>
                <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              </Field>
              <Field>
                <Label>结束时间</Label>
                <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </Field>
            </>
          )}
          <Field>
            <Label>颜色</Label>
            <Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          </Field>
          <Field className="col-span-2">
            {form.scheduleMode === "monthly" ? (
              <>
                <Label>每月执行日</Label>
                <div className="flex gap-1.5 flex-wrap max-h-32 overflow-y-auto">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleMonthDay(day)}
                      className={`px-2 py-1 rounded text-xs transition-all ${
                        form.monthDays.includes(day)
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <Label>执行日（周几）</Label>
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                        form.daysOfWeek.includes(day)
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {WEEKDAY_LABELS[day === 0 ? 6 : day - 1]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>取消</Button>
          <Button onClick={save} disabled={!form.name || ((form.scheduleMode === "weekly" || form.scheduleMode === "monthly") && (!form.startTime || !form.endTime))}>保存</Button>
        </div>
      </Modal>

      <ScheduleBlockModal
        open={scheduleModalOpen}
        editing={scheduleEditing}
        form={scheduleForm}
        habits={habits.map((h) => ({ id: h.id, name: h.name }))}
        onClose={() => setScheduleModalOpen(false)}
        onChange={setScheduleForm}
        onSave={saveSchedule}
        onDelete={removeSchedule}
      />

      <Modal open={!!checkInModal} onClose={() => setCheckInModal(null)} title={`打卡 — ${checkInModal?.habitName || ""}`}>
        <Field>
          <Label>备注（可选）</Label>
          <Textarea
            value={checkInNote}
            onChange={(e) => setCheckInNote(e.target.value)}
            placeholder="今天完成情况、感受..."
            className="min-h-[80px]"
          />
        </Field>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={() => setCheckInModal(null)}>取消</Button>
          <Button onClick={confirmCheckIn}>完成打卡</Button>
        </div>
      </Modal>
      </CachedContent>
    </>
  );
}
