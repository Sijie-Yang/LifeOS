"use client";

import { cn } from "@/lib/utils";

export type FilterTab = {
  key: string;
  label: string;
  count?: number;
};

type FilterTabsProps = {
  tabs: FilterTab[];
  value: string;
  onChange: (key: string) => void;
  size?: "sm" | "md";
  shape?: "rounded" | "pill";
  className?: string;
  trailing?: React.ReactNode;
};

const sizeStyles = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
};

const shapeStyles = {
  rounded: "rounded-xl",
  pill: "rounded-full",
};

export function FilterTabs({
  tabs,
  value,
  onChange,
  size = "md",
  shape = "rounded",
  className,
  trailing,
}: FilterTabsProps) {
  return (
    <div className={cn("flex gap-2 mb-6 flex-wrap items-center", className)}>
      {tabs.map(({ key, label, count }) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn(
              "font-medium transition-all",
              sizeStyles[size],
              shapeStyles[shape],
              active
                ? "bg-indigo-50 text-indigo-700"
                : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100"
            )}
          >
            {label}
            {count != null && (
              <span className="ml-1.5 text-xs opacity-60">{count}</span>
            )}
          </button>
        );
      })}
      {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
    </div>
  );
}
