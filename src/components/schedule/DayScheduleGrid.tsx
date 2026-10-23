"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { GripVertical, X } from "lucide-react";
import type { DayScheduleBlockDto } from "@/lib/day-schedule";

export type DayScheduleBlockItem = DayScheduleBlockDto;

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6);
const ROW_HEIGHT = 52;
const GRID_START_MIN = HOURS[0] * 60;
const GRID_END_MIN = (HOURS[HOURS.length - 1] + 1) * 60;
const GRID_HEIGHT = HOURS.length * ROW_HEIGHT;
const SNAP = 15;

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number) {
  const clamped = Math.max(GRID_START_MIN, Math.min(GRID_END_MIN, m));
  const h = Math.floor(clamped / 60);
  const min = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function snapMinutes(m: number) {
  return Math.round(m / SNAP) * SNAP;
}

function formatNowTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

type DragMode = "move" | "resize";

type DragState = {
  blockId: string;
  mode: DragMode;
  origStart: number;
  origEnd: number;
  startCursorMin: number;
};

type DayScheduleGridProps = {
  blocks: DayScheduleBlockItem[];
  showNowLine?: boolean;
  onBlockClick?: (block: DayScheduleBlockItem) => void;
  onSlotClick?: (startTime: string) => void;
  onBlockTimeChange?: (id: string, startTime: string, endTime: string) => void;
  onHabitSkip?: (block: DayScheduleBlockItem) => void;
  className?: string;
};

export function DayScheduleGrid({
  blocks,
  showNowLine = true,
  onBlockClick,
  onSlotClick,
  onBlockTimeChange,
  onHabitSkip,
  className,
}: DayScheduleGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const didDragRef = useRef(false);
  const dragPreviewRef = useRef<{ id: string; startTime: string; endTime: string } | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [dragPreview, setDragPreview] = useState<{ id: string; startTime: string; endTime: string } | null>(
    null
  );

  useEffect(() => {
    dragPreviewRef.current = dragPreview;
  }, [dragPreview]);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const showLine = showNowLine && nowMinutes >= GRID_START_MIN && nowMinutes < GRID_END_MIN;
  const nowTop = ((nowMinutes - GRID_START_MIN) / 60) * ROW_HEIGHT;

  const getDisplayTimes = (block: DayScheduleBlockItem) => {
    if (dragPreview?.id === block.id) {
      return { startTime: dragPreview.startTime, endTime: dragPreview.endTime };
    }
    return { startTime: block.startTime, endTime: block.endTime };
  };

  const yToMinutes = useCallback((clientY: number) => {
    const grid = gridRef.current;
    if (!grid) return GRID_START_MIN;
    const rect = grid.getBoundingClientRect();
    const relY = clientY - rect.top;
    return snapMinutes(GRID_START_MIN + (relY / ROW_HEIGHT) * 60);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const cursorMin = yToMinutes(e.clientY);

      if (drag.mode === "resize") {
        const newEnd = Math.max(drag.origStart + SNAP, Math.min(GRID_END_MIN, cursorMin));
        if (newEnd !== drag.origEnd) didDragRef.current = true;
        setDragPreview({
          id: drag.blockId,
          startTime: minutesToTime(drag.origStart),
          endTime: minutesToTime(newEnd),
        });
        return;
      }

      const moveDelta = cursorMin - drag.startCursorMin;
      if (Math.abs(moveDelta) >= SNAP / 2) didDragRef.current = true;
      let newStart = drag.origStart + moveDelta;
      let newEnd = drag.origEnd + moveDelta;
      if (newStart < GRID_START_MIN) {
        newEnd += GRID_START_MIN - newStart;
        newStart = GRID_START_MIN;
      }
      if (newEnd > GRID_END_MIN) {
        newStart -= newEnd - GRID_END_MIN;
        newEnd = GRID_END_MIN;
      }
      newStart = snapMinutes(newStart);
      newEnd = snapMinutes(Math.max(newStart + SNAP, newEnd));
      setDragPreview({
        id: drag.blockId,
        startTime: minutesToTime(newStart),
        endTime: minutesToTime(newEnd),
      });
    };

    const onUp = () => {
      const drag = dragRef.current;
      const preview = dragPreviewRef.current;
      if (drag && preview && preview.id === drag.blockId) {
        onBlockTimeChange?.(drag.blockId, preview.startTime, preview.endTime);
      }
      dragRef.current = null;
      setDragPreview(null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onBlockTimeChange, yToMinutes]);

  const startDrag = (e: React.MouseEvent, block: DayScheduleBlockItem, mode: DragMode) => {
    e.preventDefault();
    e.stopPropagation();
    const { startTime, endTime } = getDisplayTimes(block);
    dragRef.current = {
      blockId: block.id,
      mode,
      origStart: timeToMinutes(startTime),
      origEnd: timeToMinutes(endTime),
      startCursorMin: yToMinutes(e.clientY),
    };
    didDragRef.current = false;
  };

  const visibleBlocks = blocks.filter((b) => {
    const start = timeToMinutes(b.startTime);
    const end = timeToMinutes(b.endTime);
    return end > GRID_START_MIN && start < GRID_END_MIN;
  });

  return (
    <Card className={`overflow-x-auto ${className ?? ""}`}>
      <div className="min-w-[480px]">
        <div className="grid grid-cols-[64px_1fr] border-b border-zinc-200">
          <div className="p-3" />
          <div className="p-3 text-center text-sm font-medium text-zinc-700 border-l border-zinc-100">
            今日安排
            <span className="block text-[10px] font-normal text-zinc-400 mt-0.5">
            拖拽调整 · 习惯可「今日跳过」· 只影响今天
            </span>
          </div>
        </div>

        <div className="relative" ref={gridRef} style={{ height: GRID_HEIGHT }}>
          {showLine && (
            <>
              <div
                className="absolute z-30 pointer-events-none flex items-center"
                style={{ top: nowTop - 8, left: 0, width: 64 }}
              >
                <span className="ml-auto mr-1 text-[10px] font-mono font-medium text-red-500 bg-white/90 px-1 rounded">
                  {formatNowTime(now)}
                </span>
              </div>
              <div
                className="absolute z-30 pointer-events-none"
                style={{ top: nowTop, left: 64, right: 0 }}
              >
                <div className="relative border-t-2 border-red-500">
                  <span className="absolute -left-1 -top-[5px] h-2.5 w-2.5 rounded-full bg-red-500 shadow-sm" />
                </div>
              </div>
            </>
          )}

          {HOURS.map((hour, idx) => (
            <div
              key={hour}
              className="absolute left-0 right-0 grid grid-cols-[64px_1fr] border-b border-zinc-100"
              style={{ top: idx * ROW_HEIGHT, height: ROW_HEIGHT }}
            >
              <div className="p-2 text-xs text-zinc-400 font-mono text-right pr-3 pt-3">
                {String(hour).padStart(2, "0")}:00
              </div>
              <div
                className="border-l border-zinc-100 bg-white hover:bg-indigo-50/20 transition-colors"
                onClick={() => {
                  if (!onSlotClick || dragRef.current) return;
                  onSlotClick(`${String(hour).padStart(2, "0")}:00`);
                }}
              />
            </div>
          ))}

          <div
            className="absolute left-[64px] right-0 top-0 bottom-0 z-10"
            style={{ height: GRID_HEIGHT }}
          >
            {visibleBlocks.map((block) => {
              const { startTime, endTime } = getDisplayTimes(block);
              const startMin = timeToMinutes(startTime);
              const endMin = timeToMinutes(endTime);
              const top = ((startMin - GRID_START_MIN) / 60) * ROW_HEIGHT;
              const height = ((endMin - startMin) / 60) * ROW_HEIGHT - 4;
              const isDragging = dragPreview?.id === block.id;
              const isHabit = block.kind === "habit";

              return (
                <div
                  key={block.id}
                  className={`absolute left-2 right-2 rounded-lg px-2 py-1 text-xs overflow-hidden group cursor-grab active:cursor-grabbing ${
                    isDragging ? "ring-2 ring-indigo-400 shadow-md z-20" : "z-10"
                  } ${isHabit && !block.materialized ? "border border-dashed" : ""}`}
                  style={{
                    backgroundColor: `${block.color}${isHabit && !block.materialized ? "12" : "28"}`,
                    borderColor: isHabit && !block.materialized ? block.color : undefined,
                    borderLeft: `3px solid ${block.color}`,
                    top: `${Math.max(0, top)}px`,
                    height: `${Math.max(height, 28)}px`,
                  }}
                  onMouseDown={(e) => {
                    if ((e.target as HTMLElement).closest("[data-habit-skip]")) return;
                    startDrag(e, block, "move");
                  }}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("[data-habit-skip]")) return;
                    if (didDragRef.current) {
                      didDragRef.current = false;
                      return;
                    }
                    e.stopPropagation();
                    onBlockClick?.(block);
                  }}
                >
                  {isHabit && onHabitSkip && (
                    <button
                      type="button"
                      data-habit-skip
                      title="今日跳过"
                      className="absolute top-1 right-1 z-30 rounded-md p-0.5 text-zinc-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-opacity"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onHabitSkip(block);
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <div
                    className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100"
                    onMouseDown={(e) => startDrag(e, block, "resize")}
                  >
                    <div className="w-8 h-1 rounded-full bg-zinc-400/60" />
                  </div>
                  <div className="flex items-start gap-1">
                    <GripVertical className="h-3 w-3 text-zinc-400 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-zinc-800 truncate">{block.title}</p>
                        {isHabit && (
                          <span className="shrink-0 text-[9px] px-1 py-0.5 rounded bg-white/70 text-zinc-500">
                            习惯
                          </span>
                        )}
                      </div>
                      <p className="text-zinc-500 font-mono text-[10px]">
                        {startTime}–{endTime}
                      </p>
                      {block.habit?.name && block.title !== block.habit.name && (
                        <p className="text-zinc-400 truncate mt-0.5 text-[10px]">{block.habit.name}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

export { timeToMinutes, minutesToTime, HOURS as DAY_SCHEDULE_HOURS };
