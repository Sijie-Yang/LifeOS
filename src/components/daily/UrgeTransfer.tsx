"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseWellnessScore } from "@/lib/wellness-scores";
import { URGE_ACTIONS, URGE_PLAN } from "@/lib/urge-transfer";

export type UrgeTodayEvent = { id: string; time: string; outcome: string; label: string };

/**
 * 冲动 · 转化：早上打分给出今天的预案；冲动来了点一下记转移方式（冷水澡 / 运动 / 出门 / 做事 / 硬扛 / 破戒）。
 * 打分条由外面的 ScoreRow 渲染，这里是预案、按钮和今天的记录。
 */
export function UrgeTransferActions({
  morning,
  today,
  streak,
  brokeToday,
  disabled,
  onAction,
  onDelete,
}: {
  morning: number | null;
  today: UrgeTodayEvent[];
  streak: number;
  brokeToday: boolean;
  disabled?: boolean;
  onAction: (key: (typeof URGE_ACTIONS)[number]["key"]) => void;
  onDelete: (id: string) => void;
}) {
  const score = parseWellnessScore(morning);
  const transfers = today.filter((e) => e.outcome !== "gave_in").length;
  return (
    <div className="space-y-1.5">
      {score != null && (
        <p className="text-[11px] text-zinc-600">
          今天的预案：<span className="font-medium text-zinc-800">{URGE_PLAN[score]}</span>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-[11px] text-zinc-500">冲动来了 →</span>
        {URGE_ACTIONS.map((a) => (
          <button
            key={a.key}
            type="button"
            disabled={disabled}
            onClick={() => onAction(a.key)}
            className={cn(
              "rounded px-2 py-0.5 text-[11px] disabled:opacity-50",
              a.outcome === "gave_in"
                ? "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                : a.outcome === "surfed"
                  ? "bg-sky-50 text-sky-700 hover:bg-sky-100"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            )}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1 text-[11px] text-zinc-500">
        <span className={cn(brokeToday ? "text-rose-600" : "text-zinc-600")}>
          {today.length === 0
            ? "今天还没有冲动记录"
            : `今天 ${today.length} 次冲动 · ${transfers} 次转移${brokeToday ? " · 破戒" : ""}`}
        </span>
        <span className="text-zinc-400">· 连续守住 {streak} 天</span>
        {today.map((e) => (
          <span
            key={e.id}
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 tabular-nums",
              e.outcome === "gave_in" ? "bg-rose-50 text-rose-700" : "bg-zinc-100 text-zinc-600"
            )}
          >
            {e.time} {e.label}
            {!disabled && (
              <button type="button" onClick={() => onDelete(e.id)} className="text-zinc-400 hover:text-red-500" title="删掉这条">
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
