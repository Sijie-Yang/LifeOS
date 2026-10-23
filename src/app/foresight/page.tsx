"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import {
  FORESIGHT_META,
  FORESIGHT_NODES,
  currentForesightNode,
  type ForesightNode,
  type PredictionArea,
} from "@/lib/foresight-timeline";
import { cn } from "@/lib/utils";
import {
  Globe2,
  Cpu,
  UserRound,
  Target,
  Wrench,
  DoorOpen,
  Ban,
  Route,
  Zap,
  ChevronRight,
  CalendarClock,
} from "lucide-react";
import { UI_COPY } from "@/lib/ui-copy";

const AREA_META: Record<PredictionArea, { label: string; className: string }> = {
  econ: { label: "经济", className: "bg-emerald-100 text-emerald-800" },
  tech: { label: "科技", className: "bg-indigo-100 text-indigo-800" },
  geo: { label: "地缘", className: "bg-rose-100 text-rose-800" },
};

const CONF = {
  high: { label: "置信度高", className: "bg-emerald-100 text-emerald-800" },
  medium: { label: "置信度中", className: "bg-amber-100 text-amber-900" },
  low: { label: "置信度低", className: "bg-zinc-200 text-zinc-700" },
} as const;

function NodeCard({
  node,
  active,
  onSelect,
  isNow,
}: {
  node: ForesightNode;
  active: boolean;
  onSelect: () => void;
  isNow: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative text-left rounded-xl border px-3 py-3 transition-all min-w-[200px] sm:min-w-[220px] snap-start",
        active
          ? "border-amber-400 bg-amber-50/90 shadow-sm ring-2 ring-amber-300/60"
          : "border-zinc-200 bg-white hover:border-zinc-300",
        isNow && !active && "border-indigo-300"
      )}
    >
      {isNow && (
        <span className="absolute -top-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-600 text-white">
          现在
        </span>
      )}
      <p className="text-[11px] font-semibold tracking-wide text-zinc-500">{node.era}</p>
      <p className="text-sm font-semibold text-zinc-900 mt-0.5">{node.phase}</p>
      <p className="text-[11px] text-zinc-600 mt-1.5 line-clamp-2">{node.you.vision}</p>
      <Badge className={cn(CONF[node.confidence].className, "mt-2 text-[10px] px-1.5 py-0")}>
        {CONF[node.confidence].label}
      </Badge>
    </button>
  );
}

function Section({
  icon: Icon,
  title,
  children,
  tone = "default",
}: {
  icon: typeof Globe2;
  title: string;
  children: React.ReactNode;
  tone?: "default" | "you" | "warn";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3",
        tone === "you" && "border-amber-200 bg-amber-50/40",
        tone === "warn" && "border-rose-200 bg-rose-50/40",
        tone === "default" && "border-zinc-200 bg-white"
      )}
    >
      <h3 className="text-sm font-semibold text-zinc-800 flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-zinc-500" />
        {title}
      </h3>
      <div className="text-[13px] text-zinc-700 leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

