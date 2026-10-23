"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, ClipboardCheck, Copy, ListChecks, PanelLeft, PanelRight, Plus, RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { fetchJson, invalidateFetchCache } from "@/components/ui/PageState";
import type { AlignContext } from "@/lib/align-ops";
import { recordKey, type RecordExtra, type RecordKind, type RecordNotes } from "@/lib/day-record";
import { cn, toDateString } from "@/lib/utils";
import { ProjectOverview } from "@/components/daily/ProjectOverview";
import { canUndoLever } from "@/components/daily/NinePowersMap";
import { ProjectNotesPanel } from "@/components/daily/ProjectNotesPanel";
import { AlignTimer } from "@/components/daily/AlignTimer";
import { ProjectHealthGrid } from "@/components/daily/ProjectHealthGrid";
import { DAY_PHASES, type DayPhase } from "@/lib/day-flow";
import { LIFE_POWERS, type LifePowerLever, type LifePowersResult } from "@/lib/life-powers";

/* ───────────────────────── 三段步骤条 ───────────────────────── */

export function DayFlowStepper({
  phase,
  autoPhase,
  onChange,
}: {
  phase: DayPhase;
  /** 按时间 / 状态推荐的阶段，标「现在」 */
  autoPhase: DayPhase;
  onChange: (phase: DayPhase) => void;
}) {
  return (
    <ol className="mb-4 grid grid-cols-3 gap-2">
      {DAY_PHASES.map((p, i) => (
        <li key={p.key}>
          <button
            type="button"
            onClick={() => onChange(p.key)}
            className={cn(
              "w-full rounded-xl border px-3 py-2 text-left transition",
              phase === p.key
                ? "border-indigo-300 bg-indigo-50 shadow-sm"
                : "border-zinc-200 bg-white hover:border-zinc-300"
            )}
          >
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                  phase === p.key ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-500"
                )}
              >
                {i + 1}
              </span>
              <span className={cn("text-sm font-semibold", phase === p.key ? "text-indigo-900" : "text-zinc-700")}>
                {p.label}
              </span>
              {autoPhase === p.key && (
                <span className="ml-auto rounded bg-emerald-50 px-1 text-[10px] text-emerald-700">现在</span>
              )}
            </div>
            <p className="mt-0.5 hidden truncate text-[11px] text-zinc-500 sm:block">{p.hint}</p>
          </button>
        </li>
      ))}
    </ol>
  );
}

/* ───────────────────────── 今日自动安排 ───────────────────────── */

const KIND_LABEL: Record<LifePowerLever["type"], string> = {
  habit: "习惯",
  task: "任务",
  plan_step: "步骤",
  meeting: "会议",
  content: "推广",
  opportunity: "机会",
  urge: "转移",
  room: "房间",
};

/** 每个力最多直接列出的机会（机会力常驻在跟的机会很多） */
const OPPORTUNITY_PREVIEW = 3;

type AgendaStep = { id: string; projectName: string };

/**
 * 今日安排完全自动：选入九力的项目步骤（自动顺延）、到期任务、会议、机会 DDL。
 * 按九力分组；习惯不在这里重复，统一在习惯打卡里。
 */
