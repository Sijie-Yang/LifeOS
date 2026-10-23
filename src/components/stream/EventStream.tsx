"use client";

/* The stream hydrates from fetched data on mount and on range change. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock,
  ChevronRight,
  Circle,
  ListChecks,
  MessageCircle,
  Milestone,
  Repeat,
  SquareCheck,
  Timer,
  Users,
  type LucideIcon,
  Flag,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EventTimerButton, FreeTimerStart } from "@/components/stream/EventTimerButton";
import { EventTimerTracks } from "@/components/stream/EventTimerTracks";
import { AgentRunList } from "@/components/stream/AgentRunList";
import { ProgressBar } from "@/components/ui/Badge";
import {
  CachedContent,
  fetchJson,
  invalidateFetchCache,
  peekFetchCache,
  shouldShowPageLoading,
} from "@/components/ui/PageState";
import { cn } from "@/lib/utils";
import {
  filterStream,
  groupStreamByDay,
  nowIndex,
  streamFacets,
  type StreamEvent,
  type StreamSop,
  type StreamKind,
} from "@/lib/event-stream";

type StreamResponse = {
  start: string;
  end: string;
  today: string;
  events: StreamEvent[];
};

const KIND_META: Record<StreamKind, { label: string; icon: LucideIcon; tone: string }> = {
  routine: { label: "习惯", icon: Repeat, tone: "text-emerald-600" },
  block: { label: "日程", icon: CalendarClock, tone: "text-indigo-600" },
  task: { label: "任务", icon: SquareCheck, tone: "text-sky-600" },
  meeting: { label: "会议", icon: Users, tone: "text-violet-600" },
  contact: { label: "联系", icon: MessageCircle, tone: "text-pink-600" },
  sop: { label: "SOP", icon: ListChecks, tone: "text-amber-600" },
  step: { label: "推进", icon: Milestone, tone: "text-indigo-600" },
  focus: { label: "专注", icon: Timer, tone: "text-rose-600" },
  deadline: { label: "DDL", icon: Flag, tone: "text-rose-600" },
  moment: { label: "临时", icon: Clock, tone: "text-stone-500" },
};

const INVALIDATE = ["/api/stream", "/api/daily-log", "/api/tasks", "/api/projects", "/api/habits", "/api/dashboard"];

function shiftDate(date: string, days: number) {
  return format(addDays(parseISO(`${date}T12:00:00`), days), "yyyy-MM-dd");
}

function plainSnippet(text: string) {
  return text
    .replace(/[#*`>_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function todayLocal() {
  return format(new Date(), "yyyy-MM-dd");
}

function dayLabel(date: string, today: string) {
  const base = format(parseISO(`${date}T12:00:00`), "M月d日 EEE", { locale: zhCN });
  if (date === today) return `今天 · ${base}`;
  if (date === shiftDate(today, 1)) return `明天 · ${base}`;
  if (date === shiftDate(today, -1)) return `昨天 · ${base}`;
  return base;
}

function Fold({
  label,
  count,
  tone = "text-zinc-500",
  defaultOpen = false,
  children,
}: {
  label: string;
  count: number;
  tone?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn("flex items-center gap-1.5 px-1 py-1 text-xs hover:text-zinc-800", tone)}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {label} · {count}
      </button>
      {open && <div className="mt-1 space-y-0.5">{children}</div>}
    </div>
  );
}

/** 事件流里直接勾清单：按分组列出，勾选即保存 */
function SopChecklist({
  items,
  onToggle,
}: {
  items: NonNullable<StreamSop["items"]>;
  onToggle: (itemId: string, done: boolean) => void;
}) {
  const groups: Array<{ name: string; items: typeof items }> = [];
  for (const it of items) {
    const name = it.group ?? "";
    const g = groups.find((x) => x.name === name);
    if (g) g.items.push(it);
    else groups.push({ name, items: [it] });
  }
  return (
    <div className="max-h-72 space-y-1.5 overflow-y-auto">
      {groups.map((g) => (
        <div key={g.name}>
          {g.name && <p className="mb-0.5 text-[10px] font-semibold text-amber-800/70">{g.name}</p>}
          <ul className="space-y-0.5">
            {g.items.map((it) => (
              <li key={it.id}>
                <label className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed">
                  <input
                    type="checkbox"
                    checked={it.done}
                    onChange={(ev) => onToggle(it.id, ev.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-amber-600"
                  />
                  <span className={it.done ? "text-zinc-400 line-through" : "text-zinc-700"}>{it.text}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function EventRow({
  event: e,
  today,
  onComplete,
  onPostpone,
  onFeedback,
  onPickPerson,
  onPickSop,
  onToggleSopItem,
}: {
  event: StreamEvent;
  today: string;
  onComplete: (e: StreamEvent) => void;
  onPostpone: (e: StreamEvent) => void;
  onFeedback: (e: StreamEvent, text: string) => void;
  onPickPerson: (id: string) => void;
  onPickSop: (key: string) => void;
  onToggleSopItem: (sop: StreamSop, itemId: string, done: boolean) => void;
}) {
  const [sopOpen, setSopOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const meta = KIND_META[e.kind];
  const Icon = meta.icon;
  const done = e.status === "done";
  const checkable = Boolean(e.action) && e.date <= today;
  const postponable = !done && (e.action?.type === "task" || e.action?.type === "step");
  const askFeedback = done && e.action?.type === "step" && !e.note && e.date === today;

  return (
    <div
      className={cn(
        "group rounded-lg border px-2.5 py-1 transition-colors",
        done ? "border-transparent bg-zinc-50/70" : "border-zinc-100 bg-white hover:border-zinc-200",
        e.status === "skipped" && "opacity-50"
      )}
    >
      {/* 一行放完：时间 · 勾 · 标题 · 备注 · 标签 · 计时 */}
      <div className="flex items-center gap-2">
        <span className="w-11 shrink-0 text-right text-xs tabular-nums text-zinc-400">{e.time ?? ""}</span>
        {checkable ? (
          <button type="button" onClick={() => onComplete(e)} className="shrink-0" aria-label={done ? "取消完成" : "完成"}>
            {done ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <Circle className="h-4 w-4 text-zinc-300 hover:text-emerald-500" />
            )}
          </button>
        ) : (
          <Icon className={cn("h-4 w-4 shrink-0", meta.tone, done && "opacity-50")} />
        )}
        {/* 标题优先：至少留 10rem，标签组可以被裁掉 */}
        <div className="flex min-w-[12rem] flex-1 items-baseline gap-2">
          <Link
            href={e.href}
            className={cn(
              "truncate text-sm hover:underline",
              done ? "text-zinc-400 line-through decoration-zinc-300" : "text-zinc-800"
            )}
          >
            {e.title}
          </Link>
          {e.endTime && e.time && <span className="shrink-0 text-[10px] text-zinc-400">→ {e.endTime}</span>}
          {e.note && <span className="hidden min-w-0 shrink-[4] truncate text-[11px] text-zinc-400 xl:inline">{plainSnippet(e.note)}</span>}
        </div>
        <div className="flex min-w-0 shrink items-center gap-1 overflow-hidden text-[11px] [&>*]:shrink-0">
          <span className={cn("inline-flex items-center gap-1", meta.tone)} title={meta.label}>
            <Icon className="h-3 w-3" />
            <span className="hidden xl:inline">{meta.label}</span>
          </span>
          {e.overdueFrom && (
            <span className="rounded-full bg-amber-50 px-1.5 text-amber-700">
              原定 {format(parseISO(`${e.overdueFrom}T12:00:00`), "M/d")}
            </span>
          )}
          {e.project && (
            <Link
              href={`/projects?id=${e.project.id}`}
              className="hidden max-w-[9rem] truncate rounded-full bg-zinc-100 px-1.5 text-zinc-600 hover:bg-indigo-50 hover:text-indigo-700 lg:inline"
              title="打开项目"
            >
              {e.project.name}
            </Link>
          )}
          {e.people.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPickPerson(p.id)}
              className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-1.5 text-pink-700 hover:bg-pink-100"
              title="只看这个人"
            >
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-pink-200 text-[9px]">
                {p.name.slice(0, 1)}
              </span>
              <span className="hidden lg:inline">{p.name}</span>
            </button>
          ))}
          {e.sop && (
            <button
              type="button"
              onClick={() => setSopOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 text-amber-700 hover:bg-amber-100"
            >
              <ListChecks className="h-3 w-3" />
              {e.sop.key.startsWith("habit:") ? "SOP" : e.sop.title}
              {e.sop.progress && e.sop.progress.total > 0 && (
                <span className="tabular-nums">
                  {e.sop.progress.done}/{e.sop.progress.total}
                </span>
              )}
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 text-[11px]">
          {/* 临时事件本身就是计时记录；房间分区事件没有对应的单条记录 */}
          {e.kind !== "moment" && !e.id.startsWith("room:") && <EventTimerButton event={e} />}
          {postponable && (
            <button
              type="button"
              onClick={() => onPostpone(e)}
              className="rounded-md px-1.5 text-zinc-400 opacity-0 hover:bg-zinc-100 hover:text-zinc-700 group-hover:opacity-100 focus:opacity-100"
            >
              推到明天
            </button>
          )}
        </div>
      </div>
      {sopOpen && e.sop && (
        <div className="mt-1.5 ml-[4.75rem] rounded-lg border border-amber-100 bg-amber-50/40 p-2.5">
          {e.sop.progress && e.sop.progress.total > 0 && (
            <ProgressBar value={Math.round((e.sop.progress.done / e.sop.progress.total) * 100)} className="mb-2 h-1" />
          )}
          {e.sop.text && (
            <p className="max-h-56 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-zinc-700">{e.sop.text}</p>
          )}
          {e.sop.items && e.sop.items.length > 0 && (
            <SopChecklist
              items={e.sop.items}
              onToggle={(itemId, done) => onToggleSopItem(e.sop!, itemId, done)}
            />
          )}
          <div className="mt-2 flex gap-3 text-[11px]">
            <Link href={e.sop.href} className="text-amber-700 hover:underline">
              打开 SOP
            </Link>
            <button type="button" onClick={() => onPickSop(e.sop!.key)} className="text-zinc-500 hover:underline">
              只看用这个 SOP 的事件
            </button>
          </div>
        </div>
      )}
      {askFeedback && (
        <input
          value={feedback}
          onChange={(ev) => setFeedback(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" && feedback.trim()) onFeedback(e, feedback.trim());
          }}
          onBlur={() => feedback.trim() && onFeedback(e, feedback.trim())}
          placeholder="做完看到了什么？回车保存，进闭环反馈"
          className="mt-1.5 ml-[4.75rem] w-[calc(100%-4.75rem)] rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs"
        />
      )}
    </div>
  );
}

export function EventStream() {
  const [today] = useState(todayLocal);
  // 只看从今天起的一周；过去的事件不在这里回看
  const range = { start: today, end: shiftDate(today, 7) };
  const key = `/api/stream?start=${range.start}&end=${range.end}`;
  const [data, setData] = useState<StreamResponse | null>(() => peekFetchCache<StreamResponse>(key));
  const [loading, setLoading] = useState(() => shouldShowPageLoading([key]));
  const [error, setError] = useState<string | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [sopKey, setSopKey] = useState<string | null>(null);
  const [showLowSignal, setShowLowSignal] = useState(false);
  const [now, setNow] = useState(() => format(new Date(), "HH:mm"));

  const load = useCallback(
    async (force = false) => {
      if (force) INVALIDATE.forEach((prefix) => invalidateFetchCache(prefix));
      if (shouldShowPageLoading([key])) setLoading(true);
      setError(null);
      try {
        setData(await fetchJson<StreamResponse>(key, { force }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setLoading(false);
      }
    },
    [key]
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(format(new Date(), "HH:mm")), 60_000);
    return () => clearInterval(t);
  }, []);

  const patchLocal = (id: string, patch: Partial<StreamEvent>) =>
    setData((prev) =>
      prev ? { ...prev, events: prev.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) } : prev
    );

  const complete = async (e: StreamEvent) => {
    if (!e.action) return;
    const nextDone = e.status !== "done";
    const a = e.action;
    patchLocal(e.id, {
      status: nextDone ? "done" : "open",
      ...(a.type === "step" && nextDone ? { note: null, overdueFrom: null, date: today } : {}),
    });
    if (a.type === "task") {
      await fetch(`/api/tasks/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: nextDone }),
      });
    } else if (a.type === "step") {
      await fetch(`/api/plan-steps/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: nextDone }),
      });
    } else if (nextDone) {
      await fetch(`/api/habits/${a.id}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: a.date, completed: true, level: "full" }),
      });
    } else {
      await fetch(`/api/habits/${a.id}/checkin?date=${a.date}`, { method: "DELETE" });
    }
    if (a.type !== "step" || !nextDone) void load(true);
    else INVALIDATE.forEach((prefix) => invalidateFetchCache(prefix));
  };

  // 同一个清单可能挂在多条事件上：一起更新。清单实例存 /api/checklists，房间分区存当天的 daily-log
  const toggleSopItem = async (sop: StreamSop, itemId: string, done: boolean) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        events: prev.events.map((ev) => {
          if (ev.sop?.key !== sop.key || ev.sop.runId !== sop.runId || !ev.sop.items) return ev;
          const items = ev.sop.items.map((it) => (it.id === itemId ? { ...it, done } : it));
          const finished = items.filter((i) => i.done).length;
          return {
            ...ev,
            ...(sop.roomDate ? { status: finished === items.length ? ("done" as const) : ("open" as const) } : {}),
            sop: { ...ev.sop, items, progress: { done: finished, total: items.length } },
          };
        }),
      };
    });
    if (sop.roomDate) {
      await fetch("/api/daily-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: sop.roomDate, roomTask: { key: itemId, done } }),
      });
    } else if (sop.runId) {
      await fetch(`/api/checklists/${sop.runId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, done }),
      });
    }
    INVALIDATE.forEach((prefix) => invalidateFetchCache(prefix));
  };

  const postpone = async (e: StreamEvent) => {
    const tomorrow = shiftDate(today, 1);
    const url = e.action?.type === "task" ? `/api/tasks/${e.action.id}` : `/api/plan-steps/${e.action?.id}`;
    setData((prev) => (prev ? { ...prev, events: prev.events.filter((x) => x.id !== e.id) } : prev));
    await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledDate: tomorrow }),
    });
    void load(true);
  };

  const saveFeedback = async (e: StreamEvent, text: string) => {
    if (e.action?.type !== "step") return;
    patchLocal(e.id, { note: text });
    await fetch(`/api/plan-steps/${e.action.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback: text }),
    });
    INVALIDATE.forEach((prefix) => invalidateFetchCache(prefix));
  };

  const all = useMemo(() => data?.events ?? [], [data]);
  const facets = useMemo(() => streamFacets(all), [all]);
  const visible = useMemo(
    () => filterStream(all, { personId, sopKey, showLowSignal }),
    [all, personId, sopKey, showLowSignal]
  );
  const days = useMemo(() => groupStreamByDay(visible), [visible]);
  const selectedPerson = facets.people.find((p) => p.person.id === personId)?.person;
  const selectedSop = facets.sops.find((s) => s.sop.key === sopKey)?.sop;

  const rowProps = {
    today,
    onComplete: (e: StreamEvent) => void complete(e),
    onPostpone: (e: StreamEvent) => void postpone(e),
    onFeedback: (e: StreamEvent, text: string) => void saveFeedback(e, text),
    onPickPerson: setPersonId,
    onPickSop: setSopKey,
    onToggleSopItem: toggleSopItem,
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="事件流"
        description="事件 × 时间 × 人物 × SOP · 今天起一周，汇总自日程、习惯、任务、项目、会议、联系与 SOP"
      />

      <FreeTimerStart />
      <EventTimerTracks />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div>
      <div className="mb-5 flex flex-wrap items-center gap-2 text-xs">
        {facets.people.slice(0, 6).map(({ person, count }) => (
          <button
            key={person.id}
            type="button"
            onClick={() => setPersonId(personId === person.id ? null : person.id)}
            className={cn(
              "rounded-full border px-2.5 py-1",
              personId === person.id
                ? "border-pink-300 bg-pink-50 text-pink-700"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
            )}
          >
            {person.name} · {count}
          </button>
        ))}
        {facets.sops.length > 0 && (
          <select
            value={sopKey ?? ""}
            onChange={(ev) => setSopKey(ev.target.value || null)}
            className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-zinc-600"
          >
            <option value="">全部 SOP</option>
            {facets.sops.map(({ sop, count }) => (
              <option key={sop.key} value={sop.key}>
                {sop.title} · {count}
              </option>
            ))}
          </select>
        )}
        {facets.lowSignal > 0 && (
          <button
            type="button"
            onClick={() => setShowLowSignal((v) => !v)}
            className="rounded-full px-2.5 py-1 text-zinc-400 hover:text-zinc-600"
          >
            {showLowSignal ? "隐藏低信号社交" : `已折叠 ${facets.lowSignal} 条低信号社交`}
          </button>
        )}
        {(selectedPerson || selectedSop) && (
          <button
            type="button"
            onClick={() => {
              setPersonId(null);
              setSopKey(null);
            }}
            className="rounded-full bg-zinc-800 px-2.5 py-1 text-white"
          >
            {[selectedPerson?.name, selectedSop?.title].filter(Boolean).join(" · ")} ✕
          </button>
        )}
      </div>

      <CachedContent loading={loading} error={error} onRetry={() => load(true)} hasData={!!data}>
        {days.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-200 py-12 text-center text-sm text-zinc-500">
            这段时间没有事件
          </p>
        ) : (
          <div className="space-y-4">
            {days.map((day) => {
              const isToday = day.date === today;
              // 已完成的按时间顺序平铺在最前面（灰色），然后是还没做的，逾期的单独折叠
              const done = day.events.filter((e) => e.status !== "open");
              const open = day.events.filter((e) => e.status === "open");
              const overdue = open.filter((e) => e.overdueFrom);
              const current = open.filter((e) => !e.overdueFrom);
              const marker = isToday ? nowIndex(current, now) : -1;
              return (
                <section key={day.date}>
                  <div className="mb-2 flex items-baseline justify-between border-b border-zinc-100 pb-1.5">
                    <h2 className={cn("text-sm font-semibold", isToday ? "text-indigo-700" : "text-zinc-700")}>
                      {dayLabel(day.date, today)}
                    </h2>
                    <span className="text-[11px] tabular-nums text-zinc-400">
                      {done.length}/{day.events.length}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    {done.map((e) => (
                      <EventRow key={e.id} event={e} {...rowProps} />
                    ))}
                    {current.map((e, i) => (
                      <div key={e.id}>
                        {i === marker && (
                          <div className="my-2 flex items-center gap-2 text-[11px] font-medium text-indigo-600">
                            <span className="w-11 text-right tabular-nums">{now}</span>
                            <span className="h-px flex-1 bg-indigo-200" />
                            此刻
                          </div>
                        )}
                        <EventRow event={e} {...rowProps} />
                      </div>
                    ))}
                    {isToday && marker === current.length && (
                      <div className="my-2 flex items-center gap-2 text-[11px] font-medium text-indigo-600">
                        <span className="w-11 text-right tabular-nums">{now}</span>
                        <span className="h-px flex-1 bg-indigo-200" />
                        此刻 · 今天的安排都过了
                      </div>
                    )}
                  </div>
                  <Fold label="逾期待推进（每个项目只显示下一步）" count={overdue.length} tone="text-amber-700">
                    {overdue.map((e) => (
                      <EventRow key={e.id} event={e} {...rowProps} />
                    ))}
                  </Fold>
                </section>
              );
            })}
          </div>
        )}
      </CachedContent>
      </div>
      <AgentRunList />
      </div>
    </div>
  );
}
