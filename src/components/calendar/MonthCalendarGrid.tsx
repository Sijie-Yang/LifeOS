"use client";

import { cn } from "@/lib/utils";
import { buildMonthGrid } from "@/lib/project-plan";

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

export type MonthCalendarCell = {
  date: string;
  inMonth: boolean;
};

export type MonthCalendarGridProps = {
  month: string;
  today: string;
  renderCell: (cell: MonthCalendarCell) => React.ReactNode;
  getCellClassName?: (cell: MonthCalendarCell) => string | undefined;
  onCellClick?: (cell: MonthCalendarCell) => void;
  className?: string;
};

export function MonthCalendarGrid({
  month,
  today,
  renderCell,
  getCellClassName,
  onCellClick,
  className,
}: MonthCalendarGridProps) {
  const rows = buildMonthGrid(month);

  return (
    <div className={cn("flex flex-col min-h-0", className)}>
      <div className="grid grid-cols-7 gap-px bg-zinc-200 rounded-t-xl overflow-hidden border border-zinc-200 border-b-0">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="bg-zinc-50 px-2 py-2 text-center text-[11px] font-semibold text-zinc-500"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-zinc-200 rounded-b-xl overflow-hidden border border-zinc-200">
        {rows.flatMap((week, wi) =>
          week.map((cell, di) => {
            if (!cell) {
              return (
                <div
                  key={`empty-${wi}-${di}`}
                  className="bg-zinc-50/50 min-h-[100px]"
                />
              );
            }

            const isToday = cell.date === today;

            return (
              <div
                key={cell.date}
                role={onCellClick ? "button" : undefined}
                tabIndex={onCellClick ? 0 : undefined}
                onClick={onCellClick ? () => onCellClick(cell) : undefined}
                onKeyDown={
                  onCellClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onCellClick(cell);
                        }
                      }
                    : undefined
                }
                className={cn(
                  "bg-white min-h-[100px] p-1.5 flex flex-col min-w-0 transition-colors",
                  !cell.inMonth && "bg-zinc-50/80 opacity-60",
                  isToday && "ring-2 ring-inset ring-indigo-400",
                  onCellClick && "cursor-pointer hover:bg-indigo-50/30",
                  getCellClassName?.(cell)
                )}
              >
                <div className="flex items-center justify-between gap-1 mb-1 shrink-0">
                  <span
                    className={cn(
                      "text-xs font-medium tabular-nums",
                      isToday ? "text-indigo-700" : "text-zinc-600"
                    )}
                  >
                    {cell.date.slice(8)}
                  </span>
                  {isToday && (
                    <span className="text-[9px] font-semibold text-indigo-600 bg-indigo-50 px-1 rounded">
                      今
                    </span>
                  )}
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5">
                  {renderCell(cell)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
