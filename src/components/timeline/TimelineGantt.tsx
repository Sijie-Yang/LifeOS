"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { CheckCircle2, GripVertical } from "lucide-react";
import { invalidateFetchCache } from "@/components/ui/PageState";
import { DateNav } from "@/components/ui/DateNav";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  LAYER_LABELS,
  LAYER_ORDER,
  SOURCE_LABELS,
  clipBar,
  clusterPointsForScale,
  columnWidth,
  dateToPercent,
  moveRow,
  rangeToPercent,
  showsStepPoints,
  type TimelineItem,
  type TimelineLayer,
  type TimelinePayload,
  type TimelineRow,
  type TimelineScale,
} from "@/lib/timeline";
import { TimelinePointCluster } from "@/components/timeline/TimelinePoint";
import {
  TimelineEntityEditor,
  type TimelineEditTarget,
} from "@/components/timeline/TimelineEntityEditor";

type LayerFilter = "all" | TimelineLayer;

const LAYER_TABS: Array<{ key: LayerFilter; label: string }> = [
  { key: "all", label: "全部" },
  { key: "vision", label: "愿景" },
  { key: "goal", label: "目标" },
  { key: "project", label: "项目" },
  { key: "event", label: "机会 / 会议" },
];

function windowLabel(scale: TimelineScale, start: string, end: string) {
  if (scale === "decade") {
    return `${start.slice(0, 4)} – ${end.slice(0, 4)}`;
  }
  if (scale === "year") {
    return format(parseISO(`${start}T12:00:00`), "yyyy年", { locale: zhCN });
  }
  return format(parseISO(`${start}T12:00:00`), "yyyy年M月", { locale: zhCN });
}

function columnCaption(scale: TimelineScale, start: string, label: string) {
  if (scale !== "month") return label;
  return format(parseISO(`${start}T12:00:00`), "EEEEE", { locale: zhCN }) + "\n" + label;
}

function weekendDay(date: string) {
  const day = parseISO(`${date}T12:00:00`).getDay();
  return day === 6 ? "saturday" : day === 0 ? "sunday" : null;
}

function gridBackground(colW: number): CSSProperties {
  return {
    backgroundImage: "linear-gradient(to right, rgb(250 250 250) 1px, transparent 1px)",
    backgroundSize: `${colW}px 100%`,
  };
}

export function timelineBarBackground(start: string, end: string, today: string, color: string) {
  if (end < today) return "#a1a1aa";
  if (start > today) return color;

  const split = dateToPercent(today, start, end) ?? 0;
  return `linear-gradient(to right, #a1a1aa 0%, #a1a1aa ${split}%, ${color} ${split}%, ${color} 100%)`;
}

