"use client";

import { Card, CardContent } from "@/components/ui/Card";
import {
  IRON_LAWS,
  IRON_LAWS_ONE_LINER,
  IRON_LAWS_TITLE,
} from "@/lib/lifeos-iron-laws";
import { cn } from "@/lib/utils";

type IronLawsBannerProps = {
  compact?: boolean;
  className?: string;
};

export function IronLawsBanner({ compact = false, className }: IronLawsBannerProps) {
  if (compact) {
    return (
      <Card className={cn("mb-4 border-rose-300 bg-rose-50/60", className)}>
        <CardContent className="py-2.5 px-3">
          <p className="text-xs font-semibold text-rose-950">{IRON_LAWS_TITLE}</p>
          <p className="text-sm font-medium text-rose-900 mt-0.5 leading-snug">
            {IRON_LAWS_ONE_LINER}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("mb-4 border-rose-300 bg-rose-50/70", className)}>
      <CardContent className="py-3">
        <p className="text-sm font-bold text-rose-950 mb-2">{IRON_LAWS_TITLE}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {IRON_LAWS.map((law) => (
            <div key={law.id}>
              <p className="text-sm font-semibold text-rose-900 mb-1">{law.title}</p>
              <p className="text-xs text-rose-800/90 mb-1.5 leading-relaxed">{law.summary}</p>
              <ol className="text-xs text-rose-950 space-y-0.5 list-decimal pl-4 font-medium">
                {law.pillars.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
