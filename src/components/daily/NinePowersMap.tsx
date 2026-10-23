"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Circle, Lock, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { fetchJson, invalidateFetchCache } from "@/components/ui/PageState";
import { cn, toDateString } from "@/lib/utils";
import {
  LIFE_POWER_META,
  isLifePowerKey,
  type LifePowerDetail,
  type LifePowerDimension,
  type LifePowerKey,
  type LifePowerLever,
  type LifePowersResult,
} from "@/lib/life-powers";

const LEVEL_STYLES = {
  ok: {
    bar: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-100",
    node: "border-emerald-200 bg-white",
    ring: "border-emerald-100",
    line: "stroke-emerald-300",
  },
  warn: {
    bar: "bg-amber-500",
    chip: "bg-amber-50 text-amber-800 border-amber-100",
    node: "border-amber-300 bg-amber-50/70",
    ring: "border-amber-200",
    line: "stroke-amber-300",
  },
  critical: {
    bar: "bg-rose-500",
    chip: "bg-rose-50 text-rose-700 border-rose-200",
    node: "border-rose-300 bg-rose-50 ring-2 ring-rose-100",
    ring: "border-rose-300 ring-1 ring-rose-100",
    line: "stroke-rose-300",
  },
} as const;

const LEVER_LABEL: Record<LifePowerLever["type"], string> = {
  habit: "习惯",
  task: "任务",
  plan_step: "步骤",
  meeting: "会议",
  content: "推广",
  opportunity: "机会",
  urge: "转移",
  room: "房间",
};

/** 坐标系 viewBox 0 0 100 120；node = 按钮中心，anchor = 身体/群体上的连接点 */
type Placement = { node: [number, number]; anchor: [number, number] };

const BODY_LAYOUT: Partial<Record<LifePowerKey, Placement>> = {
  learning: { node: [14, 12], anchor: [47.4, 13] }, // 眼：输入
  calm: { node: [14, 46], anchor: [53.6, 37] }, // 心：内在
  clean: { node: [14, 84], anchor: [27.8, 76] }, // 左手：熵减
  influence: { node: [86, 12], anchor: [50, 18.6] }, // 口：输出
  action: { node: [86, 58], anchor: [72.2, 76] }, // 右手：生产
  vitality: { node: [86, 98], anchor: [58.6, 96] }, // 腿：外在
};

/** 群体图：我在中心，一圈身边人（链接力），圈外的机会人（机会力），下方团队（组织力） */
const ME: [number, number] = [50, 50];
const RING_R = 27;
const RING_PEOPLE = [200, 235, 270, 305, 340, 20, 160].map((deg) => {
  const a = (deg * Math.PI) / 180;
  return [ME[0] + Math.cos(a) * RING_R, ME[1] + Math.sin(a) * RING_R] as [number, number];
});
const OPPORTUNITY_PERSON: [number, number] = [91, 50];
const TEAM_BAR_Y = 84;
const TEAM: Array<[number, number]> = [
  [34, 97],
  [46, 97],
  [58, 97],
  [70, 97],
];

const GROUP_LAYOUT: Partial<Record<LifePowerKey, Placement>> = {
  social: { node: [14, 12], anchor: [RING_PEOPLE[1]![0], RING_PEOPLE[1]![1] - 5] },
  link: { node: [86, 12], anchor: [OPPORTUNITY_PERSON[0], OPPORTUNITY_PERSON[1] - 7] },
  organize: { node: [14, 100], anchor: [TEAM[0]![0] - 6, TEAM_BAR_Y] },
};

function pct([x, y]: [number, number]) {
  return { left: `${x}%`, top: `${(y / 120) * 100}%` };
}

function leverCount(dim: LifePowerDimension) {
  return { done: dim.todayLevers.filter((l) => l.done).length, total: dim.todayLevers.length };
}

type Props = {
  lifePowers: LifePowersResult;
  /** 选入 / 移出项目后刷新九力 */
  onRefresh?: () => void;
  date: string;
  /** 执行 / 对齐阶段：收成一排小标签，可展开 */
  compact?: boolean;
  onLeverToggle?: (lever: LifePowerLever) => void;
  busy?: boolean;
  className?: string;
};