export function TodayAgenda({
  lifePowers,
  planSteps,
  title,
  onLeverToggle,
  busy,
}: {
  lifePowers: LifePowersResult;
  planSteps: AgendaStep[];
  title: string;
  onLeverToggle?: (lever: LifePowerLever) => void;
  busy?: boolean;
}) {
  const projectOf = new Map(planSteps.map((s) => [s.id, s.projectName]));
  const groups = LIFE_POWERS.map((meta) => {
    const dim = lifePowers.dimensions.find((d) => d.key === meta.key);
    const items = (dim?.todayLevers ?? []).filter((l) => l.type !== "habit");
    const opps = items.filter((l) => l.type === "opportunity");
    const shown = [...items.filter((l) => l.type !== "opportunity"), ...opps.slice(0, OPPORTUNITY_PREVIEW)];
    return { meta, items: shown, hidden: Math.max(0, opps.length - OPPORTUNITY_PREVIEW) };
  }).filter((g) => g.items.length > 0);
  const loose = lifePowers.unmatched.filter((l) => l.type !== "habit");
  const all = [...groups.flatMap((g) => g.items), ...loose];
  const done = all.filter((l) => l.done).length;

  return (
    <Card className="border-zinc-200/80">
      <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-100 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <ListChecks className="h-4 w-4 text-indigo-600" />
          {title}
        </CardTitle>
        <span className="text-[11px] text-zinc-500">
          {all.length === 0 ? "自动排程 · 今天没有项目事件" : `自动排程 · ${done}/${all.length} 已做`}
        </span>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {all.length === 0 && (
          <p className="text-xs text-zinc-500">
            今天没有排到的项目步骤、任务或会议。习惯在下方打卡；项目在九力弹窗里「选入」后会自动排进来。
          </p>
        )}
        {groups.map(({ meta, items, hidden }) => (
          <div key={meta.key}>
            <p className="mb-1 text-[11px] font-medium text-zinc-500">
              {meta.label}
              <span className="ml-1 text-zinc-400">{meta.role}</span>
            </p>
            <AgendaList items={items} projectOf={projectOf} onLeverToggle={onLeverToggle} busy={busy} />
            {hidden > 0 && <p className="mt-1 text-[11px] text-zinc-400">还有 {hidden} 个在跟的机会，点九力里的「机会力」看全部</p>}
          </div>
        ))}
        {loose.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-medium text-amber-700">未入九力 · 项目还没选入任何一力</p>
            <AgendaList items={loose} projectOf={projectOf} onLeverToggle={onLeverToggle} busy={busy} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AgendaList({
  items,
  projectOf,
  onLeverToggle,
  busy,
}: {
  items: LifePowerLever[];
  projectOf: Map<string, string>;
  onLeverToggle?: (lever: LifePowerLever) => void;
  busy?: boolean;
}) {
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2">
      {items.map((l) => {
        const clickable = Boolean(onLeverToggle) && (!l.done || canUndoLever(l));
        const project = l.type === "plan_step" ? projectOf.get(l.id) : undefined;
        return (
          <li key={`${l.type}-${l.id}`}>
            <button
              type="button"
              disabled={!clickable || busy}
              onClick={() => onLeverToggle?.(l)}
              title={clickable ? (l.done ? "已完成 · 点一下取消" : "点一下完成") : undefined}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm",
                l.done ? "border-emerald-100 bg-emerald-50/40 text-zinc-500" : "border-zinc-100 bg-white hover:border-zinc-200",
                !clickable && "cursor-default"
              )}
            >
              {l.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-zinc-400" />
              )}
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate", l.done && "line-through")}>{l.label}</span>
                {project && !l.label.includes(project) && (
                  <span className="block truncate text-[10px] text-zinc-400">{project}</span>
                )}
              </span>
              <span className="shrink-0 text-[10px] text-zinc-400">{KIND_LABEL[l.type]}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ───────────────────────── 开工 · 晨间习惯（并列打卡） ───────────────────────── */

/** 开工时先过的几个晨间习惯，并排显示，点一下打卡、再点取消；排在逐项目对齐之前。 */
export function MorningHabitsRow({
  habits,
  onCheck,
  title = "晨间习惯",
}: {
  habits: Array<{ id: string; name: string; label?: string; checked: boolean }>;
  /** 卡片标题（房间习惯也用这个样式） */
  title?: string;
  /** 未传 = 只读（已关账 / 不是今天） */
  onCheck?: (habitId: string, checked: boolean) => void;
}) {
  if (habits.length === 0) return null;
  const done = habits.filter((h) => h.checked).length;
  return (
    <Card className={cn(done === habits.length ? "border-emerald-100" : "border-zinc-200/80")}>
      <CardContent className="p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-xs font-semibold text-zinc-700">{title}</p>
          <span className="text-[11px] text-zinc-400">
            {done}/{habits.length}
          </span>
        </div>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {habits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                disabled={!onCheck}
                onClick={() => onCheck?.(h.id, h.checked)}
                title={`${h.name} · ${h.checked ? "已打卡，点击取消" : "打卡"}`}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition disabled:cursor-default",
                  h.checked
                    ? "border-emerald-200 bg-emerald-50/60 text-zinc-500"
                    : "border-zinc-200 bg-white text-zinc-800 hover:border-emerald-300"
                )}
              >
                {h.checked ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-zinc-400" />
                )}
                <span className={cn("truncate", h.checked && "line-through")}>{h.label ?? h.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/* ───────────────────────── 开工 · 逐项目对齐（每日习惯） ───────────────────────── */

/** 开工时 15 分钟：弹窗里一个个过项目（节奏、取舍、下一步），过完自动给习惯打卡；也可以直接和 Claude 对话。 */
export function ProjectAlignCard({
  habit,
  projectCount,
  onCheck,
  onFinish,
}: {
  habit: { id: string; checked: boolean } | null;
  /** 今天排到步骤的项目数 */
  projectCount: number;
  /** 点一下打卡，已打卡时再点一下取消 */
  onCheck?: (habitId: string, checked: boolean) => void;
  /** 弹窗里过完全部项目（未传 = 只读，不能开弹窗） */
  onFinish?: () => void;
}) {
  const [open, setOpen] = useState(false);
  /** 从项目总览点进来时，弹窗直接定位到这个项目 */
  const [openAt, setOpenAt] = useState<string | null>(null);
  /** 弹窗关掉后 +1，项目总览跟着刷新 */
  const [gridVersion, setGridVersion] = useState(0);
  const done = Boolean(habit?.checked);
  return (
    <Card className={cn(done ? "border-emerald-100" : "border-amber-200 bg-amber-50/30")}>
      <CardContent className="flex items-center gap-3 p-4">
        <button
          type="button"
          disabled={!habit || !onCheck}
          onClick={() => habit && onCheck?.(habit.id, done)}
          className="shrink-0 disabled:cursor-default"
          title={done ? "今日已对齐 · 点击取消打卡" : "对齐完打卡"}
        >
          {done ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500 hover:text-zinc-400" />
          ) : (
            <Circle className="h-5 w-5 text-zinc-400 hover:text-emerald-500" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-semibold", done ? "text-zinc-500" : "text-zinc-900")}>
            逐项目对齐 · 约 15 分钟
          </p>
          <p className="text-[11px] text-zinc-500">
            {done
              ? "今天已对齐。"
              : `一个个过今天排到的 ${projectCount} 个项目：节奏、取舍、下一步。`}
          </p>
        </div>
        {onFinish && (
          <Button size="sm" variant={done ? "secondary" : "primary"} onClick={() => setOpen(true)}>
            {done ? "再过一遍" : "开始对齐"}
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        )}
      </CardContent>
      <div className="border-t border-zinc-100 px-4 pb-3 pt-2">
        <ProjectHealthGrid
          version={gridVersion}
          onOpen={
            onFinish
              ? (id) => {
                  setOpenAt(id);
                  setOpen(true);
                }
              : undefined
          }
        />
      </div>
      {open && onFinish && (
        <ProjectAlignModal
          initialProjectId={openAt}
          onClose={() => {
            setOpen(false);
            setOpenAt(null);
            setGridVersion((v) => v + 1);
          }}
          onFinish={() => {
            setOpen(false);
            setOpenAt(null);
            setGridVersion((v) => v + 1);
            onFinish();
          }}
        />
      )}
    </Card>
  );
}

const WEEKDAYS = [
  { d: 1, label: "一" },
  { d: 2, label: "二" },
  { d: 3, label: "三" },
  { d: 4, label: "四" },
  { d: 5, label: "五" },
  { d: 6, label: "六" },
  { d: 0, label: "日" },
];

type AlignProject = AlignContext["projects"][number];

const ALIGN_PROGRESS_PREFIX = "lifeos:align-progress:";

function readAlignProgress(): { visited: string[]; current: string | null } {
  try {
    const raw = JSON.parse(window.localStorage.getItem(ALIGN_PROGRESS_PREFIX + toDateString()) ?? "null");
    return {
      visited: Array.isArray(raw?.visited) ? raw.visited.filter((x: unknown) => typeof x === "string") : [],
      current: typeof raw?.current === "string" ? raw.current : null,
    };
  } catch {
    return { visited: [], current: null };
  }
}

function writeAlignProgress(progress: { visited: string[]; current: string | null }) {
  try {
    const key = ALIGN_PROGRESS_PREFIX + toDateString();
    window.localStorage.setItem(key, JSON.stringify(progress));
    // 清掉以前日期的记录
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(ALIGN_PROGRESS_PREFIX) && k !== key) window.localStorage.removeItem(k);
    }
  } catch {
    /* 存不了就只在本次生效 */
  }
}

function ProjectAlignModal({
  onClose,
  onFinish,
  initialProjectId,
}: {
  onClose: () => void;
  onFinish: () => void;
  /** 打开时直接定位到这个项目（不传就回到当天上次看到的项目） */
  initialProjectId?: string | null;
}) {
  const [ctx, setCtx] = useState<AlignContext | null>(null);
  /** 第一次加载时的顺序（今天排到的在前）；改完重新取数据也不打乱 */
  const [order, setOrder] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  /** 改完一次 +1，右栏的项目全貌跟着刷新 */
  const [rev, setRev] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [newStep, setNewStep] = useState("");
  /** 左边栏（全部项目）/ 右边栏（笔记）是否打开，记在本机 */
  const [sidebars, setSidebars] = useState<{ left: boolean; right: boolean }>(() => {
    try {
      return { left: true, right: false, ...JSON.parse(window.localStorage.getItem("lifeos:align-sidebars") ?? "{}") };
    } catch {
      return { left: true, right: false };
    }
  });
  const toggleSidebar = (side: "left" | "right") =>
    setSidebars((prev) => {
      const next = { ...prev, [side]: !prev[side] };
      try {
        window.localStorage.setItem("lifeos:align-sidebars", JSON.stringify(next));
      } catch {
        /* 存不了就只在本次生效 */
      }
      return next;
    });
  /** 这次已经看过的项目 */
  const [visited, setVisited] = useState<Set<string>>(() => new Set(readAlignProgress().visited));

  const load = useCallback(async () => {
    const res = await fetchJson<{ context: AlignContext }>("/api/plan/align?mode=projects", { force: true });
    setCtx(res.context);
    return res.context;
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ context: AlignContext }>("/api/plan/align?mode=projects", { force: true }).then(({ context }) => {
      if (cancelled) return;
      setCtx(context);
      const ids = context.projects.map((p) => p.projectId);
      setOrder(ids);
      // 从项目总览点进来就定位到那个项目；否则回到当天上次看到的项目
      const last = initialProjectId ?? readAlignProgress().current;
      const at = last ? ids.indexOf(last) : -1;
      if (at >= 0) setIndex(at);
    });
    return () => {
      cancelled = true;
    };
  }, [initialProjectId]);

  const byId = new Map((ctx?.projects ?? []).map((p) => [p.projectId, p]));
  const list = order.map((id) => byId.get(id)).filter((p): p is AlignProject => Boolean(p));
  const p = list[index] ?? null;
  const total = list.length;
  const scheduledToday = new Set((ctx?.todaySteps ?? []).map((s) => s.projectId));

  const apply = async (op: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/plan/align", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false, ops: [op] }),
      });
      const data = (await res.json()) as { errors?: string[] };
      if (data.errors?.length) setError(data.errors.join("；"));
      invalidateFetchCache("/api/daily-log");
      invalidateFetchCache("/api/projects");
      await load();
      setRev((r) => r + 1);
    } finally {
      setSaving(false);
    }
  };

  /** 刷新：重新取全部项目（外面改过也能马上看到），保留当前顺序和位置；新项目排到最后 */
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const context = await load();
      const ids = new Set(context.projects.map((x) => x.projectId));
      const currentId = p?.projectId;
      const next = [
        ...order.filter((id) => ids.has(id)),
        ...context.projects.map((x) => x.projectId).filter((id) => !order.includes(id)),
      ];
      setOrder(next);
      const keep = currentId ? next.indexOf(currentId) : -1;
      setIndex(keep >= 0 ? keep : Math.min(index, Math.max(next.length - 1, 0)));
      setRev((r) => r + 1);
    } finally {
      setRefreshing(false);
    }
  };

  // 今天看过哪些、看到哪个，记在本机（关掉弹窗再打开不丢；第二天重新开始）
  const currentId = p?.projectId ?? null;
  useEffect(() => {
    if (!currentId) return;
    writeAlignProgress({ visited: [...visited], current: currentId });
  }, [visited, currentId]);

  /** 只有明确确认才算对齐：「已对齐 · 下一个」「全部对齐完成」或手动标记；浏览、跳转、修改都不算 */
  const setAligned = (id: string, on: boolean) => {
    const next = new Set(visited);
    if (on) next.add(id);
    else next.delete(id);
    setVisited(next);
    // 立刻写入：「全部对齐完成」会马上关掉弹窗
    writeAlignProgress({ visited: [...next], current: currentId });
  };

  const go = (i: number) => {
    setIndex(i);
    setNewStep("");
    setError(null);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={total ? `逐项目对齐 · ${index + 1}/${total}` : "逐项目对齐"}
      wider={!sidebars.left && !sidebars.right}
      widest={sidebars.left || sidebars.right}
    >
      {!ctx ? (
        <p className="text-xs text-zinc-400">加载项目…</p>
      ) : !p ? (
        <p className="text-sm text-zinc-500">没有带步骤的项目。</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => toggleSidebar("left")}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px]",
                sidebars.left ? "bg-indigo-50 text-indigo-700" : "text-zinc-500 hover:bg-zinc-100"
              )}
              title="左边栏：全部项目"
            >
              <PanelLeft className="h-3.5 w-3.5" />
              全部项目（{total}）
            </button>
            <AlignTimer />
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-50"
              title="重新读取全部项目的最新数据"
            >
              <RotateCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
              {refreshing ? "刷新中…" : "刷新"}
            </button>
            <button
              type="button"
              onClick={() => toggleSidebar("right")}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px]",
                sidebars.right ? "bg-indigo-50 text-indigo-700" : "text-zinc-500 hover:bg-zinc-100"
              )}
              title="右边栏：这个项目的全部笔记"
            >
              笔记
              <PanelRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row">
            {sidebars.left && (
              <aside className="shrink-0 border-b border-zinc-100 pb-3 lg:max-h-[72vh] lg:w-56 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:pb-0 lg:pr-3">
                <ul className="space-y-0.5">
                  {list.map((proj, i) => (
                    <li key={proj.projectId}>
                      <button
                        type="button"
                        onClick={() => go(i)}
                        className={cn(
                          "flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[12px] hover:bg-zinc-50",
                          i === index && "bg-indigo-50 text-indigo-700"
                        )}
                      >
                        <span className="w-4 shrink-0 text-right text-[10px] tabular-nums text-zinc-400">{i + 1}</span>
                        <span className={cn("min-w-0 flex-1 truncate", !proj.planActive && "text-zinc-400")}>{proj.name}</span>
                        {scheduledToday.has(proj.projectId) && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" title="今天排到" />
                        )}
                        {!proj.planActive && <span className="shrink-0 text-[10px] text-zinc-400">暂停</span>}
                        {visited.has(proj.projectId) && (
                          <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" aria-label="今天已对齐" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 px-1.5 text-[10px] leading-relaxed text-zinc-400">
                  <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />今天排到 · 灰色 = 暂停 · ✓ = 今天已对齐（点「已对齐」才算）
                </p>
              </aside>
            )}
            <div
              className={cn(
                "grid min-w-0 flex-1 gap-6",
                // 开了边栏时中间变窄：宽屏才分两栏，否则上下排
                sidebars.left || sidebars.right ? "xl:grid-cols-2" : "lg:grid-cols-2"
              )}
            >
              <div className="space-y-4">
                <div className="h-1 overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full bg-indigo-500 transition-all" style={{ width: `${((index + 1) / total) * 100}%` }} />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/projects?id=${p.projectId}`} className="text-base font-semibold text-zinc-900 hover:underline">
                      {p.name}
                    </Link>
                    {p.category && <span className="text-[11px] text-zinc-400">{p.category}</span>}
                    {scheduledToday.has(p.projectId) && (
                      <span className="rounded bg-amber-100 px-1 text-[10px] text-amber-700">今天排到</span>
                    )}
                    {!p.planActive && <span className="rounded bg-zinc-100 px-1 text-[10px] text-zinc-500">已暂停</span>}
                    <button
                      type="button"
                      onClick={() => setAligned(p.projectId, !visited.has(p.projectId))}
                      className={cn(
                        "ml-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px]",
                        visited.has(p.projectId)
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                      )}
                      title={visited.has(p.projectId) ? "点击取消「已对齐」" : "不跳走，只把这个项目标为今天已对齐"}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {visited.has(p.projectId) ? "已对齐" : "标记已对齐"}
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <Stat label="进度" value={`${p.done}/${p.total}`} />
                    <Stat label="本周完成" value={String(p.doneThisWeek)} />
                    <Stat label="上次推进" value={p.lastDoneDate ? p.lastDoneDate.slice(5) : "从未"} />
                  </div>
                </div>

                <div>
                  <p className="mb-1 text-xs font-semibold text-zinc-800">接下来（自动排）</p>
                  {p.upcoming.length === 0 ? (
                    <p className="text-[11px] text-zinc-500">
                      {p.planActive ? "没有未完成的步骤，或者没设推进日。" : "已暂停，不排程。"}
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {p.upcoming.map((s) => (
                        <li key={s.stepId} className="group flex items-center gap-2 rounded-lg border border-zinc-100 px-2.5 py-1.5 text-sm">
                          <span className="w-12 shrink-0 text-[11px] tabular-nums text-zinc-500">{s.date.slice(5)}</span>
                          <span className="min-w-0 flex-1 truncate">{s.title}</span>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void apply({ op: "complete_step", stepId: s.stepId })}
                            className="shrink-0 text-zinc-300 hover:text-emerald-500"
                            title="点一下完成"
                            aria-label="标为完成"
                          >
                            <Circle className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void apply({ op: "remove_step", stepId: s.stepId })}
                            className="shrink-0 text-zinc-300 hover:text-red-500"
                            title="删掉这个步骤"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <form
                    className="mt-2 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const title = newStep.trim();
                      if (!title) return;
                      setNewStep("");
                      void apply({ op: "add_step", projectId: p.projectId, title });
                    }}
                  >
                    <Input
                      value={newStep}
                      onChange={(e) => setNewStep(e.target.value)}
                      placeholder="补一个下一步（动词开头，半天内能做完）"
                      className="h-8 flex-1 text-sm"
                    />
                    <Button type="submit" size="sm" variant="secondary" disabled={saving || !newStep.trim()}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-semibold text-zinc-800">节奏 · 哪几天推进</p>
                    <div className="flex gap-1">
                      {WEEKDAYS.map(({ d, label }) => {
                        const on = p.workdays.includes(d);
                        return (
                          <button
                            key={d}
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              void apply({
                                op: "set_rhythm",
                                projectId: p.projectId,
                                workdays: on ? p.workdays.filter((x) => x !== d) : [...p.workdays, d],
                              })
                            }
                            className={cn(
                              "h-7 w-7 rounded-md text-xs font-medium",
                              on ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                            )}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-zinc-800">归哪一力</p>
                    <select
                      value={p.power ?? ""}
                      disabled={saving}
                      onChange={(e) => void apply({ op: "set_power", projectId: p.projectId, power: e.target.value || null })}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm"
                    >
                      <option value="">不进九力</option>
                      {LIFE_POWERS.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label} · {m.role}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {error && <p className="text-[11px] text-red-600">{error}</p>}

                <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={saving}
                    onClick={() => void apply({ op: p.planActive ? "pause_project" : "resume_project", projectId: p.projectId })}
                  >
                    {p.planActive ? "暂停这个项目" : "恢复排程"}
                  </Button>
                  <div className="ml-auto flex gap-2">
                    <Button variant="secondary" size="sm" disabled={index === 0} onClick={() => go(index - 1)}>
                      上一个
                    </Button>
                    {index + 1 < total ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          setAligned(p.projectId, true);
                          go(index + 1);
                        }}
                      >
                        已对齐 · 下一个
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => {
                          setAligned(p.projectId, true);
                          onFinish();
                        }}
                      >
                        全部对齐完成 · 打卡
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <aside className="border-t border-zinc-100 pt-4 lg:max-h-[70vh] lg:overflow-y-auto lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <p className="mb-2 text-xs font-semibold text-zinc-800">项目全貌</p>
                <ProjectOverview
                  projectId={p.projectId}
                  rev={rev}
                  busy={saving}
                  onToggleStep={(stepId, done) => void apply({ op: done ? "uncomplete_step" : "complete_step", stepId })}
                />
              </aside>
            </div>
            {sidebars.right && (
              <aside className="shrink-0 border-t border-zinc-100 pt-3 lg:max-h-[72vh] lg:w-80 lg:overflow-y-auto lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                <p className="mb-2 text-xs font-semibold text-zinc-800">笔记 · {p.name}</p>
                <ProjectNotesPanel projectId={p.projectId} rev={rev} />
              </aside>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 px-2 py-1.5">
      <div className="text-sm font-semibold tabular-nums text-zinc-800">{value}</div>
      <div className="text-[10px] text-zinc-500">{label}</div>
    </div>
  );
}

/* ───────────────────────── 记录 · 做了什么 / 没做什么 ───────────────────────── */

type RecordItem = {
  key: string;
  type: RecordKind;
  id: string;
  label: string;
  sub?: string;
  done: boolean;
  kind: string;
  /** 有对应项目时点标题直接打开 */
  href?: string;
};

/**
 * 今天的步骤、任务、习惯分成「做了」和「没做」。做了的可以写多做了什么，没做的必须写原因，
 * 另外可以加计划外多做的事。写完复制今日总结给 Claude 复盘、打计划完成度分。
 */
export function DayRecord({
  steps,
  tasks,
  habits,
  notes,
  extras,
  planScore,
  planScoreNote,
  editable,
  onSaveNote,
  onSaveExtras,
  onToggle,
  buildPrompt,
}: {
  steps: Array<{ id: string; title: string; projectId?: string; projectName: string; done: boolean }>;
  tasks: Array<{ id: string; title: string; completed: boolean }>;
  /** 九力习惯（底盘只计数） */
  habits: Array<{ id: string; name: string; checked: boolean; base: boolean }>;
  notes: RecordNotes;
  extras: RecordExtra[];
  planScore: number | null;
  planScoreNote: string | null;
  editable: boolean;
  onSaveNote: (key: string, text: string) => void;
  onSaveExtras: (extras: RecordExtra[]) => void;
  /** 点勾切换做了 / 没做（未传 = 只读） */
  onToggle?: (type: RecordKind, id: string, done: boolean) => void;
  /** 复制给 Claude 的今日总结 */
  buildPrompt: () => string;
}) {
  const items: RecordItem[] = [
    ...steps.map((s) => ({
      key: recordKey("step", s.id),
      type: "step" as const,
      id: s.id,
      label: s.title,
      sub: s.projectName,
      done: s.done,
      kind: "步骤",
      href: s.projectId ? `/projects?id=${s.projectId}` : undefined,
    })),
    ...tasks.map((t) => ({ key: recordKey("task", t.id), type: "task" as const, id: t.id, label: t.title, done: t.completed, kind: "任务" })),
    ...habits
      .filter((h) => !h.base)
      .map((h) => ({ key: recordKey("habit", h.id), type: "habit" as const, id: h.id, label: h.name, done: h.checked, kind: "习惯" })),
  ];
  const done = items.filter((i) => i.done);
  const missed = items.filter((i) => !i.done);
  const base = habits.filter((h) => h.base);
  const missedSteps = steps.filter((s) => !s.done).length;
  const unexplained = missed.filter((i) => !notes[i.key]).length;

  const [newExtra, setNewExtra] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">("idle");
  const [manualText, setManualText] = useState("");

  const addExtra = () => {
    const title = newExtra.trim();
    if (!title) return;
    setNewExtra("");
    onSaveExtras([...extras, { id: `x${Date.now().toString(36)}`, title }]);
  };

  const copy = async () => {
    const text = buildPrompt();
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 3000);
    } catch {
      // 剪贴板不可用时，展开文本手动复制
      setManualText(text);
      setCopyState("manual");
    }
  };

  return (
    <Card className="border-indigo-100">
      <CardHeader className="border-b border-zinc-100 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardCheck className="h-4 w-4 text-indigo-600" />
          今日记录
          <span className="ml-auto text-[11px] font-normal text-zinc-500">
            做了 {done.length + extras.length} · 没做 {missed.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 p-4">
        <section>
          <p className="mb-1.5 text-xs font-semibold text-emerald-700">
            做了 <span className="font-normal text-zinc-400">{done.length + extras.length}</span>
          </p>
          {done.length === 0 && extras.length === 0 && <p className="text-[11px] text-zinc-400">还没有完成的事</p>}
          <ul className="space-y-1.5">
            {done.map((i) => (
              <RecordRow key={i.key} item={i} note={notes[i.key] ?? ""} editable={editable} onSave={onSaveNote} onToggle={onToggle} />
            ))}
            {extras.map((e) => (
              <li key={e.id} className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/40 px-2.5 py-1.5 text-sm">
                <Plus className="h-4 w-4 shrink-0 text-emerald-500" />
                <span className="min-w-0 flex-1 truncate">{e.title}</span>
                <span className="shrink-0 text-[10px] text-zinc-400">多做的</span>
                {editable && (
                  <button
                    type="button"
                    onClick={() => onSaveExtras(extras.filter((x) => x.id !== e.id))}
                    className="shrink-0 text-zinc-300 hover:text-red-500"
                    title="删掉"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {editable && (
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addExtra();
              }}
            >
              <Input
                value={newExtra}
                onChange={(e) => setNewExtra(e.target.value)}
                placeholder="计划外多做了什么？比如：和导师过了 related work"
                className="h-8 flex-1 text-sm"
              />
              <Button type="submit" size="sm" variant="secondary" disabled={!newExtra.trim()}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                多做的
              </Button>
            </form>
          )}
        </section>

        <section>
          <p className="mb-1.5 text-xs font-semibold text-zinc-700">
            没做 <span className="font-normal text-zinc-400">{missed.length}</span>
            {unexplained > 0 && <span className="ml-2 font-normal text-rose-600">还有 {unexplained} 个没写原因</span>}
          </p>
          {missed.length === 0 ? (
            <p className="text-[11px] text-zinc-400">全部完成</p>
          ) : (
            <ul className="space-y-1.5">
              {missed.map((i) => (
                <RecordRow key={i.key} item={i} note={notes[i.key] ?? ""} editable={editable} onSave={onSaveNote} onToggle={onToggle} required />
              ))}
            </ul>
          )}
          {missedSteps > 0 && <p className="mt-1.5 text-[11px] text-zinc-400">其中 {missedSteps} 个项目步骤明天自动顺延</p>}
          {base.length > 0 && (
            <p className="mt-1 text-[11px] text-zinc-400">
              生活底盘 {base.filter((h) => h.checked).length}/{base.length}
              {base.some((h) => !h.checked) && ` · 没做：${base.filter((h) => !h.checked).map((h) => h.name).join("、")}`}
            </p>
          )}
        </section>

        <section className="space-y-2 border-t border-zinc-100 pt-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-zinc-800">
                计划完成度{" "}
                <span className={cn("tabular-nums", planScore == null ? "text-zinc-400" : "text-indigo-700")}>
                  {planScore ?? "—"}
                </span>
                <span className="ml-1 font-normal text-zinc-400">/ 100 · Claude 复盘后填</span>
              </p>
              {planScoreNote && <p className="mt-0.5 whitespace-pre-line text-[11px] text-zinc-600">{planScoreNote}</p>}
            </div>
            <Button size="sm" disabled={unexplained > 0} onClick={() => void copy()} title={unexplained > 0 ? "先给每个没做的写原因" : undefined}>
              <Copy className="mr-1 h-3.5 w-3.5" />
              {copyState === "copied" ? "已复制 · 发给 Claude" : "复制今日总结"}
            </Button>
          </div>
          <p className="text-[11px] text-zinc-400">
            {unexplained > 0
              ? "每个没做的都写上原因，才能复制。"
              : "发给 Claude：它会调项目进度、审查记录和九力、打计划完成度分并自动填回这里。"}
          </p>
          {copyState === "manual" && (
            <Textarea
              readOnly
              value={manualText}
              onFocus={(e) => e.currentTarget.select()}
              className="min-h-[160px] font-mono text-[11px]"
            />
          )}
        </section>
      </CardContent>
    </Card>
  );
}

/** 一条记录 + 批注：做了的「多做了什么」（可选），没做的「原因」（必填）；失焦保存 */
function RecordRow({
  item,
  note,
  editable,
  required,
  onSave,
  onToggle,
}: {
  item: RecordItem;
  note: string;
  editable: boolean;
  required?: boolean;
  onSave: (key: string, text: string) => void;
  onToggle?: (type: RecordKind, id: string, done: boolean) => void;
}) {
  const [text, setText] = useState(note);
  const [open, setOpen] = useState(Boolean(required || note));
  // 服务器上的批注变了（比如重新加载）就跟上
  const [synced, setSynced] = useState(note);
  if (synced !== note) {
    setSynced(note);
    setText(note);
  }
  const missing = required && !text.trim();

  return (
    <li
      className={cn(
        "rounded-lg border px-2.5 py-1.5 text-sm",
        item.done ? "border-emerald-100 bg-emerald-50/40" : missing ? "border-rose-200 bg-rose-50/30" : "border-zinc-100 bg-white"
      )}
    >
      <div className="flex items-center gap-2">
        {onToggle && editable ? (
          <button
            type="button"
            onClick={() => onToggle(item.type, item.id, item.done)}
            className="shrink-0"
            title={item.done ? "点一下改成没做" : "点一下记为做了"}
            aria-label={item.done ? "改成没做" : "记为做了"}
          >
            {item.done ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 hover:text-zinc-400" />
            ) : (
              <Circle className="h-4 w-4 text-zinc-300 hover:text-emerald-500" />
            )}
          </button>
        ) : item.done ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
        ) : (
          <Circle className="h-4 w-4 shrink-0 text-zinc-300" />
        )}
        <span className="min-w-0 flex-1">
          {item.href ? (
            <Link href={item.href} title={`打开项目 · ${item.sub ?? ""}`} className="block truncate hover:text-indigo-700 hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="block truncate">{item.label}</span>
          )}
          {item.sub &&
            (item.href ? (
              <Link href={item.href} className="block truncate text-[10px] text-zinc-400 hover:text-indigo-600 hover:underline">
                {item.sub} →
              </Link>
            ) : (
              <span className="block truncate text-[10px] text-zinc-400">{item.sub}</span>
            ))}
        </span>
        <span className="shrink-0 text-[10px] text-zinc-400">{item.kind}</span>
        {item.done && editable && !open && (
          <button type="button" onClick={() => setOpen(true)} className="shrink-0 text-[11px] text-indigo-600 hover:underline">
            + 多做了什么
          </button>
        )}
      </div>
      {open &&
        (editable ? (
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => text.trim() !== note && onSave(item.key, text)}
            placeholder={required ? "为什么没做？（必填：主动取舍 / 时间不够 / 拖延 / 外部变化…）" : "多做了什么？（可选）"}
            className={cn("mt-1.5 min-h-[36px] bg-white text-xs", missing && "border-rose-300")}
            rows={1}
          />
        ) : (
          note && <p className="mt-1 text-[11px] text-zinc-600">{required ? "原因：" : "多做了："}{note}</p>
        ))}
    </li>
  );
}
