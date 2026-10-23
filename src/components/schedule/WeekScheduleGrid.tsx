"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { WEEKDAY_LABELS } from "@/lib/utils";

export type ScheduleBlockItem = {
  id: string;
  title: string;
  description?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  color: string;
  habitId?: string | null;
  goalId?: string | null;
  habit?: { id: string; name: string } | null;
  goal?: { id: string; title: string } | null;
};

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6);
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const ROW_HEIGHT = 52;

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatNowTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

type WeekScheduleGridProps = {
  blocks: ScheduleBlockItem[];
  onBlockClick?: (block: ScheduleBlockItem) => void;
  onAddClick?: (day: number) => void;
  minWidth?: number;
  className?: string;
};

export function WeekScheduleGrid({
  blocks,
  onBlockClick,
  onAddClick,
  minWidth = 900,
  className,
}: WeekScheduleGridProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const todayDow = now.getDay();
  const todayColIdx = DAY_ORDER.indexOf(todayDow);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const gridStartMin = HOURS[0] * 60;
  const gridEndMin = (HOURS[HOURS.length - 1] + 1) * 60;
  const showNowLine = todayColIdx >= 0 && nowMinutes >= gridStartMin && nowMinutes < gridEndMin;
  const nowTop = ((nowMinutes - gridStartMin) / 60) * ROW_HEIGHT;

  const getBlocksForCell = (day: number, hour: number) =>
    blocks.filter((b) => {
      if (b.dayOfWeek !== day) return false;
      const start = timeToMinutes(b.startTime);
      const end = timeToMinutes(b.endTime);
      const cellStart = hour * 60;
      const cellEnd = (hour + 1) * 60;
      return start < cellEnd && end > cellStart;
    });

  return (
    <Card className={`overflow-x-auto ${className ?? ""}`}>
      <div style={{ minWidth }}>
        <div className="grid grid-cols-8 border-b border-zinc-200">
          <div className="p-3 text-xs text-zinc-500" />
          {DAY_ORDER.map((day) => {
            const isToday = day === todayDow;
            return (
            <div
              key={day}
              className={`p-3 text-center text-sm font-medium border-l border-zinc-100 ${
                isToday ? "bg-indigo-50 text-indigo-700" : "text-zinc-700"
              }`}
            >
              {WEEKDAY_LABELS[day === 0 ? 6 : day - 1]}
              {isToday && (
                <span className="block text-[10px] font-normal text-indigo-500 mt-0.5">今天</span>
              )}
              {onAddClick && (
                <button
                  type="button"
                  onClick={() => onAddClick(day)}
                  className="block mx-auto mt-1 text-xs text-indigo-600 hover:underline"
                >
                  + 添加
                </button>
              )}
            </div>
            );
          })}
        </div>

        <div className="relative">
        {showNowLine && (
          <>
            <div
              className="absolute z-20 pointer-events-none flex items-center"
              style={{ top: nowTop - 8, left: 0, width: `${100 / 8}%` }}
            >
              <span className="ml-auto mr-1 text-[10px] font-mono font-medium text-red-500 bg-white/90 px-1 rounded">
                {formatNowTime(now)}
              </span>
            </div>
            <div
              className="absolute z-20 pointer-events-none"
              style={{
                top: nowTop,
                left: `${((todayColIdx + 1) / 8) * 100}%`,
                width: `${100 / 8}%`,
              }}
            >
              <div className="relative border-t-2 border-red-500">
                <span className="absolute -left-1 -top-[5px] h-2.5 w-2.5 rounded-full bg-red-500 shadow-sm" />
              </div>
            </div>
          </>
        )}

        {HOURS.map((hour) => (
          <div key={hour} className="grid grid-cols-8 border-b border-zinc-100 min-h-[52px]">
            <div className="p-2 text-xs text-zinc-400 font-mono text-right pr-3 pt-3">
              {String(hour).padStart(2, "0")}:00
            </div>
            {DAY_ORDER.map((day) => {
              const cellBlocks = getBlocksForCell(day, hour);
              const isToday = day === todayDow;
              return (
                <div
                  key={day}
                  className={`border-l border-zinc-100 p-1 relative ${
                    isToday ? "bg-indigo-50/30" : ""
                  }`}
                >
                  {cellBlocks.map((block) => {
                    const startMin = timeToMinutes(block.startTime);
                    const isStart = Math.floor(startMin / 60) === hour;
                    if (!isStart) return null;
                    const duration = (timeToMinutes(block.endTime) - startMin) / 60;
                    return (
                      <div
                        key={block.id}
                        role={onBlockClick ? "button" : undefined}
                        tabIndex={onBlockClick ? 0 : undefined}
                        onClick={onBlockClick ? () => onBlockClick(block) : undefined}
                        onKeyDown={
                          onBlockClick
                            ? (e) => {
                                if (e.key === "Enter" || e.key === " ") onBlockClick(block);
                              }
                            : undefined
                        }
                        className={`absolute left-1 right-1 rounded-lg px-2 py-1 text-xs z-10 overflow-hidden ${
                          onBlockClick ? "cursor-pointer hover:brightness-110 transition-all" : ""
                        }`}
                        style={{
                          backgroundColor: `${block.color}18`,
                          borderLeft: `3px solid ${block.color}`,
                          top: `${((startMin % 60) / 60) * 100}%`,
                          height: `${duration * ROW_HEIGHT - 4}px`,
                        }}
                      >
                        <p className="font-medium text-zinc-800 truncate">{block.title}</p>
                        <p className="text-zinc-500 font-mono">
                          {block.startTime}-{block.endTime}
                        </p>
                        {block.habit?.name && (
                          <p className="text-zinc-400 truncate mt-0.5">{block.habit.name}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
        </div>
      </div>
    </Card>
  );
}