export function NinePowersMap({ lifePowers, date, compact, onLeverToggle, onRefresh, busy, className }: Props) {
  const dims = lifePowers.dimensions;
  const byKey = new Map(dims.map((d) => [d.key, d]));
  const [openKey, setOpenKey] = useState<LifePowerKey | null>(null);
  const [expanded, setExpanded] = useState(false);
  const checked = compact && !expanded;

  const open = openKey ? byKey.get(openKey) ?? null : null;
  const select = (key: LifePowerKey) => setOpenKey(key);
  const alignPct =
    lifePowers.eventTotal > 0 ? Math.round((lifePowers.eventMatched / lifePowers.eventTotal) * 100) : null;

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-zinc-900">九力</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {compact ? "点任一力看它关联的全部东西" : "左边是人，右边是人群；红的先看，点开补一项"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {alignPct != null && (
          <span
            className={cn(
              "rounded-md border px-2 py-1 text-[11px] font-medium",
              lifePowers.unmatched.length === 0
                ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                : "border-zinc-200 bg-zinc-50 text-zinc-600"
            )}
          >
            今日 {lifePowers.eventMatched}/{lifePowers.eventTotal} 件在九力内
          </span>
        )}
        {lifePowers.criticalCount > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700">
            <AlertTriangle className="h-3 w-3" />
            {lifePowers.criticalCount} 项告急
          </span>
        ) : (
          <span className="rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700">
            底线稳定
          </span>
        )}
        {compact && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"
          >
            {expanded ? (
              <>
                收起 <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                看九力图 <ChevronDown className="h-3 w-3" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );

  if (checked) {
    return (
      <Card className={cn("mb-4 border-zinc-200/80", className)}>
        <CardContent className="space-y-3 pt-4 pb-4">
          {header}
          <div className="flex flex-wrap gap-1.5">
            {dims.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setOpenKey(d.key)}
                className={cn("rounded-md border px-2 py-1 text-[11px]", LEVEL_STYLES[d.level].chip)}
              >
                {d.label} <span className="tabular-nums">{d.score}</span>
              </button>
            ))}
          </div>
          {open && (
            <PowerModal
              dim={open}
              date={date}
              onClose={() => setOpenKey(null)}
              onRefresh={onRefresh}
              onLeverToggle={onLeverToggle}
              busy={busy}
            />
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("mb-4 border-zinc-200/80 bg-gradient-to-br from-zinc-50/90 via-white to-white", className)}>
      <CardContent className="space-y-4 pt-4 pb-4">
        {header}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <DiagramPanel title="人体 · 六力" subtitle="个人系统：熵减、内外、输入输出与生产">
            <BodyFigure />
            {dims
              .filter((d) => BODY_LAYOUT[d.key])
              .map((d) => (
                <Connector key={`line-${d.key}`} placement={BODY_LAYOUT[d.key]!} level={d.level} active={openKey === d.key} />
              ))}
            {dims
              .filter((d) => BODY_LAYOUT[d.key])
              .map((d) => (
                <PowerNode
                  key={d.key}
                  dim={d}
                  at={BODY_LAYOUT[d.key]!.node}
                  active={openKey === d.key}
                  onClick={() => select(d.key)}
                />
              ))}
          </DiagramPanel>

          <DiagramPanel title="群体 · 三力" subtitle="以我为中心：链接人、抓机会、带下游">
            <GroupFigure />
            {dims
              .filter((d) => GROUP_LAYOUT[d.key])
              .map((d) => (
                <Connector
                  key={`line-${d.key}`}
                  placement={GROUP_LAYOUT[d.key]!}
                  level={d.level}
                  active={openKey === d.key}
                  dashed={d.key === "link"}
                />
              ))}
            {dims
              .filter((d) => GROUP_LAYOUT[d.key])
              .map((d) => (
                <PowerNode
                  key={d.key}
                  dim={d}
                  at={GROUP_LAYOUT[d.key]!.node}
                  active={openKey === d.key}
                  onClick={() => select(d.key)}
                />
              ))}
          </DiagramPanel>
        </div>

        {open && (
          <PowerModal
            dim={open}
            date={date}
            onClose={() => setOpenKey(null)}
            onRefresh={onRefresh}
            onLeverToggle={onLeverToggle}
            busy={busy}
          />
        )}

        <EventAlignment lifePowers={lifePowers} openKey={openKey} onSelect={select} />
      </CardContent>
    </Card>
  );
}

function DiagramPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-white/70 px-3 pt-2.5 pb-3">
      <p className="text-xs font-semibold text-zinc-800">{title}</p>
      <p className="text-[10px] text-zinc-400">{subtitle}</p>
      <div className="relative mx-auto mt-1 w-full max-w-[360px]" style={{ aspectRatio: "100 / 120" }}>
        {children}
      </div>
    </div>
  );
}

/** 左右对称：x → 100 - x */
function mirror(d: string) {
  return d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x: string, y: string) => `${+(100 - Number(x)).toFixed(2)} ${y}`);
}

const BODY_TORSO =
  "M50 25.5 C43 25.5 37 26.3 34 28.6 C31.6 30.4 31 33 31.3 36 C31.8 40 34.5 43 35.6 47 C36.8 51 38.2 54 38 58 C37.8 61 36 64 35.8 68 L36.2 72 L63.8 72 L64.2 68 C64 64 62.2 61 62 58 C61.8 54 63.2 51 64.4 47 C65.5 43 68.2 40 68.7 36 C69 33 68.4 30.4 66 28.6 C63 26.3 57 25.5 50 25.5 Z";
const BODY_NECK = "M46.4 19 C46.6 22 46.4 25 45.6 27.6 L54.4 27.6 C53.6 25 53.4 22 53.6 19 Z";
const BODY_ARM_L =
  "M33.6 28.8 C30.4 30 29.6 33.6 29.4 38 C29.1 44 28.5 48 28.2 52 C27.8 58 26.9 64 26.4 71 L29.8 71.4 C30.4 65 31.5 58 32.3 52.4 C33 47.4 34.5 42.6 35.4 38.4 Z";