export default function ForesightPage() {
  const nowNode = useMemo(() => currentForesightNode(), []);
  const searchParams = useSearchParams();
  const paramId = searchParams.get("id");
  const [selectedId, setSelectedId] = useState(() =>
    paramId && FORESIGHT_NODES.some((node) => node.id === paramId) ? paramId : nowNode.id
  );
  const selected = FORESIGHT_NODES.find((n) => n.id === selectedId) ?? nowNode;

  const progressPct = useMemo(() => {
    const start = FORESIGHT_NODES[0]!.yearStart;
    const end = FORESIGHT_NODES[FORESIGHT_NODES.length - 1]!.yearEnd;
    const y = new Date().getFullYear();
    return Math.min(100, Math.max(0, ((y - start) / (end - start)) * 100));
  }, []);

  return (
    <>
      <PageHeader
        title="三十年前瞻"
        description="世界局势情景 × 科技阶段 × 你在时间线上的 vision 与切入点"
        action={
          <div className="flex flex-wrap gap-2 text-xs">
            <Link href="/strategy" className="text-indigo-600 hover:underline inline-flex items-center gap-1">
              <Route className="h-3.5 w-3.5" /> 人生策略
            </Link>
            <Link href="/power" className="text-indigo-600 hover:underline inline-flex items-center gap-1">
              <Zap className="h-3.5 w-3.5" /> 权力地图
            </Link>
          </div>
        }
      />

      <p className="mb-3 text-xs text-zinc-500 border-l-2 border-amber-400 pl-3">
        {FORESIGHT_META.disclaimer}
      </p>

      {/* North star */}
      <div className="mb-6 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50/90 to-white px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-800/80">
          {UI_COPY.foresight.visionTitle}
        </p>
        <p className="text-sm md:text-[15px] text-zinc-900 mt-1.5 leading-relaxed font-medium">
          {FORESIGHT_META.northStar}
        </p>
        <ul className="mt-3 space-y-1.5">
          {FORESIGHT_META.thesis.map((t) => (
            <li key={t} className="text-[12px] text-zinc-600 flex gap-2">
              <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Axis */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-1.5">
          <span>{FORESIGHT_NODES[0]!.yearStart}</span>
          <span>三十年时间线</span>
          <span>{FORESIGHT_NODES[FORESIGHT_NODES.length - 1]!.yearEnd}</span>
        </div>
        <div className="relative h-2 rounded-full bg-zinc-200 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 via-amber-500 to-amber-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-[11px] text-zinc-400 mt-1">
          当前约在全程 {progressPct.toFixed(0)}% · 选中下方节点查看世界与你的准备
        </p>
      </div>

      {/* Horizontal timeline */}
      <div className="mb-6 overflow-x-auto pb-2 snap-x snap-mandatory">
        <div className="flex gap-3 min-w-max">
          {FORESIGHT_NODES.map((node, i) => (
            <div key={node.id} className="flex items-center gap-3">
              <NodeCard
                node={node}
                active={node.id === selected.id}
                isNow={node.id === nowNode.id}
                onSelect={() => setSelectedId(node.id)}
              />
              {i < FORESIGHT_NODES.length - 1 && (
                <div className="w-6 h-px bg-zinc-300 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold text-zinc-900">
          {selected.era}
          <span className="ml-2 text-sm font-semibold text-zinc-500">{selected.phase}</span>
        </h2>
        <Badge className={cn(CONF[selected.confidence].className, "text-[10px]")}>
          {CONF[selected.confidence].label}
        </Badge>
        {selected.id === nowNode.id && (
          <Badge className="bg-indigo-100 text-indigo-800 text-[10px]">当前所处</Badge>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2 mb-8">
        <Section icon={Globe2} title="世界 · 经济">
          <p>{selected.world.economy}</p>
        </Section>
        <Section icon={Cpu} title="世界 · 科技">
          <p>{selected.world.tech}</p>
          {selected.world.geopolitics && (
            <p className="text-zinc-600 text-[12px] pt-1 border-t border-zinc-100">
              地缘：{selected.world.geopolitics}
            </p>
          )}
        </Section>

        {selected.predictions.length > 0 && (
          <div className="lg:col-span-2 rounded-xl border border-zinc-200 bg-white px-4 py-3">
            <h3 className="text-sm font-semibold text-zinc-800 flex items-center gap-2 mb-3">
              <CalendarClock className="h-4 w-4 text-zinc-500" />
              关键年份预测
              <span className="text-[10px] font-normal text-zinc-400">
                （具体到年份的 base case 推演）
              </span>
            </h3>
            <ol className="relative space-y-3 pl-1">
              {selected.predictions.map((p, i) => (
                <li key={`${p.year}-${p.area}-${i}`} className="flex gap-3">
                  <div className="shrink-0 w-[76px] pt-0.5">
                    <span className="text-[12px] font-bold text-zinc-900 tabular-nums">
                      {p.year}
                    </span>
                  </div>
                  <div className="shrink-0 pt-0.5">
                    <Badge
                      className={cn(
                        AREA_META[p.area].className,
                        "text-[10px] px-1.5 py-0"
                      )}
                    >
                      {AREA_META[p.area].label}
                    </Badge>
                  </div>
                  <p className="text-[13px] text-zinc-700 leading-relaxed">{p.text}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        <Section icon={UserRound} title="你的 Vision" tone="you">
          <p className="font-medium text-zinc-900">{selected.you.vision}</p>
        </Section>
        <Section icon={DoorOpen} title="最佳抉择与切入点" tone="you">
          <p>{selected.you.entry}</p>
        </Section>

        <Section icon={Target} title="节点前要达到的目标">
          <ul className="space-y-1.5">
            {selected.you.goals.map((g) => (
              <li key={g} className="flex gap-2">
                <span className="text-amber-600 shrink-0">▸</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section icon={Wrench} title="准备清单">
          <ul className="space-y-1.5">
            {selected.you.prep.map((g) => (
              <li key={g} className="flex gap-2">
                <span className="text-indigo-600 shrink-0">▸</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={Ban} title="这一阶段不要做" tone="warn">
          <p>{selected.you.avoid}</p>
        </Section>
      </div>

      <p className="text-[11px] text-zinc-400 pb-8">
        {UI_COPY.foresight.footerBefore}
        <code className="text-zinc-500">src/lib/foresight-timeline.ts</code>
        {UI_COPY.foresight.footerAfter}
      </p>
    </>
  );
}
