"use client";

import { useState } from "react";
import {
  MUSK_ALGORITHM,
  MUSK_COMPASS_META,
  MUSK_DIMENSIONS,
  MUSK_TRAITS,
  MUSK_WEEKLY_CHECKS,
  STANCE_META,
  type CompassStance,
} from "@/lib/musk-compass";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { Compass, ChevronDown, ChevronUp, Quote, ListChecks } from "lucide-react";

const STANCE_ORDER: CompassStance[] = ["adopt", "adapt", "reject"];

export function MuskCompassHeader() {
  return (
    <div className="flex items-center gap-2">
      <Compass className="h-4 w-4 text-zinc-600" />
      <CardTitleLike />
    </div>
  );
}

function CardTitleLike() {
  return (
    <div>
      <p className="text-base font-semibold text-zinc-900">{MUSK_COMPASS_META.title}</p>
      <p className="text-xs text-zinc-500 font-normal mt-0.5">{MUSK_COMPASS_META.subtitle}</p>
    </div>
  );
}

export function MuskCompassPanel({ className }: { className?: string }) {
  const [filter, setFilter] = useState<CompassStance | "all">("all");
  const [openId, setOpenId] = useState<string | null>("cognition");

  const dims =
    filter === "all"
      ? MUSK_DIMENSIONS
      : MUSK_DIMENSIONS.filter((d) => d.stance === filter);

  return (
    <div className={cn("space-y-5", className)}>
      <p className="text-sm text-zinc-700 leading-relaxed">{MUSK_COMPASS_META.thesis}</p>
      <p className="text-[11px] text-zinc-400 border-l-2 border-zinc-200 pl-3">
        {MUSK_COMPASS_META.disclaimer}
      </p>

      {/* Traits */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
          性格底盘
        </p>
        <div className="flex flex-wrap gap-2">
          {MUSK_TRAITS.map((t) => (
            <details
              key={t.trait}
              className="group rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5"
            >
              <summary className="cursor-pointer text-xs font-semibold text-zinc-800 list-none flex items-center gap-1">
                {t.trait}
                <ChevronDown className="h-3 w-3 text-zinc-400 group-open:hidden" />
                <ChevronUp className="h-3 w-3 text-zinc-400 hidden group-open:inline" />
              </summary>
              <p className="mt-1.5 text-[11px] text-zinc-600 leading-relaxed max-w-xs">
                {t.evidence}
              </p>
            </details>
          ))}
        </div>
      </div>

      {/* Algorithm */}
      <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
          <Quote className="h-3 w-3" />
          The Algorithm（做事五步）
        </p>
        <ol className="space-y-1.5">
          {MUSK_ALGORITHM.map((step, i) => (
            <li key={step} className="text-[13px] text-zinc-700 flex gap-2">
              <span className="font-mono text-xs text-zinc-400 shrink-0 w-4">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Stance filter */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={cn(
            "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
            filter === "all"
              ? "bg-zinc-900 text-white border-zinc-900"
              : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
          )}
        >
          全部 {MUSK_DIMENSIONS.length}
        </button>
        {STANCE_ORDER.map((s) => {
          const meta = STANCE_META[s];
          const n = MUSK_DIMENSIONS.filter((d) => d.stance === s).length;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={cn(
                "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
                filter === s ? meta.className + " border-transparent font-semibold" : "bg-white text-zinc-600 border-zinc-200"
              )}
            >
              {meta.label} {n}
            </button>
          );
        })}
      </div>

      {/* Dimensions */}
      <div className="space-y-2">
        {dims.map((d) => {
          const open = openId === d.id;
          const meta = STANCE_META[d.stance];
          return (
            <div
              key={d.id}
              className="rounded-xl border border-zinc-200 bg-white overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpenId(open ? null : d.id)}
                className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left hover:bg-zinc-50/80"
              >
                <Badge className={cn(meta.className, "text-[10px] px-1.5 py-0 shrink-0")}>
                  {meta.label}
                </Badge>
                <span className="text-sm font-semibold text-zinc-900 flex-1">{d.title}</span>
                {open ? (
                  <ChevronUp className="h-4 w-4 text-zinc-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-zinc-400" />
                )}
              </button>
              {open && (
                <div className="px-3.5 pb-3.5 space-y-2.5 border-t border-zinc-100 pt-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                      他怎么做
                    </p>
                    <p className="text-[13px] text-zinc-700 leading-relaxed">{d.pattern}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                      性格机制
                    </p>
                    <p className="text-[13px] text-zinc-600 leading-relaxed">{d.mechanism}</p>
                  </div>
                  <div className="rounded-lg bg-amber-50/70 border border-amber-100 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-800/70 mb-1">
                      LifeOS 规则
                    </p>
                    <p className="text-[13px] text-zinc-800 leading-relaxed">{d.lifeos}</p>
                  </div>
                  {d.caution && (
                    <p className="text-[12px] text-rose-700/90 leading-relaxed">⚠ {d.caution}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Weekly checks */}
      <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800/70 mb-2.5 flex items-center gap-1.5">
          <ListChecks className="h-3.5 w-3.5" />
          每周风向校准
        </p>
        <ul className="space-y-1.5">
          {MUSK_WEEKLY_CHECKS.map((c) => (
            <li key={c.q} className="flex items-start gap-2 text-[13px] text-zinc-700">
              <Badge
                className={cn(STANCE_META[c.stance].className, "text-[10px] px-1.5 py-0 shrink-0 mt-0.5")}
              >
                {STANCE_META[c.stance].label}
              </Badge>
              <span>{c.q}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
