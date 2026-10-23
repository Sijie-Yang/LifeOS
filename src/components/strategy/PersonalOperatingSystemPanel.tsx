import {
  DEFAULT_PERSONAL_OS,
  getOsAccentStyles,
  type PersonalOs,
} from "@/lib/personal-operating-system";
import { cn } from "@/lib/utils";
import { ArrowRight, Layers, Quote } from "lucide-react";

type Props = {
  data?: PersonalOs;
  className?: string;
};

export function PersonalOperatingSystemPanel({ data = DEFAULT_PERSONAL_OS, className }: Props) {
  const lifeosLayers = data.layers.filter((l) => l.lifeos);

  return (
    <div className={cn("space-y-5", className)}>
      <p className="text-sm text-zinc-600 leading-relaxed">{data.summary}</p>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {data.layers.map((layer, index) => {
          const styles = getOsAccentStyles(layer.accent);
          return (
            <div
              key={layer.name}
              className={cn(
                "rounded-xl border bg-white/80 p-3.5 shadow-sm transition-shadow hover:shadow-md",
                styles.border
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={cn(
                    "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white",
                    styles.dot
                  )}
                >
                  {index + 1}
                </span>
                <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", styles.badge)}>
                  {layer.name}
                </span>
              </div>
              <p className="text-sm font-medium text-zinc-900 leading-snug">{layer.role}</p>
              <p className="mt-1.5 text-xs text-zinc-500 leading-relaxed">
                参考 · {layer.reference}
              </p>
              <p className="mt-2 text-xs text-zinc-700 leading-relaxed border-t border-zinc-100 pt-2">
                {layer.principle}
              </p>
            </div>
          );
        })}
      </div>

      {lifeosLayers.length > 0 && (
        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-2.5">
            LifeOS 映射
          </p>
          <div className="flex flex-wrap gap-2">
            {lifeosLayers.map((layer) => {
              const styles = getOsAccentStyles(layer.accent);
              return (
                <div
                  key={layer.name}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700"
                >
                  <span className={cn("font-semibold", styles.badge, "rounded px-1.5 py-0.5")}>
                    {layer.name}
                  </span>
                  <ArrowRight className="h-3 w-3 text-zinc-400 shrink-0" />
                  <span>{layer.lifeos}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3">
        <Quote className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
        <p className="text-sm text-emerald-950/80 leading-relaxed">{data.footnote}</p>
      </div>
    </div>
  );
}

export function PersonalOperatingSystemHeader() {
  return (
    <div className="flex items-center gap-2">
      <Layers className="h-5 w-5 text-emerald-600 shrink-0" />
      <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
        个人操作系统 · 七层
      </p>
    </div>
  );
}
