"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type DateNavProps = {
  label: React.ReactNode;
  subtitle?: React.ReactNode;
  prevLabel?: string;
  nextLabel?: string;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  /** period: labeled secondary buttons; compact: icon-only ghost buttons */
  variant?: "period" | "compact";
  trailing?: React.ReactNode;
  className?: string;
};

export function DateNav({
  label,
  subtitle,
  prevLabel = "上一页",
  nextLabel = "下一页",
  onPrev,
  onNext,
  prevDisabled = false,
  nextDisabled = false,
  variant = "period",
  trailing,
  className,
}: DateNavProps) {
  if (variant === "compact") {
    return (
      <div className={cn("flex items-center justify-between mb-6 gap-3", className)}>
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={onPrev} disabled={prevDisabled} aria-label={prevLabel}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-[180px]">
            <p className="font-semibold text-zinc-900">{label}</p>
            {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={onNext} disabled={nextDisabled} aria-label={nextLabel}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {trailing}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-between mb-6 gap-3", className)}>
      <Button variant="secondary" size="sm" onClick={onPrev} disabled={prevDisabled}>
        <ChevronLeft className="h-4 w-4" />
        {prevLabel}
      </Button>
      <div className="text-center min-w-0 flex-1 px-2">
        <span className="text-sm font-medium text-zinc-700">{label}</span>
        {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {trailing}
        <Button variant="secondary" size="sm" onClick={onNext} disabled={nextDisabled}>
          {nextLabel}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
