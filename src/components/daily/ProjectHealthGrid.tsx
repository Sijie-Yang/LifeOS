"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/components/ui/PageState";
import { cn } from "@/lib/utils";
import type { ProjectHealth } from "@/lib/project-health";

type Item = ProjectHealth & { color: string | null };

const LEVEL = {
  red: { bar: "border-l-rose-500", chip: "bg-rose-50 text-rose-700", label: "告急" },
  amber: { bar: "border-l-amber-400", chip: "bg-amber-50 text-amber-700", label: "注意" },
  green: { bar: "border-l-emerald-400", chip: "bg-emerald-50 text-emerald-700", label: "正常" },
} as const;

function md(d: string | null | undefined) {
  return d ? d.slice(5).replace("-", "/") : "—";
}

/** 逐项目对齐下面的项目总览：每个项目一个小格，颜色 = 健康度，点一下打开对齐弹窗到这个项目 */
export function ProjectHealthGrid({ version, onOpen }: { version: number; onOpen?: (projectId: string) => void }) {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ items: Item[] }>("/api/projects/health", { force: true })
      .then((d) => !cancelled && setItems(d.items))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [version]);

  if (!items) return <p className="text-[11px] text-zinc-400">加载项目总览…</p>;
  if (items.length === 0) return null;

  const active = items.filter((i) => i.planActive);
  const paused = items.filter((i) => !i.planActive);
  const count = (l: keyof typeof LEVEL) => active.filter((i) => i.level === l).length;

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="font-medium text-zinc-700">项目总览</span>
        {(["red", "amber", "green"] as const).map((l) => (
          <span key={l} className={cn("rounded px-1.5 py-0.5", LEVEL[l].chip)}>
            {LEVEL[l].label} {count(l)}
          </span>
        ))}
        {paused.length > 0 && <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-500">暂停 {paused.length}</span>}
        <span className="ml-auto text-zinc-400">悬停看原因 · 点格子去对齐</span>
      </div>
      <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {[...active, ...paused].map((p) => {
          const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
          const tip = [
            p.name,
            p.planActive ? `健康度：${LEVEL[p.level].label}` : "已暂停",
            ...p.reasons,
            `进度 ${p.done}/${p.total}`,
            p.nextStepTitle ? `下一步 ${md(p.nextStepDate)}：${p.nextStepTitle}` : null,
            p.nextMilestone ? `下个里程碑 ${md(p.nextMilestone.date)}：${p.nextMilestone.title}` : null,
            p.targetDate ? `目标 ${p.targetDate} · 预计 ${p.projectedFinish ?? "排不出"}` : null,
          ]
            .filter(Boolean)
            .join("\n");
          const line = !p.planActive
            ? "暂停"
            : p.reasons[0] ??
              (p.nextMilestone?.date ? `◆ ${md(p.nextMilestone.date)} ${p.nextMilestone.title}` : p.nextStepDate ? `下一步 ${md(p.nextStepDate)}` : "");
          return (
            <li key={p.id}>
              <button
                type="button"
                title={tip}
                disabled={!onOpen}
                onClick={() => onOpen?.(p.id)}
                className={cn(
                  "w-full rounded-md border border-l-4 border-zinc-100 bg-white px-2 py-1.5 text-left hover:bg-zinc-50 disabled:cursor-default",
                  p.planActive ? LEVEL[p.level].bar : "border-l-zinc-300 opacity-60"
                )}
              >
                <div className="flex items-center gap-1">
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-zinc-800">{p.name}</span>
                  {p.scheduledToday && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" title="今天排到" />}
                  <span className="shrink-0 text-[10px] tabular-nums text-zinc-400">
                    {p.done}/{p.total}
                  </span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full rounded-full bg-zinc-400" style={{ width: `${pct}%` }} />
                </div>
                <p
                  className={cn(
                    "mt-1 truncate text-[10px]",
                    p.planActive && p.level === "red" ? "text-rose-600" : p.planActive && p.level === "amber" ? "text-amber-700" : "text-zinc-500"
                  )}
                >
                  {line}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
