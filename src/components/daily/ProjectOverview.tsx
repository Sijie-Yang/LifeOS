"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { CheckCircle2, Circle, Diamond, Flag } from "lucide-react";
import { fetchJson } from "@/components/ui/PageState";
import { cn, toDateString } from "@/lib/utils";

type ProjectDetail = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  startDate: string | null;
  targetDate: string | null;
  wishFinishTime: string | null;
  goal: { id: string; title: string } | null;
  milestones: Array<{ id: string; title: string; dueDate: string | null; completed: boolean; derived?: boolean }>;
  planSteps: Array<{
    id: string;
    title: string;
    detail: string | null;
    isMilestone: boolean;
    done: boolean;
    doneDate: string | null;
    sortOrder: number;
  }>;
  stepDates: Record<string, string>;
  projectedFinish: string | null;
};

const STATUS: Record<string, string> = {
  IDEA: "想法",
  PLANNING: "规划中",
  ACTIVE: "进行中",
  ON_HOLD: "搁置",
  COMPLETED: "已完成",
};
const PRIORITY: Record<string, string> = { HIGH: "高", MEDIUM: "中", LOW: "低" };

function day(value: string | null | undefined): string | null {
  return value ? value.slice(0, 10) : null;
}

function short(value: string | null | undefined): string {
  return value ? format(parseISO(`${value.slice(0, 10)}T12:00:00`), "M/d") : "—";
}

/** 逐项目对齐弹窗右栏：这个项目的目标日期、里程碑、全部步骤（含排期） */
export function ProjectOverview({
  projectId,
  rev,
  onToggleStep,
  busy,
}: {
  projectId: string;
  rev: number;
  /** 传了就能在「全部步骤」里点圆圈完成 / 取消完成 */
  onToggleStep?: (stepId: string, done: boolean) => void;
  busy?: boolean;
}) {
  const [state, setState] = useState<{ id: string; data: ProjectDetail | null; error?: boolean }>({ id: "", data: null });

  useEffect(() => {
    let cancelled = false;
    fetchJson<ProjectDetail>(`/api/projects/${projectId}`, { force: true })
      .then((data) => !cancelled && setState({ id: projectId, data }))
      .catch(() => !cancelled && setState({ id: projectId, data: null, error: true }));
    return () => {
      cancelled = true;
    };
  }, [projectId, rev]);

  const p = state.id === projectId ? state.data : null;
  if (state.id === projectId && state.error) return <p className="text-xs text-zinc-400">读不到项目详情。</p>;
  if (!p) return <p className="text-xs text-zinc-400">加载项目全貌…</p>;

  const today = toDateString();
  const target = day(p.targetDate);
  const gap = target && p.projectedFinish ? differenceInCalendarDays(parseISO(p.projectedFinish), parseISO(target)) : null;
  const done = p.planSteps.filter((s) => s.done).length;
  const steps = [...p.planSteps].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-zinc-500">
        <span>
          状态 <span className="text-zinc-800">{STATUS[p.status] ?? p.status}</span> · 优先级{" "}
          <span className="text-zinc-800">{PRIORITY[p.priority] ?? p.priority}</span>
        </span>
        <span>
          开始 <span className="text-zinc-800">{short(p.startDate)}</span>
        </span>
        <span className="flex items-center gap-1">
          <Flag className="h-3 w-3 text-rose-500" />
          目标日期 <span className={cn("font-medium", target ? "text-zinc-900" : "text-zinc-400")}>{target ? short(target) : "未设"}</span>
        </span>
        <span>
          按节奏预计完成 <span className="font-medium text-zinc-900">{p.projectedFinish ? short(p.projectedFinish) : "排不出（没推进日或已暂停）"}</span>
          {gap != null && (
            <span className={cn("ml-1", gap > 0 ? "text-rose-600" : "text-emerald-600")}>
              {gap > 0 ? `比目标晚 ${gap} 天` : gap < 0 ? `提前 ${-gap} 天` : "正好赶上"}
            </span>
          )}
        </span>
        {p.wishFinishTime && (
          <span className="col-span-2">
            期望完成 <span className="text-zinc-800">{p.wishFinishTime}</span>
          </span>
        )}
        {p.goal && (
          <span className="col-span-2">
            所属目标 <span className="text-zinc-800">{p.goal.title}</span>
          </span>
        )}
      </div>

      <section>
        <p className="mb-1 text-xs font-semibold text-zinc-800">
          里程碑 <span className="font-normal text-zinc-400">{p.milestones.filter((m) => m.completed).length}/{p.milestones.length}</span>
        </p>
        {p.milestones.length === 0 ? (
          <p className="text-[11px] text-zinc-400">还没有里程碑</p>
        ) : (
          <ul className="space-y-0.5">
            {p.milestones.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-[12px]">
                <Diamond className={cn("h-3 w-3 shrink-0", m.completed ? "fill-emerald-500 text-emerald-500" : "text-zinc-400")} />
                <span className={cn("min-w-0 flex-1 truncate", m.completed && "text-zinc-400 line-through")}>{m.title}</span>
                {m.derived && <span className="shrink-0 text-[10px] text-zinc-400">来自步骤</span>}
                <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-zinc-500">{short(day(m.dueDate))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <p className="mb-1 text-xs font-semibold text-zinc-800">
          全部步骤 <span className="font-normal text-zinc-400">{done}/{steps.length}</span>
        </p>
        <ol className="space-y-0.5">
          {steps.map((s, i) => {
            const date = s.done ? s.doneDate : p.stepDates[s.id];
            return (
              <li
                key={s.id}
                title={s.detail ?? undefined}
                className={cn("flex items-center gap-2 rounded px-1 text-[12px]", !s.done && date === today && "bg-amber-50")}
              >
                <span className="w-5 shrink-0 text-right text-[10px] tabular-nums text-zinc-400">{i + 1}</span>
                {onToggleStep ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onToggleStep(s.id, s.done)}
                    className="shrink-0 disabled:opacity-50"
                    title={s.done ? "已完成 · 点一下取消" : "点一下完成"}
                    aria-label={s.done ? "取消完成" : "标为完成"}
                  >
                    {s.done ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-zinc-300 hover:text-emerald-500" />
                    )}
                  </button>
                ) : s.done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="h-3.5 w-3.5 shrink-0 text-zinc-300" />
                )}
                <span className={cn("min-w-0 flex-1 truncate", s.done && "text-zinc-400")}>{s.title}</span>
                {s.isMilestone && <Diamond className="h-3 w-3 shrink-0 text-indigo-500" />}
                <span className={cn("w-10 shrink-0 text-right text-[11px] tabular-nums", s.done ? "text-zinc-400" : "text-zinc-600")}>
                  {date ? short(date) : "—"}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <Link href={`/projects?id=${p.id}`} className="inline-block text-[11px] text-indigo-600 hover:underline">
        打开项目页 →
      </Link>
    </div>
  );
}
