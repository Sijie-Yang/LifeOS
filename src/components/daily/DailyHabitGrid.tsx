"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Circle, Star } from "lucide-react";
import { ProgressBar } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import {
  HABIT_SEGMENTS,
  currentSegment,
  groupHabitsBySegment,
  type HabitSegmentKey,
} from "@/lib/habit-segments";

export type DailyHabitItem = {
  id: string;
  name: string;
  color: string;
  checked: boolean;
  cue?: string | null;
  minimumVersion?: string | null;
  level?: string | null;
  startTime?: string | null;
};

type Props = {
  habits: DailyHabitItem[];
  done: number;
  total: number;
  interactive: boolean;
  closed: boolean;
  isMustDo: (id: string) => boolean;
  onToggle: (id: string, checked: boolean) => void;
  onMinimum: (id: string) => void;
  onToggleMustDo: (id: string) => void;
};

const SEGMENT_ORDER = HABIT_SEGMENTS.map((s) => s.key);

function HabitRow({
  habit: h,
  editable,
  interactive,
  mustDo,
  onToggle,
  onMinimum,
  onToggleMustDo,
}: {
  habit: DailyHabitItem;
  editable: boolean;
  interactive: boolean;
  mustDo: boolean;
  onToggle: (id: string, checked: boolean) => void;
  onMinimum: (id: string) => void;
  onToggleMustDo: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 rounded-xl border px-2 py-1.5 transition-all",
        h.checked
          ? "border-emerald-200/80 bg-emerald-50/50"
          : "border-zinc-100 bg-white hover:border-zinc-200 hover:shadow-sm",
        mustDo && !h.checked && "ring-1 ring-amber-200/80"
      )}
    >
      {editable && (
        <button
          type="button"
          onClick={() => onToggleMustDo(h.id)}
          className="p-0.5 rounded shrink-0 opacity-60 group-hover:opacity-100"
          title="设为今日必做"
        >
          <Star className={cn("h-3.5 w-3.5", mustDo ? "text-amber-500 fill-amber-400" : "text-zinc-300")} />
        </button>
      )}
      <button
        type="button"
        onClick={() => interactive && onToggle(h.id, h.checked)}
        disabled={!interactive}
        className="flex flex-1 items-center gap-2 min-w-0 text-left disabled:cursor-default"
        title={h.cue ? `${h.cue} → ${h.name}` : h.name}
      >
        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: h.color }} />
        {h.checked ? (
          <CheckCircle2
            className={cn("h-4 w-4 shrink-0", h.level === "minimum" ? "text-amber-500" : "text-emerald-500")}
          />
        ) : (
          <Circle className="h-4 w-4 text-zinc-300 shrink-0" />
        )}
        <span className="min-w-0 flex-1">
          <span className={cn("text-sm block truncate", h.checked ? "text-zinc-400 line-through" : "text-zinc-800")}>
            {h.name}
          </span>
          {h.level === "minimum" && h.minimumVersion && (
            <span className="text-[10px] text-amber-600 truncate block">最小 · {h.minimumVersion}</span>
          )}
        </span>
        {h.startTime && <span className="text-[10px] tabular-nums text-zinc-400 shrink-0">{h.startTime}</span>}
      </button>
      {editable && h.minimumVersion && !h.checked && (
        <button
          type="button"
          onClick={() => onMinimum(h.id)}
          className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 shrink-0"
          title={h.minimumVersion}
        >
          最小
        </button>
      )}
    </div>
  );
}

export function DailyHabitGrid({
  habits,
  done,
  total,
  interactive,
  closed,
  isMustDo,
  onToggle,
  onMinimum,
  onToggleMustDo,
}: Props) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const now = currentSegment();
  const groups = groupHabitsBySegment(habits);
  const [expanded, setExpanded] = useState<Partial<Record<HabitSegmentKey, boolean>>>({});
  const editable = interactive && !closed;

  const isOpen = (key: HabitSegmentKey) => expanded[key] ?? (!interactive || key === now);

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 mb-1.5">
            <span className="text-xs font-medium text-zinc-500">
              今日进度 <span className="text-emerald-700 font-semibold">{done}/{total}</span>
            </span>
            <span className="text-[10px] text-zinc-400">{pct}%</span>
          </div>
          <ProgressBar value={pct} className="h-1.5" />
        </div>
      </div>

      {habits.length === 0 ? (
        <p className="text-sm text-zinc-500 py-6 text-center rounded-xl border border-dashed border-zinc-200">
          该日无习惯安排
        </p>
      ) : (
        <div className="space-y-1.5">
          {groups.map((group) => {
            const remaining = group.habits.length - group.done;
            const open = isOpen(group.key);
            const past =
              interactive &&
              group.key !== "anytime" &&
              SEGMENT_ORDER.indexOf(group.key) < SEGMENT_ORDER.indexOf(now);
            return (
              <div key={group.key}>
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => ({ ...prev, [group.key]: !open }))}
                  aria-expanded={open}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                    open ? "text-zinc-800" : "text-zinc-500 hover:bg-zinc-50"
                  )}
                >
                  {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  <span className="font-medium">{group.label}</span>
                  {interactive && group.key === now && (
                    <span className="rounded-full bg-indigo-50 px-1.5 py-px text-[10px] text-indigo-600">此刻</span>
                  )}
                  <span className="flex-1" />
                  {past && remaining > 0 && (
                    <span className="text-[10px] text-amber-600">还剩 {remaining}</span>
                  )}
                  <span className="tabular-nums text-[11px] text-zinc-400">
                    {group.done}/{group.habits.length}
                  </span>
                </button>
                {open && (
                  <div className="mt-1 mb-2 grid gap-1.5">
                    {group.habits.map((h) => (
                      <HabitRow
                        key={h.id}
                        habit={h}
                        editable={editable}
                        interactive={interactive}
                        mustDo={isMustDo(h.id)}
                        onToggle={onToggle}
                        onMinimum={onMinimum}
                        onToggleMustDo={onToggleMustDo}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