const BODY_HAND_L =
  "M26.3 70.6 C25.2 72.4 24.9 75.2 25.6 77.6 C26.2 79.4 27.8 80.2 29 79.4 C30.2 78.4 30.4 75.6 30.1 73.4 C29.9 72 29.8 71.2 29.8 70.8 Z";
const BODY_LEG_L =
  "M36 70 C35.6 78 36.6 86 37.6 92 C38.4 98 38.8 104 40.4 110 L45.2 110 C45.4 104 45.8 98 45.6 92 C45.6 86 48.4 80 49.4 74 L49.6 70 Z";
const BODY_FOOT_L = "M40.2 109.2 C38.8 111.4 37.4 113 38 114.6 L45.6 114.6 C45.9 113 45.7 111 45.3 109.2 Z";

function BodyFigure() {
  const id = useId().replace(/:/g, "");
  const parts = [
    BODY_NECK,
    BODY_TORSO,
    BODY_ARM_L,
    mirror(BODY_ARM_L),
    BODY_HAND_L,
    mirror(BODY_HAND_L),
    BODY_LEG_L,
    mirror(BODY_LEG_L),
    BODY_FOOT_L,
    mirror(BODY_FOOT_L),
  ];
  return (
    <svg viewBox="0 0 100 120" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={`${id}-skin`} gradientUnits="userSpaceOnUse" x1="0" y1="6" x2="0" y2="116">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
        <radialGradient id={`${id}-heart`}>
          <stop offset="0%" stopColor="#818cf8" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={50} cy={115.2} rx={16} ry={1.6} fill="#e4e4e7" />
      {/* 先带描边画一遍，再无描边覆盖一遍：只留外轮廓，不留拼接缝 */}
      {[true, false].map((outline) => (
        <g
          key={String(outline)}
          fill={`url(#${id}-skin)`}
          stroke={outline ? "#aab8c8" : "none"}
          strokeWidth={outline ? 0.7 : 0}
          strokeLinejoin="round"
        >
          {parts.map((d, i) => (
            <path key={i} d={d} />
          ))}
          <ellipse cx={43.5} cy={14.5} rx={1.1} ry={2} />
          <ellipse cx={56.5} cy={14.5} rx={1.1} ry={2} />
          <ellipse cx={50} cy={13.4} rx={6.4} ry={7.8} />
        </g>
      ))}
      {/* 内部线条：锁骨、胸、腹，让轮廓有体积 */}
      <g fill="none" stroke="#b6c2d1" strokeWidth={0.3} strokeLinecap="round">
        <path d="M41 29.6 C44 30.4 47 30.4 49.4 29.8 M50.6 29.8 C53 30.4 56 30.4 59 29.6" />
        <path d="M40.6 41 C44 43 47.6 42.6 49.6 41.4 M50.4 41.4 C52.4 42.6 56 43 59.4 41" />
        <path d="M50 44 L50 60" />
        <path d="M45 66.5 C47.5 69 52.5 69 55 66.5" />
      </g>
      <circle cx={53.6} cy={37} r={4.5} fill={`url(#${id}-heart)`} />
    </svg>
  );
}

/** 头肩半身像：(x, y) 为肩线中心 */
function Person({
  at: [x, y],
  s = 1,
  className,
  dashed,
}: {
  at: [number, number];
  s?: number;
  className: string;
  dashed?: boolean;
}) {
  const body = `M${x - 6.4 * s} ${y + 5 * s} C${x - 6.4 * s} ${y} ${x - 3.8 * s} ${y - 1.4 * s} ${x} ${y - 1.4 * s} C${x + 3.8 * s} ${y - 1.4 * s} ${x + 6.4 * s} ${y} ${x + 6.4 * s} ${y + 5 * s} Q${x} ${y + 6.2 * s} ${x - 6.4 * s} ${y + 5 * s} Z`;
  return (
    <g className={className} strokeDasharray={dashed ? "1.2 1" : undefined}>
      <circle cx={x} cy={y - 5.4 * s} r={3.3 * s} />
      <path d={body} />
    </g>
  );
}

