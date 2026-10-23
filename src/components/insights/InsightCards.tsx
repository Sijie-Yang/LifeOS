"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Lightbulb, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type InsightItem = {
  id: string;
  category: "habit" | "wellness" | "time" | "relationship" | "plan" | "urge" | "focus";
  severity: "info" | "warn" | "good";
  title: string;
  detail: string;
  href?: string;
};

const SEVERITY_STYLE = {
  info: { icon: Info, border: "border-sky-100 bg-sky-50/50", iconColor: "text-sky-600" },
  warn: { icon: AlertTriangle, border: "border-amber-100 bg-amber-50/50", iconColor: "text-amber-600" },
  good: { icon: CheckCircle2, border: "border-emerald-100 bg-emerald-50/50", iconColor: "text-emerald-600" },
};

export function InsightCards({ insights, title = "本周洞察" }: { insights: InsightItem[]; title?: string }) {
  if (insights.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {insights.map((item) => {
          const style = SEVERITY_STYLE[item.severity];
          const Icon = style.icon;
          const inner = (
            <div
              className={cn(
                "rounded-xl border p-4 h-full transition-colors",
                style.border,
                item.href && "hover:border-indigo-200 cursor-pointer"
              )}
            >
              <div className="flex gap-3">
                <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", style.iconColor)} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900">{item.title}</p>
                  <p className="text-xs text-zinc-600 mt-1 leading-relaxed">{item.detail}</p>
                </div>
              </div>
            </div>
          );
          return item.href ? (
            <Link key={item.id} href={item.href}>
              {inner}
            </Link>
          ) : (
            <div key={item.id}>{inner}</div>
          );
        })}
      </CardContent>
    </Card>
  );
}
