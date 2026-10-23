import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, ArrowUpDown, GripVertical } from "lucide-react";

export function DataTable({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  );
}

export function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-zinc-200 bg-zinc-50/80">{children}</tr>
    </thead>
  );
}

export function TableHeaderCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 whitespace-nowrap",
        className
      )}
    >
      {children}
    </th>
  );
}

export function SortableTableHeaderCell({
  children,
  className,
  active,
  direction,
  onSort,
}: {
  children: React.ReactNode;
  className?: string;
  active: boolean;
  direction: "asc" | "desc";
  onSort: () => void;
}) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap",
        active ? "text-indigo-600" : "text-zinc-500",
        className
      )}
    >
      <button
        type="button"
        onClick={onSort}
        className="inline-flex items-center gap-1 hover:text-zinc-800 transition-colors"
      >
        {children}
        {active ? (
          direction === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </th>
  );
}

export function DraggableSortableTableHeaderCell({
  children,
  className,
  active,
  direction,
  onSort,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  isDragTarget,
  isDragging,
}: {
  children: React.ReactNode;
  className?: string;
  active: boolean;
  direction: "asc" | "desc";
  onSort: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  isDragTarget?: boolean;
  isDragging?: boolean;
}) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap transition-colors",
        active ? "text-indigo-600" : "text-zinc-500",
        isDragTarget && "bg-indigo-50",
        isDragging && "opacity-40",
        className
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="inline-flex items-center gap-0.5">
        <span
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className="cursor-grab active:cursor-grabbing p-0.5 text-zinc-300 hover:text-zinc-500 rounded"
          title="拖拽调整列顺序"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
        <button
          type="button"
          onClick={onSort}
          className="inline-flex items-center gap-1 hover:text-zinc-800 transition-colors"
        >
          {children}
          {active ? (
            direction === "asc" ? (
              <ArrowUp className="h-3.5 w-3.5" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5" />
            )
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
          )}
        </button>
      </div>
    </th>
  );
}

export function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-zinc-100">{children}</tbody>;
}

export function TableRow({
  children,
  className,
  onClick,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
} & Omit<HTMLAttributes<HTMLTableRowElement>, "onClick">) {
  return (
    <tr
      className={cn(
        "[content-visibility:auto] [contain-intrinsic-size:auto_52px] transition-colors hover:bg-zinc-50/80",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
      {...rest}
    >
      {children}
    </tr>
  );
}

export function TableCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("px-4 py-3 text-zinc-700 align-middle", className)}>{children}</td>
  );
}

export function TableActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  );
}

export function TableCount({ count, label }: { count: number; label: string }) {
  return (
    <p className="text-xs text-zinc-500 mb-3">
      共 {count} {label}
    </p>
  );
}