function GroupFigure() {
  return (
    <svg viewBox="0 0 100 120" className="absolute inset-0 h-full w-full" aria-hidden>
      <circle cx={ME[0]} cy={ME[1]} r={RING_R} fill="none" stroke="#e4e4e7" strokeWidth={0.4} strokeDasharray="1.5 2" />
      {/* 我 ↔ 身边人 */}
      {RING_PEOPLE.map(([x, y], i) => (
        <path key={i} d={`M${ME[0]} ${ME[1] - 2} L${x} ${y}`} stroke="#e4e4e7" strokeWidth={0.4} />
      ))}
      {/* 我 → 圈外机会 */}
      <path
        d={`M${ME[0] + 9} ${ME[1] - 2} L${OPPORTUNITY_PERSON[0] - 7} ${OPPORTUNITY_PERSON[1]}`}
        stroke="#fbbf24"
        strokeWidth={0.5}
        strokeDasharray="1.5 1.5"
      />
      {/* 我 → 下游团队 */}
      <path
        d={`M${ME[0]} ${ME[1] + 9} L${ME[0]} ${TEAM_BAR_Y} M${TEAM[0]![0] - 6} ${TEAM_BAR_Y} L${TEAM[TEAM.length - 1]![0]} ${TEAM_BAR_Y}`}
        stroke="#cbd5e1"
        strokeWidth={0.5}
        fill="none"
      />
      {TEAM.map(([x, y], i) => (
        <path key={i} d={`M${x} ${TEAM_BAR_Y} L${x} ${y - 9.5}`} stroke="#cbd5e1" strokeWidth={0.5} />
      ))}

      {RING_PEOPLE.map((p, i) => (
        <Person key={i} at={p} s={0.78} className={i % 2 ? "fill-slate-300" : "fill-slate-200 stroke-slate-300"} />
      ))}
      <Person at={OPPORTUNITY_PERSON} s={0.85} className="fill-amber-50 stroke-amber-400" dashed />
      <path
        d={`M${OPPORTUNITY_PERSON[0] - 5} ${OPPORTUNITY_PERSON[1] - 11} l0.8 -1.8 l0.8 1.8 l1.8 0.8 l-1.8 0.8 l-0.8 1.8 l-0.8 -1.8 l-1.8 -0.8 Z`}
        className="fill-amber-400"
      />
      {TEAM.map((p, i) => (
        <Person key={i} at={p} s={0.85} className="fill-slate-400" />
      ))}

      <Person at={ME} s={1.6} className="fill-indigo-600" />
      <text x={ME[0]} y={ME[1] + 15.5} textAnchor="middle" className="fill-indigo-700" fontSize={4.6} fontWeight={600}>
        我
      </text>
    </svg>
  );
}

function Connector({
  placement,
  level,
  active,
  dashed,
}: {
  placement: Placement;
  level: LifePowerDimension["level"];
  active: boolean;
  dashed?: boolean;
}) {
  const [nx, ny] = placement.node;
  const [ax, ay] = placement.anchor;
  return (
    <svg viewBox="0 0 100 120" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      <path
        d={`M${ax} ${ay} L${nx} ${ny}`}
        className={LEVEL_STYLES[level].line}
        strokeWidth={active ? 0.9 : 0.5}
        strokeDasharray={dashed ? "2 2" : undefined}
        fill="none"
      />
      <circle cx={ax} cy={ay} r={1.2} className={cn("fill-white", LEVEL_STYLES[level].line)} strokeWidth={0.5} />
    </svg>
  );
}

function PowerNode({
  dim,
  at,
  active,
  onClick,
}: {
  dim: LifePowerDimension;
  at: [number, number];
  active: boolean;
  onClick: () => void;
}) {
  const style = LEVEL_STYLES[dim.level];
  const count = leverCount(dim);
  return (
    <button
      type="button"
      onClick={onClick}
      style={pct(at)}
      className={cn(
        "absolute w-[4.6rem] -translate-x-1/2 sm:w-[5.5rem] -translate-y-1/2 rounded-xl border px-2 py-1.5 text-left shadow-sm transition",
        style.node,
        active ? "z-10 scale-105 shadow-md ring-2 ring-indigo-200" : "hover:shadow"
      )}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[12px] font-semibold text-zinc-900">{dim.label}</span>
        <span className="text-[11px] font-medium tabular-nums text-zinc-700">{dim.score}</span>
      </div>
      <div className="text-[9px] text-zinc-500">{dim.role}</div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-zinc-100">
        <div className={cn("h-full rounded-full", style.bar)} style={{ width: `${Math.max(0, Math.min(100, dim.score))}%` }} />
      </div>
      <div className="mt-0.5 text-[9px] text-zinc-500">
        {count.total > 0 ? `今日 ${count.done}/${count.total}` : "今日无事件"}
      </div>
    </button>
  );
}