export function TimelineGantt({
  data,
  scale,
  windowStart,
  windowEnd,
  onShift,
  onToday,
  onRefresh,
}: {
  data: TimelinePayload;
  scale?: TimelineScale;
  windowStart?: string;
  windowEnd?: string;
  onShift: (delta: number) => void;
  onToday: () => void;
  onRefresh?: () => void | Promise<void>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [editingTarget, setEditingTarget] = useState<TimelineEditTarget | null>(null);
  const [layerFilter, setLayerFilter] = useState<LayerFilter>(
    (scale ?? data.scale) === "month" ? "project" : "all"
  );
  const viewScale = scale ?? data.scale;
  const viewStart = windowStart ?? data.start;
  const viewEnd = windowEnd ?? data.end;
  const colW = columnWidth(data.scale);
  const trackWidth = Math.max(data.columns.length * colW, 320);
  const todayLeft = dateToPercent(data.today, data.start, data.end);

  const [localRows, setLocalRows] = useState<{ source: TimelineRow[]; rows: TimelineRow[] } | null>(null);
  const rows = localRows && localRows.source === data.rows ? localRows.rows : data.rows;
  const [dragging, setDragging] = useState<TimelineRow | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  const canDrop = useCallback(
    (target: TimelineRow) =>
      Boolean(dragging) &&
      target.id !== dragging!.id &&
      target.layer === dragging!.layer &&
      (target.layer !== "project" || Boolean(target.pinned) === Boolean(dragging!.pinned)),
    [dragging]
  );

  const endDrag = useCallback(() => {
    setDragging(null);
    setDropId(null);
  }, []);

  const dropRow = useCallback(
    async (target: TimelineRow) => {
      const source = dragging;
      endDrag();
      if (!source || !canDrop(target)) return;
      const layerRows = moveRow(
        rows.filter((row) => row.layer === target.layer),
        source.id,
        target.id
      );
      let cursor = 0;
      const next = rows.map((row) => (row.layer === target.layer ? layerRows[cursor++]! : row));
      setLocalRows({ source: data.rows, rows: next });
      setOrderError(null);

      const res =
        target.layer === "project"
          ? await fetch("/api/projects/reorder", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderedIds: layerRows.map((row) => row.id.slice("project:".length)) }),
            })
          : await fetch("/api/timeline/row-order", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ layer: target.layer, rowIds: layerRows.map((row) => row.id) }),
            });
      if (!res.ok) {
        setLocalRows(null);
        setOrderError("排序没保存上，已恢复原顺序");
        return;
      }
      invalidateFetchCache("/api/timeline");
      if (target.layer === "project") invalidateFetchCache("/api/projects");
    },
    [canDrop, data.rows, dragging, endDrag, rows]
  );

  const itemsByRow = useMemo(() => {
    const map = new Map<string, TimelineItem[]>();
    for (const item of data.items) {
      const list = map.get(item.rowId) ?? [];
      list.push(item);
      map.set(item.rowId, list);
    }
    return map;
  }, [data.items]);

  const groupedRows = useMemo(
    () =>
      LAYER_ORDER.map((layer) => ({
        layer,
        rows: rows.filter(
          (row) => row.layer === layer && (layerFilter === "all" || row.layer === layerFilter)
        ),
      })).filter((group) => group.rows.length > 0),
    [rows, layerFilter]
  );
  const visibleRowCount = groupedRows.reduce((sum, group) => sum + group.rows.length, 0);
  const visibleItemCount =
    layerFilter === "all"
      ? data.items.length
      : data.items.filter((item) => item.layer === layerFilter).length;
  const visiblePending = (data.pendingReview ?? []).filter((item) => {
    if (layerFilter === "all") return true;
    if (item.kind === "project") return layerFilter === "project";
    return layerFilter === "event";
  });
  const layerTabs = LAYER_TABS.map((tab) => ({
    ...tab,
    count:
      tab.key === "all"
        ? data.rows.length
        : data.rows.filter((row) => row.layer === tab.key).length,
  })).filter((tab) => tab.key === "all" || tab.count > 0);

  const onToggleCluster = useCallback((rowId: string, date: string) => {
    setOpenKey((cur) => {
      const key = `${rowId}:${date}`;
      return cur === key ? null : key;
    });
  }, []);

  const onCloseCluster = useCallback((rowId: string, date: string) => {
    setOpenKey((cur) => (cur === `${rowId}:${date}` ? null : cur));
  }, []);

  const editRow = useCallback(
    (row: TimelinePayload["rows"][number]) => {
      const rowItems = itemsByRow.get(row.id) ?? [];
      const sourceFromRow =
        row.id.startsWith("project:")
          ? "project"
          : row.id.startsWith("opportunity:")
            ? "opportunity"
            : row.id.startsWith("meeting:")
              ? "meeting"
              : row.id.startsWith("goal:")
                ? "goal"
                : row.id.startsWith("strategy:")
                  ? "strategy-phase"
                  : null;
      const preferred = sourceFromRow
        ? rowItems.find((item) => item.source === sourceFromRow)
        : rowItems.find((item) => item.source === "foresight-vision") ?? rowItems[0];
      if (preferred) {
        setEditingTarget(preferred);
        return;
      }
      if (sourceFromRow) {
        setEditingTarget({
          source: sourceFromRow,
          sourceId: row.id.slice(row.id.indexOf(":") + 1),
          title: row.title,
          href: row.href ?? "/projects",
        });
      }
    },
    [itemsByRow]
  );

  useEffect(() => {
    const line = scrollRef.current?.querySelector("[data-today-line]");
    if (line) {
      line.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    }
  }, [data.scale, data.start, data.end]);

  return (
    <div onClick={() => setOpenKey(null)}>
      <DateNav
        label={windowLabel(viewScale, viewStart, viewEnd)}
        subtitle={`${visibleItemCount} 条 · ${visibleRowCount} 行 · 习惯在今日`}
        prevLabel={viewScale === "month" ? "上一月" : viewScale === "year" ? "上一年" : "上十年"}
        nextLabel={viewScale === "month" ? "下一月" : viewScale === "year" ? "下一年" : "下十年"}
        onPrev={() => onShift(-1)}
        onNext={() => onShift(1)}
        trailing={
          <Button variant="secondary" size="sm" onClick={onToday}>
            回到今天
          </Button>
        }
      />

      <FilterTabs
        tabs={layerTabs}
        value={layerFilter}
        onChange={(key) => {
          setLayerFilter(key as LayerFilter);
          setOpenKey(null);
        }}
        size="sm"
        shape="pill"
        className="mb-3"
      />

      <div className="mb-3 flex flex-wrap gap-3 text-[11px] text-zinc-500">
        {viewScale !== "month" && (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2 w-6 rounded-full"
              style={{ background: "linear-gradient(to right, #a1a1aa 0 50%, #6366f1 50% 100%)" }}
            />{" "}
            区间（过去 / 未来）
          </span>
        )}
        {showsStepPoints(viewScale) && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-indigo-500 bg-white" /> 步骤
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rotate-45 rounded-[2px] border-2 border-violet-500 bg-white" /> 里程碑
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border-2 border-amber-500 bg-white" /> 机会
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] border-2 border-sky-500 bg-white" /> 会议
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> 已完成
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-rose-500 bg-white" /> 逾期
        </span>
      </div>

      <TodayPointTasks data={data} layerFilter={layerFilter} onRefresh={onRefresh} />

      {!showsStepPoints(viewScale) && (
        <p className="mb-3 text-xs text-zinc-400">十年视图已隐藏项目步骤，避免点过密。切到月或年可看步骤。</p>
      )}
      {(layerFilter === "all" || layerFilter === "project") && data.undatedProjectCount > 0 && (
        <p className="mb-3 text-xs text-zinc-400">
          {data.undatedProjectCount} 个项目没有起止日期，已显示为「未排期」。
        </p>
      )}
      {visiblePending.length > 0 && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2">
          <p className="text-[11px] font-medium text-amber-800">待确认 / 未排期</p>
          <ul className="mt-1 space-y-1">
            {visiblePending.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() =>
                    setEditingTarget({
                      source:
                        item.kind === "meeting"
                          ? "meeting"
                          : item.kind === "opportunity"
                            ? "opportunity"
                            : "project",
                      sourceId: item.id.slice(item.id.indexOf(":") + 1),
                      title: item.title,
                      detail: item.detail,
                      href: item.href,
                    })
                  }
                  className="text-left text-xs text-amber-900 hover:underline"
                >
                  {item.kind === "meeting" ? "会议" : item.kind === "opportunity" ? "机会" : "项目"}
                  {" · "}
                  {item.title}
                  {item.detail ? ` · ${item.detail}` : ""}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {orderError && <p className="mb-2 text-xs text-rose-600">{orderError}</p>}
      {visibleRowCount === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-200 bg-white px-4 py-12 text-center text-sm text-zinc-500">
          这个窗口里还没有可画的项目、目标或愿景。
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <div className="flex min-w-0">
            <div className="w-[132px] shrink-0 border-r border-zinc-100 sm:w-[180px]">
              <div className="h-11 border-b border-zinc-100" />
              {groupedRows.map((group) => (
                <LayerLabels
                  key={group.layer}
                  layer={group.layer}
                  rows={group.rows}
                  onEdit={editRow}
                  draggingId={dragging?.id ?? null}
                  dropId={dropId}
                  canDrop={canDrop}
                  onDragStart={setDragging}
                  onDragOver={setDropId}
                  onDrop={dropRow}
                  onDragEnd={endDrag}
                />
              ))}
            </div>
            <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto">
              <div className="relative" style={{ width: trackWidth }}>
                <div
                  className="grid h-11 border-b border-zinc-100 text-center text-[10px] leading-tight text-zinc-400"
                  style={{ gridTemplateColumns: `repeat(${data.columns.length}, ${colW}px)` }}
                >
                  {data.columns.map((col) => (
                    <div
                      key={col.key}
                      className={cn(
                        "flex items-center justify-center border-l border-zinc-50 px-1 whitespace-pre-line",
                        data.scale === "month" &&
                          weekendDay(col.start) === "saturday" &&
                          "bg-sky-50 text-sky-700",
                        data.scale === "month" &&
                          weekendDay(col.start) === "sunday" &&
                          "bg-rose-50 text-rose-700",
                        col.start <= data.today && col.end >= data.today && "bg-indigo-50 text-indigo-600"
                      )}
                    >
                      {columnCaption(data.scale, col.start, col.label)}
                    </div>
                  ))}
                </div>

                {data.scale === "month" &&
                  data.columns.map((col, index) => {
                    const weekend = weekendDay(col.start);
                    if (!weekend) return null;
                    return (
                      <div
                        key={`weekend:${col.key}`}
                        aria-hidden
                        className={cn(
                          "pointer-events-none absolute bottom-0 top-11 z-0",
                          weekend === "saturday" ? "bg-sky-50/55" : "bg-rose-50/55"
                        )}
                        style={{ left: index * colW, width: colW }}
                      />
                    );
                  })}

                {todayLeft != null && (
                  <div
                    data-today-line
                    className="pointer-events-none absolute bottom-0 top-11 z-20 w-px bg-indigo-500"
                    style={{ left: `${todayLeft}%` }}
                  />
                )}

                {groupedRows.map((group) => (
                  <div key={group.layer} className="relative z-10">
                    <div className="h-7 border-b border-zinc-50 bg-zinc-50/80" />
                    {group.rows.map((row) => (
                      <TimelineRowTrack
                        key={row.id}
                        rowId={row.id}
                        items={itemsByRow.get(row.id) ?? EMPTY_ITEMS}
                        scale={data.scale}
                        start={data.start}
                        end={data.end}
                        today={data.today}
                        colW={colW}
                        openDate={openKey?.startsWith(`${row.id}:`) ? openKey.slice(row.id.length + 1) : null}
                        onToggle={onToggleCluster}
                        onClose={onCloseCluster}
                        onRefresh={onRefresh}
                        onEdit={setEditingTarget}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      <TimelineEntityEditor
        target={editingTarget}
        onClose={() => setEditingTarget(null)}
        onSaved={async () => {
          await onRefresh?.();
        }}
      />
    </div>
  );
}

const EMPTY_ITEMS: TimelineItem[] = [];

function TodayPointTasks({
  data,
  layerFilter,
  onRefresh,
}: {
  data: TimelinePayload;
  layerFilter: LayerFilter;
  onRefresh?: () => void | Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tasks = data.items.filter(
    (item) =>
      item.kind === "point" &&
      item.start === data.today &&
      item.status !== "done" &&
      (layerFilter === "all" || item.layer === layerFilter) &&
      (item.source === "plan-step" ||
        item.source === "milestone" ||
        item.source === "meeting")
  );

  if (tasks.length === 0) return null;

  const complete = async (item: TimelineItem) => {
    setBusyId(item.id);
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
          ? { done: true }
          : item.source === "milestone"
            ? { completed: true }
            : { status: "Completed" };
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("完成任务失败");
      await onRefresh?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "完成任务失败");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-emerald-900">今天优先完成</p>
        <span className="text-[10px] text-emerald-700">{tasks.length} 项</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {tasks.map((item) => (
          <button
            type="button"
            key={item.id}
            disabled={busyId !== null}
            onClick={() => void complete(item)}
            className="group flex items-start gap-2 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-50"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 group-hover:text-emerald-700" />
            <span className="min-w-0">
              <span className="block text-[10px] text-emerald-700">
                {SOURCE_LABELS[item.source]}
              </span>
              <span className="block text-xs font-medium text-zinc-800">
                {busyId === item.id ? "正在完成…" : item.title}
              </span>
              {item.detail && (
                <span className="mt-0.5 block truncate text-[10px] text-zinc-500">
                  {item.detail}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-[11px] text-rose-600">{error}</p>}
    </section>
  );
}

const TimelineRowTrack = memo(function TimelineRowTrack({
  rowId,
  items,
  scale,
  start,
  end,
  today,
  colW,
  openDate,
  onToggle,
  onClose,
  onRefresh,
  onEdit,
}: {
  rowId: string;
  items: TimelineItem[];
  scale: TimelineScale;
  start: string;
  end: string;
  today: string;
  colW: number;
  openDate: string | null;
  onToggle: (rowId: string, date: string) => void;
  onClose: (rowId: string, date: string) => void;
  onRefresh?: () => void | Promise<void>;
  onEdit: (target: TimelineEditTarget) => void;
}) {
  const bars = useMemo(() => items.filter((item) => item.kind === "bar"), [items]);
  const clusters = useMemo(
    () => clusterPointsForScale(items.filter((item) => item.kind === "point"), scale),
    [items, scale]
  );

  return (
    <div
      className="relative h-11 overflow-visible border-b border-zinc-50"
      style={gridBackground(colW)}
    >
      {scale !== "month" && bars.map((bar) => {
        const barEnd = bar.end ?? bar.start;
        const visibleBar = clipBar(bar.start, barEnd, start, end);
        if (!visibleBar) return null;
        const box = rangeToPercent(bar.start, barEnd, start, end);
        if (!box) return null;
        const muted = bar.status === "done";
        return (
          <button
            type="button"
            key={bar.id}
            title={`${bar.title} · ${SOURCE_LABELS[bar.source]}`}
            className="absolute top-3 h-5 truncate rounded-full px-2 text-left text-[10px] font-medium leading-5 text-white shadow-sm"
            style={{
              left: `${box.left}%`,
              width: `${Math.max(box.width, 1.4)}%`,
              background: timelineBarBackground(
                visibleBar.start,
                visibleBar.end,
                today,
                bar.color
              ),
              opacity: muted ? 0.45 : 0.88,
            }}
            onClick={(event) => {
              event.stopPropagation();
              onEdit(bar);
            }}
          >
            {bar.title}
          </button>
        );
      })}
      {clusters.map((cluster) => {
        const left = dateToPercent(cluster.date, start, end);
        if (left == null) return null;
        return (
          <TimelinePointCluster
            key={`${rowId}:${cluster.date}`}
            date={cluster.date}
            items={cluster.items}
            left={left}
            open={openDate === cluster.date}
            onToggle={() => onToggle(rowId, cluster.date)}
            onClose={() => onClose(rowId, cluster.date)}
            onRefresh={onRefresh}
            onEdit={onEdit}
          />
        );
      })}
    </div>
  );
});

const LayerLabels = memo(function LayerLabels({
  layer,
  rows,
  onEdit,
  draggingId,
  dropId,
  canDrop,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  layer: TimelineLayer;
  rows: TimelineRow[];
  onEdit: (row: TimelineRow) => void;
  draggingId: string | null;
  dropId: string | null;
  canDrop: (row: TimelineRow) => boolean;
  onDragStart: (row: TimelineRow) => void;
  onDragOver: (id: string | null) => void;
  onDrop: (row: TimelineRow) => void;
  onDragEnd: () => void;
}) {
  return (
    <>
      <div className="flex h-7 items-center bg-zinc-50 px-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
        {LAYER_LABELS[layer]}
      </div>
      {rows.map((row) => (
        <div
          key={row.id}
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", row.id);
            onDragStart(row);
          }}
          onDragOver={(event) => {
            if (!canDrop(row)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            if (dropId !== row.id) onDragOver(row.id);
          }}
          onDragLeave={() => {
            if (dropId === row.id) onDragOver(null);
          }}
          onDrop={(event) => {
            event.preventDefault();
            onDrop(row);
          }}
          onDragEnd={onDragEnd}
          title="拖动调整上下顺序"
          className={cn(
            "group flex h-11 cursor-grab items-center gap-1 border-b border-zinc-50 pl-1 pr-3 active:cursor-grabbing",
            draggingId === row.id && "opacity-40",
            dropId === row.id && "bg-indigo-50 shadow-[inset_0_2px_0_0_rgb(99_102_241)]"
          )}
        >
          <GripVertical className="h-3.5 w-3.5 shrink-0 text-zinc-300 opacity-0 group-hover:opacity-100" />
          <button
            type="button"
            onClick={() => onEdit(row)}
            className="min-w-0 text-left hover:text-indigo-600"
          >
            <p className="truncate text-xs font-medium text-zinc-800">{row.title}</p>
            {row.subtitle && <p className="truncate text-[10px] text-zinc-400">{row.subtitle}</p>}
          </button>
        </div>
      ))}
    </>
  );
});
