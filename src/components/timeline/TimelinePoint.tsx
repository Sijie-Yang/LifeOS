"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { cn, formatDate } from "@/lib/utils";
import {
  SOURCE_LABELS,
  type TimelineItem,
  type TimelineSource,
} from "@/lib/timeline";
import type { TimelineEditTarget } from "@/components/timeline/TimelineEntityEditor";

const STATUS_LABEL: Record<TimelineItem["status"], string> = {
  done: "已完成",
  overdue: "逾期",
  upcoming: "未到",
};

function PointShape({
  source,
  status,
  color,
  stacked,
}: {
  source: TimelineSource;
  status: TimelineItem["status"];
  color: string;
  stacked?: boolean;
}) {
  const tone =
    status === "done" ? "#10b981" : status === "overdue" ? "#e11d48" : color;
  const shape =
    source === "milestone"
      ? "rotate-45 rounded-[2px]"
      : source === "opportunity"
        ? "rounded-sm"
        : source === "meeting"
          ? "rounded-[3px]"
        : source === "foresight-vision" || source === "goal"
          ? "rounded-[3px]"
          : "rounded-full";

  return (
    <span
      className={cn(
        "block h-2.5 w-2.5 border-2 bg-white shadow-sm",
        shape,
        stacked && "ring-2 ring-white"
      )}
      style={{ borderColor: tone, backgroundColor: status === "done" ? tone : "white" }}
    />
  );
}

function FloatingCard({
  anchor,
  children,
}: {
  anchor: DOMRect;
  children: React.ReactNode;
}) {
  const gap = 8;
  const width = 288;
  const left = Math.min(
    Math.max(anchor.left + anchor.width / 2, 16 + width / 2),
    window.innerWidth - 16 - width / 2
  );
  const placeBelow = anchor.top < 180;
  return (
    <div
      className="fixed z-[80] w-72 rounded-xl border border-zinc-200 bg-white p-3 text-left shadow-lg"
      onClick={(event) => event.stopPropagation()}
      style={{
        left,
        width,
        transform: "translateX(-50%)",
        top: placeBelow ? anchor.bottom + gap : undefined,
        bottom: placeBelow ? undefined : window.innerHeight - anchor.top + gap,
      }}
    >
      {children}
    </div>
  );
}

export function TimelinePointCluster({
  date,
  items,
  left,
  open,
  onToggle,
  onClose,
  onRefresh,
  onEdit,
}: {
  date: string;
  items: TimelineItem[];
  left: number;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onRefresh?: () => void | Promise<void>;
  onEdit?: (target: TimelineEditTarget) => void;
}) {
  const lead = items[0]!;
  const overflow = items.length > 1;
  const anchorRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const visible = open || hovered;

  useLayoutEffect(() => {
    if (!visible) return;
    const node = anchorRef.current;
    if (!node) return;
    const update = () => setRect(node.getBoundingClientRect());
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [visible, date, items.length]);

  return (
    <div
      ref={anchorRef}
      className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${left}%` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className="relative flex h-6 w-6 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        aria-expanded={open}
        aria-label={`${formatDate(date)} · ${items.map((i) => i.title).join("、")}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        <PointShape source={lead.source} status={lead.status} color={lead.color} stacked={overflow} />
        {overflow && (
          <span className="absolute -right-1 -top-1 min-w-3 rounded-full bg-zinc-800 px-1 text-[9px] leading-3 text-white">
            {items.length}
          </span>
        )}
      </button>
      {visible &&
        rect &&
        typeof document !== "undefined" &&
        createPortal(
          <FloatingCard anchor={rect}>
            <PointDetails
              date={date}
              items={items}
              interactive={open}
              onClose={onClose}
              onRefresh={onRefresh}
              onEdit={onEdit}
            />
          </FloatingCard>,
          document.body
        )}
    </div>
  );
}

function PointDetails({
  date,
  items,
  interactive,
  onClose,
  onRefresh,
  onEdit,
}: {
  date: string;
  items: TimelineItem[];
  interactive: boolean;
  onClose: () => void;
  onRefresh?: () => void | Promise<void>;
  onEdit?: (target: TimelineEditTarget) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actionable = items.filter(
    (item) =>
      item.source === "plan-step" ||
      item.source === "milestone" ||
      item.source === "meeting"
  );
  const inlineEditable = new Set<TimelineSource>([
    "project",
    "goal",
    "opportunity",
    "meeting",
    "strategy-phase",
    "foresight-era",
    "foresight-vision",
    "foresight-prediction",
  ]);

  const toggleDone = async (item: TimelineItem) => {
    setBusy(true);
    setError(null);
    try {
      const endpoint =
        item.source === "plan-step"
          ? `/api/plan-steps/${item.sourceId}`
          : item.source === "milestone"
            ? `/api/milestones/${item.sourceId}`
            : `/api/meetings/${item.sourceId}`;
      const body =
        item.source === "plan-step"
          ? { done: item.status !== "done" }
          : item.source === "milestone"
            ? { completed: item.status !== "done" }
            : { status: item.status === "done" ? "Scheduled" : "Completed" };
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("更新失败");
      onClose();
      await onRefresh?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "更新失败");
    } finally {
      setBusy(false);
    }
  };

  const postponeAll = async () => {
    if (!window.confirm(`确定将 ${date} 及之后的所有未完成项目步骤整体顺延一天？`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/timeline/postpone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromDate: date, days: 1 }),
      });
      if (!response.ok) throw new Error("顺延失败");
      onClose();
      await onRefresh?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "顺延失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="text-[11px] font-medium text-zinc-400">{formatDate(date)}</p>
      <ul className="mt-1.5 space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <p className="flex items-center gap-1.5 text-[10px] text-zinc-400">
              <span>{SOURCE_LABELS[item.source]}</span>
              <span>· {STATUS_LABEL[item.status]}</span>
              {item.computed && <span>· 推算日期</span>}
            </p>
            {interactive && inlineEditable.has(item.source) ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit?.(item);
                }}
                className="mt-0.5 block text-left text-sm font-medium text-zinc-900 hover:text-indigo-600"
              >
                {item.title} · 编辑
              </button>
            ) : interactive ? (
              <Link
                href={item.href}
                className="mt-0.5 block text-sm font-medium text-zinc-900 hover:text-indigo-600"
              >
                {item.title}
              </Link>
            ) : (
              <p className="mt-0.5 text-sm font-medium text-zinc-900">{item.title}</p>
            )}
            {item.detail && (
              <p className="mt-0.5 line-clamp-3 text-[11px] leading-relaxed text-zinc-500">
                {item.detail}
              </p>
            )}
            {interactive && actionable.includes(item) && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void toggleDone(item)}
                className="mt-1.5 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
              >
                {item.status === "done" ? "取消完成" : "标记完成"}
              </button>
            )}
          </li>
        ))}
      </ul>
      {interactive && items.some((item) => item.source === "plan-step" && item.status !== "done") && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void postponeAll()}
          className="mt-3 w-full rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
        >
          从该日开始整体顺延一天
        </button>
      )}
      {error && <p className="mt-2 text-[11px] text-rose-600">{error}</p>}
    </>
  );
}