function PowerDetail({
  dim,
  onLeverToggle,
  busy,
}: {
  dim: LifePowerDimension;
  onLeverToggle?: (lever: LifePowerLever) => void;
  busy?: boolean;
}) {
  const meta = LIFE_POWER_META[dim.key];
  const events = dim.todayLevers.filter((l) => l.type !== "habit");
  return (
    <div>
      <div className={cn("mb-3 rounded-xl border px-3 py-2.5", LEVEL_STYLES[dim.level].ring)}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-zinc-700">
            <span className="font-medium text-zinc-900">{dim.role}</span>
            <span className="ml-2 text-xs text-zinc-500">{dim.summary}</span>
          </p>
          <Badge className={cn("border text-[10px]", LEVEL_STYLES[dim.level].chip)}>{dim.score}</Badge>
        </div>
        <p className="mt-1 text-[11px] text-zinc-500">{meta.description}</p>
      </div>
      <SectionTitle>今日事件</SectionTitle>

      {dim.weekDays != null && (
        <div className="mb-2 flex items-center gap-2 text-[11px] text-zinc-500">
          <span>本周</span>
          <div className="flex gap-0.5">
            {Array.from({ length: 7 }, (_, i) => (
              <span
                key={i}
                className={cn("h-2 w-3 rounded-sm", i < dim.weekDays! ? "bg-indigo-500" : "bg-zinc-200")}
              />
            ))}
          </div>
          <span className="tabular-nums">{dim.weekDays}/7 天</span>
        </div>
      )}


      {dim.zones && dim.zones.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
          {dim.zones.slice(0, 8).map((z) => (
            <div
              key={z.name}
              className={cn(
                "rounded-lg border px-2 py-1.5 text-[11px]",
                z.score < 40
                  ? "border-rose-100 bg-rose-50/60 text-rose-800"
                  : z.score < 70
                    ? "border-amber-100 bg-amber-50/50 text-amber-800"
                    : "border-zinc-100 bg-zinc-50 text-zinc-600"
              )}
            >
              <div className="truncate font-medium">{z.name}</div>
              <div className="text-[10px] opacity-80">
                {z.daysSince == null ? "从未" : `${z.daysSince} 天`} · {z.score}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 习惯在下方「习惯」区统一展示（含执行日与今日打卡），这里只列项目步骤、任务、会议、机会 */}
      {events.length === 0 ? (
        <p className="text-xs text-zinc-500">
          {dim.todayLevers.length > 0 ? "今日只有习惯，见下方。" : "今日没有这一力的事件：锁定一个习惯，或在下面选入一个项目。"}
        </p>
      ) : (
        <LeverList levers={events} onLeverToggle={onLeverToggle} busy={busy} />
      )}
    </div>
  );
}

function LeverList({
  levers,
  onLeverToggle,
  busy,
  compact,
}: {
  levers: LifePowerLever[];
  onLeverToggle?: (lever: LifePowerLever) => void;
  busy?: boolean;
  compact?: boolean;
}) {
  return (
    <ul className={cn("grid gap-1.5", compact ? "grid-cols-2 sm:grid-cols-3" : "sm:grid-cols-2")}>
      {levers.map((lever) => {
        const clickable = Boolean(onLeverToggle) && (!lever.done || canUndoLever(lever));
        return (
          <li key={`${lever.type}-${lever.id}`}>
            <button
              type="button"
              disabled={!clickable || busy}
              onClick={() => onLeverToggle?.(lever)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border text-left",
                compact ? "px-2 py-1 text-xs" : "px-2.5 py-2 text-sm",
                lever.done
                  ? "border-emerald-100 bg-emerald-50/40 text-zinc-500"
                  : "border-zinc-100 bg-white hover:border-zinc-200",
                !clickable && "cursor-default"
              )}
            >
              {lever.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-zinc-400" />
              )}
              <span className={cn("min-w-0 flex-1 truncate", lever.done && "line-through")}>{lever.label}</span>
              {!compact && <span className="shrink-0 text-[10px] text-zinc-400">{LEVER_LABEL[lever.type]}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function EventAlignment({
  lifePowers,
  openKey,
  onSelect,
}: {
  lifePowers: LifePowersResult;
  openKey: LifePowerKey | null;
  onSelect: (key: LifePowerKey) => void;
}) {
  const groups: Array<{ title: string; group: "body" | "group" }> = [
    { title: "人体", group: "body" },
    { title: "群体", group: "group" },
  ];
  return (
    <div className="rounded-xl border border-zinc-100 bg-white/70 px-3 py-3">
      <p className="mb-2 text-xs font-semibold text-zinc-800">今日事件 × 九力</p>
      <div className="space-y-1.5">
        {groups.map((g) => (
          <div key={g.group} className="flex flex-wrap items-center gap-1.5">
            <span className="w-8 shrink-0 text-[10px] text-zinc-400">{g.title}</span>
            {lifePowers.dimensions
              .filter((d) => d.group === g.group)
              .map((d) => {
                const c = leverCount(d);
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => onSelect(d.key)}
                    className={cn(
                      "rounded-md border px-2 py-1 text-[11px]",
                      c.total === 0 ? "border-dashed border-zinc-200 text-zinc-400" : LEVEL_STYLES[d.level].chip,
                      openKey === d.key && "ring-2 ring-indigo-200"
                    )}
                  >
                    {d.label} · {c.total === 0 ? "空" : `${c.done}/${c.total}`}
                  </button>
                );
              })}
          </div>
        ))}
      </div>

      {lifePowers.base.total > 0 && (
        <p className="mt-2 text-[11px] text-zinc-400">
          生活底盘 {lifePowers.base.done}/{lifePowers.base.total}（洗漱、补剂、戒断、计划关账等，不进九力）
        </p>
      )}

      {lifePowers.unmatched.length > 0 ? (
        <div className="mt-3 border-t border-zinc-100 pt-2">
          <p className="mb-1.5 text-[11px] text-zinc-500">
            未入九力 {lifePowers.unmatched.length} 件 · 习惯去锁定归属，项目在对应力的弹窗里选入，或者砍掉
          </p>
          <div className="flex flex-wrap gap-1.5">
            {lifePowers.unmatched.map((l) => (
              <span
                key={`${l.type}-${l.id}`}
                className={cn(
                  "max-w-full truncate rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] text-zinc-600",
                  l.done && "line-through opacity-60"
                )}
              >
                <span className="mr-1 text-zinc-400">{LEVER_LABEL[l.type]}</span>
                {l.label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        lifePowers.eventTotal > 0 && (
          <p className="mt-2 text-[11px] text-emerald-700">今天的事件全部落在九力视野内。</p>
        )
      )}
    </div>
  );
}

/** 点击九力里的动作：打卡 / 完成步骤 / 完成任务 / 激活机会 */
/** 完成了还能再点一次取消的类型（只有冲动转化不能撤回：它是一次冲动记录，去今日页删） */
export function canUndoLever(lever: LifePowerLever): boolean {
  return lever.type !== "urge";
}

/** 点一下完成，已完成的再点一下取消 */
export async function toggleLifePowerLever(lever: LifePowerLever, date: string) {
  if (lever.done) {
    if (!canUndoLever(lever)) return;
    if (lever.type === "habit") {
      await fetch(`/api/habits/${lever.id}/checkin?date=${date}`, { method: "DELETE" });
    } else if (lever.type === "plan_step" || lever.type === "content") {
      await fetch(`/api/plan-steps/${lever.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: false, doneDate: null }),
      });
    } else if (lever.type === "task") {
      await fetch(`/api/tasks/${lever.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: false }),
      });
    } else if (lever.type === "meeting") {
      await fetch(`/api/meetings/${lever.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Scheduled" }),
      });
    } else if (lever.type === "opportunity") {
      await fetch(`/api/opportunities/${lever.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pushedDate: `undo:${date}` }),
      });
    } else if (lever.type === "room") {
      // 房间分区打勾（id = 分区 key），和房间卡片上取消打勾一样
      await fetch("/api/daily-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, roomTask: { key: lever.id, done: false } }),
      });
    }
    return;
  }
  if (lever.type === "habit") {
    await fetch(`/api/habits/${lever.id}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, completed: true, level: "full" }),
    });
  } else if (lever.type === "plan_step" || lever.type === "content") {
    await fetch(`/api/plan-steps/${lever.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: true, doneDate: date }),
    });
  } else if (lever.type === "task") {
    await fetch(`/api/tasks/${lever.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
  } else if (lever.type === "opportunity") {
    await fetch(`/api/opportunities/${lever.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      // 只记「今天推进了」，不改状态（这样取消时不用猜原来的状态）
      body: JSON.stringify({ pushedDate: date }),
    });
  } else if (lever.type === "meeting") {
    await fetch(`/api/meetings/${lever.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Completed" }),
    });
  }
}

function SectionTitle({ children, href, count }: { children: React.ReactNode; href?: string; count?: number }) {
  return (
    <div className="mb-1.5 mt-4 flex items-center justify-between first:mt-0">
      <p className="text-xs font-semibold text-zinc-800">
        {children}
        {count != null && <span className="ml-1 font-normal text-zinc-400">{count}</span>}
      </p>
      {href && (
        <Link href={href} className="text-[11px] text-indigo-600 hover:underline">
          全部 →
        </Link>
      )}
    </div>
  );
}

const ROW = "flex items-center gap-2 rounded-lg border border-zinc-100 bg-white px-2.5 py-1.5 text-sm";

function shortDate(d: string | null) {
  return d ? d.slice(5).replace("-", "/") : "";
}

/** 点开某一力：今日动作 + 当前关联的全部习惯、项目、任务、会议、机会、联系人、近 14 日动作 */
function PowerModal({
  dim,
  date,
  onClose,
  onRefresh,
  onLeverToggle,
  busy,
}: {
  dim: LifePowerDimension;
  date: string;
  onClose: () => void;
  onRefresh?: () => void;
  onLeverToggle?: (lever: LifePowerLever) => void;
  busy?: boolean;
}) {
  const url = `/api/life-powers/${dim.key}?date=${date}`;
  const [detail, setDetail] = useState<{ url: string; data: LifePowerDetail } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchJson<LifePowerDetail>(url, { force: true })
      .then((data) => !cancelled && setDetail({ url, data }))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "加载失败"));
    return () => {
      cancelled = true;
    };
  }, [url, busy, rev]);

  const setProject = async (projectId: string, selected: boolean) => {
    await fetch(`/api/life-powers/${dim.key}/projects`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, selected }),
    });
    invalidateFetchCache("/api/daily-log");
    setRev((n) => n + 1);
    onRefresh?.();
  };

  const d = detail?.url === url ? detail.data : null;

  return (
    <Modal open onClose={onClose} title={`${dim.label} · 关联全景`} wide>
      <PowerDetail dim={dim} onLeverToggle={onLeverToggle} busy={busy} />

      {!d ? (
        <p className="mt-4 text-xs text-zinc-400">{error ?? "加载关联…"}</p>
      ) : (
        <PowerAssociations
          d={d}
          powerKey={dim.key}
          onSetProject={setProject}
          onLeverToggle={onLeverToggle}
          busy={busy}
        />
      )}
    </Modal>
  );
}

function PowerAssociations({
  d,
  powerKey,
  onSetProject,
  onLeverToggle,
  busy,
}: {
  d: LifePowerDetail;
  powerKey: LifePowerKey;
  onSetProject: (projectId: string, selected: boolean) => Promise<void>;
  onLeverToggle?: (lever: LifePowerLever) => void;
  busy?: boolean;
}) {
  return (
    <>
      <SectionTitle href="/habits" count={d.habits.length}>
        习惯 · 已锁定
      </SectionTitle>
      {d.habits.length === 0 ? (
        <p className="text-[11px] text-zinc-500">还没有锁定到这一力的习惯：去习惯页编辑「九力归属」。</p>
      ) : (
        <ul className="space-y-1">
          {d.habits.map((h) => {
            const canCheck = Boolean(onLeverToggle) && h.scheduledToday && !h.checkedToday && !busy;
            return (
              <li key={h.id} className={cn(ROW, !h.scheduledToday && "bg-zinc-50/60")}>
                <button
                  type="button"
                  disabled={!canCheck}
                  title={h.scheduledToday ? (h.checkedToday ? "今日已打卡" : "今日打卡") : "今天不是执行日"}
                  onClick={() => onLeverToggle?.({ type: "habit", id: h.id, label: h.name, done: false })}
                  className="shrink-0 disabled:cursor-default"
                >
                  {h.checkedToday ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : h.scheduledToday ? (
                    <Circle className="h-4 w-4 text-zinc-400 hover:text-emerald-500" />
                  ) : (
                    <Circle className="h-4 w-4 text-zinc-200" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className={cn("truncate", h.checkedToday && "text-zinc-500 line-through")}>{h.name}</div>
                  <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                    <Lock className="h-2.5 w-2.5" />
                    <span>{h.schedule}</span>
                    <span>·</span>
                    <span className={h.scheduledToday ? "text-indigo-600" : ""}>{h.scheduledToday ? "今日要做" : "今日休"}</span>
                  </div>
                </div>
                <span className="flex shrink-0 gap-0.5" title="近 7 天：绿 = 已打卡，灰 = 该做未做，虚框 = 非执行日">
                  {h.week.map((state, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-2.5 w-2.5 rounded-sm",
                        state === "done" && "bg-emerald-500",
                        state === "missed" && "bg-zinc-300",
                        state === "rest" && "border border-dashed border-zinc-200"
                      )}
                    />
                  ))}
                </span>
                <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-zinc-400">
                  {shortDate(h.lastDate) || "从未"}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <ProjectSection d={d} powerKey={powerKey} onSetProject={onSetProject} />

      {d.tasks.length > 0 && (
        <>
          <SectionTitle href="/tasks" count={d.tasks.length}>
            待办任务
          </SectionTitle>
          <ul className="space-y-1">
            {d.tasks.map((t) => (
              <li key={t.id} className={ROW}>
                <Circle className="h-3.5 w-3.5 shrink-0 text-zinc-300" />
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                {t.projectName && <span className="max-w-[8rem] shrink-0 truncate text-[10px] text-zinc-400">{t.projectName}</span>}
                {t.due && <span className="shrink-0 text-[10px] tabular-nums text-zinc-500">{shortDate(t.due)}</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      {d.meetings.length > 0 && (
        <>
          <SectionTitle href="/meetings" count={d.meetings.length}>
            会议 · 前后两周
          </SectionTitle>
          <ul className="space-y-1">
            {d.meetings.map((m) => (
              <li key={m.id}>
                <Link href={`/meetings?id=${m.id}`} className={cn(ROW, "hover:border-zinc-200")}>
                  <span className="w-16 shrink-0 text-[11px] tabular-nums text-zinc-500">
                    {shortDate(m.date)} {m.time ?? ""}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{m.title}</span>
                  <span className="shrink-0 text-[10px] text-zinc-400">{m.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {d.opportunities.length > 0 && (
        <>
          <SectionTitle href="/opportunities" count={d.opportunities.length}>
            机会
          </SectionTitle>
          <ul className="space-y-1">
            {d.opportunities.map((o) => (
              <li key={o.id}>
                <Link href={`/opportunities?id=${o.id}`} className={cn(ROW, "hover:border-zinc-200")}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{o.title}</div>
                    {o.nextAction && <div className="truncate text-[11px] text-zinc-500">下一步：{o.nextAction}</div>}
                  </div>
                  <span className="shrink-0 text-[10px] text-zinc-400">{o.status}</span>
                  {o.deadline && (
                    <span
                      className={cn(
                        "shrink-0 text-[10px] tabular-nums",
                        o.deadline < toDateString() ? "text-rose-600" : "text-zinc-500"
                      )}
                    >
                      DDL {shortDate(o.deadline)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {d.contacts.length > 0 && (
        <>
          <SectionTitle href="/contacts" count={d.contacts.length}>
            该联系的人
          </SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {d.contacts.map((c) => (
              <Link
                key={c.id}
                href={`/contacts?id=${c.id}`}
                className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-700 hover:border-zinc-300"
              >
                {c.name}
                <span className="ml-1 text-zinc-400">{c.daysSince == null ? "从未" : `${c.daysSince} 天`}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {d.recent.length > 0 && (
        <>
          <SectionTitle count={d.recent.length}>近 14 日动作</SectionTitle>
          <ul className="space-y-0.5">
            {d.recent.map((r, i) => (
              <li key={i} className="flex gap-2 text-[11px] text-zinc-600">
                <span className="w-10 shrink-0 tabular-nums text-zinc-400">{shortDate(r.date)}</span>
                <span className="min-w-0 flex-1 truncate">{r.label}</span>
                <span className="shrink-0 text-zinc-400">{RECENT_LABEL[r.kind]}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

const RECENT_LABEL: Record<LifePowerDetail["recent"][number]["kind"], string> = {
  step: "步骤",
  habit: "习惯",
  contact: "联系",
  meeting: "会议",
  opportunity: "机会",
};


function ProjectSection({
  d,
  powerKey,
  onSetProject,
}: {
  d: LifePowerDetail;
  powerKey: LifePowerKey;
  onSetProject: (projectId: string, selected: boolean) => Promise<void>;
}) {
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const selectedCount = d.projects.filter((p) => p.selected).length;
  const options = d.projectOptions
    .filter((p) => p.power !== powerKey)
    .filter((p) => !query.trim() || `${p.name} ${p.category ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));

  const run = async (projectId: string, selected: boolean) => {
    setPending(projectId);
    try {
      await onSetProject(projectId, selected);
    } finally {
      setPending(null);
    }
  };

  return (
    <>
      <div className="mb-1.5 mt-4 flex items-center justify-between">
        <p className="text-xs font-semibold text-zinc-800">
          进阶项目 · 手动选入<span className="ml-1 font-normal text-zinc-400">{selectedCount}</span>
        </p>
        <button
          type="button"
          onClick={() => setPicking((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100"
        >
          <Plus className="h-3 w-3" />
          {picking ? "收起" : "选入项目"}
        </button>
      </div>

      {picking && (
        <div className="mb-2 rounded-lg border border-indigo-100 bg-indigo-50/40 p-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索项目或类别…"
            className="mb-1.5 w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm"
          />
          <ul className="max-h-56 space-y-0.5 overflow-y-auto">
            {options.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-md bg-white px-2 py-1 text-sm">
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                {p.category && <span className="shrink-0 text-[10px] text-zinc-400">{p.category}</span>}
                {isLifePowerKey(p.power) && (
                  <span className="shrink-0 text-[10px] text-amber-600">当前：{LIFE_POWER_META[p.power].label}</span>
                )}
                <button
                  type="button"
                  disabled={pending === p.id}
                  onClick={() => void run(p.id, true)}
                  className="shrink-0 rounded border border-indigo-200 px-1.5 py-0.5 text-[10px] text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                >
                  {isLifePowerKey(p.power) ? "改选入" : "选入"}
                </button>
              </li>
            ))}
            {options.length === 0 && <li className="px-2 py-1 text-[11px] text-zinc-400">没有可选的项目</li>}
          </ul>
        </div>
      )}

      {d.projects.length === 0 ? (
        <p className="text-[11px] text-zinc-500">还没有选入项目。点「选入项目」挑这一力的主线。</p>
      ) : (
        <ul className="space-y-1">
          {d.projects.map((p) => (
            <li key={p.id} className={ROW}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Link href={`/projects?id=${p.id}`} className="truncate font-medium text-zinc-800 hover:underline">
                    {p.name}
                  </Link>
                  {p.category && <span className="shrink-0 text-[10px] text-zinc-400">{p.category}</span>}
                  {!p.selected && <span className="shrink-0 text-[10px] text-indigo-500">其中的学习步骤</span>}
                </div>
                {p.nextStep && <div className="truncate text-[11px] text-zinc-500">下一步：{p.nextStep}</div>}
              </div>
              {p.total > 0 ? (
                <div className="w-16 shrink-0">
                  <div className="text-right text-[10px] tabular-nums text-zinc-500">
                    {p.done}/{p.total}
                  </div>
                  <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-zinc-200">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(p.done / p.total) * 100}%` }} />
                  </div>
                </div>
              ) : (
                <span className="shrink-0 text-[10px] text-zinc-400">无步骤</span>
              )}
              {p.selected && (
                <button
                  type="button"
                  disabled={pending === p.id}
                  onClick={() => void run(p.id, false)}
                  className="shrink-0 rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-500 hover:border-rose-200 hover:text-rose-600 disabled:opacity-50"
                >
                  移出
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
