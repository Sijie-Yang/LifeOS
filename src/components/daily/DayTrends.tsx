"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { fetchJson } from "@/components/ui/PageState";
import { cn } from "@/lib/utils";
import { formatClockHours, type TrendMetric, type TrendPoint, type TrendRange } from "@/lib/day-trend";

const RANGES: Array<{ key: TrendRange; label: string }> = [
  { key: "week", label: "周" },
  { key: "month", label: "月" },
  { key: "year", label: "年" },
];

/** 早 / 晚两条线：靛蓝 + 琥珀（已过色盲校验） */
const MORNING = "#4f46e5";
const EVENING = "#d97706";

/** offset：画图时加到值上（起床时间 +24，和就寝画在同一条「晚 → 次日早」的轴上） */
type Series = { key: TrendMetric; label: string; color: string; offset?: number };
type ChartSpec = {
  title: string;
  unit: string;
  /** 固定范围，或按数据算（体重、运动这类没有固定上限的） */
  domain: [number, number] | ((values: number[]) => [number, number]);
  series: Series[];
  format: (v: number) => string;
  /** 纵轴刻度的写法，默认原样 */
  tick?: (v: number) => string;
};

/** 从 0 开始，上限取数据最大值和 floor 中较大的，再取整到 step */
function fromZero(floor: number, step: number) {
  return (values: number[]): [number, number] => [0, Math.ceil(Math.max(floor, ...values) / step) * step];
}

const CHARTS: ChartSpec[] = [
  {
    title: "睡眠时长",
    unit: "小时",
    domain: [4, 10],
    series: [{ key: "sleepHours", label: "睡眠", color: MORNING }],
    format: (v) => `${v}h`,
  },
  {
    title: "精力",
    unit: "1–5 · 越高越足",
    domain: [1, 5],
    series: [
      { key: "energyMorning", label: "早", color: MORNING },
      { key: "energyEvening", label: "晚", color: EVENING },
    ],
    format: (v) => String(v),
  },
  {
    title: "内耗",
    unit: "1–5 · 越高越耗",
    domain: [1, 5],
    series: [
      { key: "drainMorning", label: "早", color: MORNING },
      { key: "drainEvening", label: "晚", color: EVENING },
    ],
    format: (v) => String(v),
  },
  {
    title: "习惯完成度",
    unit: "% · 当天排到的",
    domain: [0, 100],
    series: [{ key: "habitRate", label: "习惯", color: MORNING }],
    format: (v) => `${Math.round(v)}%`,
  },
  {
    title: "计划完成度",
    unit: "0–100 · Claude 复盘打分",
    domain: [0, 100],
    series: [{ key: "planScore", label: "计划", color: MORNING }],
    format: (v) => String(Math.round(v)),
  },
  {
    title: "作息",
    unit: "昨晚就寝 → 今早起床 · 两线之间就是睡眠",
    domain: [21, 35],
    series: [
      { key: "bedtime", label: "睡", color: MORNING },
      { key: "wakeTime", label: "起", color: EVENING, offset: 24 },
    ],
    format: formatClockHours,
    tick: formatClockHours,
  },
  {
    title: "体重",
    unit: "kg",
    // 按数据自动取范围，上下各留 2kg；还没有数据时给一个通用范围
    domain: (values) =>
      values.length ? [Math.floor(Math.min(...values)) - 2, Math.ceil(Math.max(...values)) + 2] : [40, 100],
    series: [{ key: "weightKg", label: "体重", color: MORNING }],
    format: (v) => `${v}kg`,
  },
  {
    title: "运动开始",
    unit: "时间 · 越平越说明习惯固定",
    domain: [5, 23],
    series: [{ key: "exerciseStart", label: "开始", color: MORNING }],
    format: formatClockHours,
    tick: formatClockHours,
  },
  {
    title: "运动时长",
    unit: "分钟",
    domain: fromZero(60, 30),
    series: [{ key: "exerciseMinutes", label: "运动", color: MORNING }],
    format: (v) => `${Math.round(v)}分`,
  },
  {
    title: "运动消耗",
    unit: "千卡",
    domain: fromZero(300, 100),
    series: [{ key: "exerciseCalories", label: "消耗", color: MORNING }],
    format: (v) => `${Math.round(v)}`,
  },
  {
    title: "冲动强度",
    unit: "1–5 · 早上打分",
    domain: [1, 5],
    series: [{ key: "urgeMorning", label: "冲动", color: MORNING }],
    format: (v) => String(v),
  },
  {
    title: "冲动次数",
    unit: "次 · 当天记录的冲动",
    domain: fromZero(3, 1),
    series: [{ key: "urgeCount", label: "冲动", color: MORNING }],
    format: (v) => `${Math.round(v * 10) / 10}次`,
  },
  {
    title: "转移成功率",
    unit: "% · 转移 + 硬扛 / 全部冲动",
    domain: [0, 100],
    series: [{ key: "transferRate", label: "转移", color: MORNING }],
    format: (v) => `${Math.round(v)}%`,
  },
  {
    title: "守住",
    unit: "% · 有记录且没破戒的日子",
    domain: [0, 100],
    series: [{ key: "keptRate", label: "守住", color: MORNING }],
    format: (v) => `${Math.round(v)}%`,
  },
  {
    title: "专注时长",
    unit: "分钟 · 完成的番茄钟",
    domain: fromZero(60, 30),
    series: [{ key: "focusMinutes", label: "专注", color: MORNING }],
    format: (v) => `${Math.round(v)}分`,
  },
];

/** 状态变化图：周 / 月 / 年切换，每个指标一张小图（同一时间轴） */
export function DayTrends({ date }: { date: string }) {
  const [range, setRange] = useState<TrendRange>("week");
  const [points, setPoints] = useState<TrendPoint[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ points: TrendPoint[] }>(`/api/daily-log/trend?range=${range}&date=${date}`, { force: true })
      .then((d) => !cancelled && setPoints(d.points))
      .catch(() => !cancelled && setPoints([]));
    return () => {
      cancelled = true;
    };
  }, [range, date]);

  return (
    <Card className="border-zinc-200/80">
      <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-100 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <TrendingUp className="h-4 w-4 text-indigo-600" />
          状态变化
          <span className="text-[11px] font-normal text-zinc-500">
            {range === "year" ? "近 52 周 · 每周平均" : range === "month" ? "近 30 天" : "近 7 天"}
          </span>
        </CardTitle>
        <div className="flex rounded-lg bg-zinc-100 p-0.5" role="tablist" aria-label="时间范围">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={range === r.key}
              onClick={() => setRange(r.key)}
              className={cn(
                "rounded-md px-2.5 py-0.5 text-xs font-medium",
                range === r.key ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 p-3 sm:grid-cols-3 lg:grid-cols-5">
        {!points ? (
          <p className="text-xs text-zinc-400">加载中…</p>
        ) : (
          CHARTS.map((spec) => <MiniLineChart key={spec.title} spec={spec} points={points} />)
        )}
      </CardContent>
    </Card>
  );
}

const W = 160;
const H = 64;
const PAD = { top: 5, right: 4, bottom: 14, left: 30 };

function MiniLineChart({ spec, points }: { spec: ChartSpec; points: TrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = points.length;
  /** 画在图上的位置（带 offset） */
  const plotted = (p: TrendPoint, s: Series) => {
    const v = p[s.key];
    return v == null ? null : v + (s.offset ?? 0);
  };
  const values = points.flatMap((p) => spec.series.map((s) => plotted(p, s))).filter((v): v is number => v != null);
  const [lo, hi] = typeof spec.domain === "function" ? spec.domain(values) : spec.domain;
  const x = (i: number) => PAD.left + (n <= 1 ? 0 : (i / (n - 1)) * (W - PAD.left - PAD.right));
  const y = (v: number) => {
    const clamped = Math.max(lo, Math.min(hi, v));
    return PAD.top + (1 - (clamped - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);
  };
  const showDots = n <= 31;

  /** 有值的点连成线，空值断开 */
  const segments = (s: Series) => {
    const out: string[] = [];
    let current: string[] = [];
    points.forEach((p, i) => {
      const v = plotted(p, s);
      if (v == null) {
        if (current.length) out.push(current.join(" "));
        current = [];
        return;
      }
      current.push(`${current.length ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    });
    if (current.length) out.push(current.join(" "));
    return out;
  };

  const latest = (key: TrendMetric) => [...points].reverse().find((p) => p[key] != null)?.[key] ?? null;
  const filled = points.some((p) => spec.series.some((s) => p[s.key] != null));
  const hovered = hover != null ? points[hover] : null;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = n <= 1 ? 0 : Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div>
      <div className="mb-0.5 flex items-baseline gap-1.5">
        <p className="shrink-0 text-[11px] font-semibold text-zinc-800" title={spec.unit}>
          {spec.title}
        </p>
        <div className="ml-auto flex min-w-0 items-center gap-1.5 text-[10px] text-zinc-500">
          {spec.series.map((s) => {
            const v = latest(s.key);
            return (
              <span key={s.key} className="flex items-center gap-1">
                {spec.series.length > 1 && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />}
                {spec.series.length > 1 && s.label}
                <span className="tabular-nums text-zinc-700">{v != null ? spec.format(v) : "—"}</span>
              </span>
            );
          })}
        </div>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`${spec.title}变化`}>
          {[lo, hi].map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#e4e4e7" strokeWidth={1} />
              <text x={PAD.left - 3} y={y(t) + 3.5} textAnchor="end" className="fill-zinc-400" fontSize={10}>
                {spec.tick ? spec.tick(t) : t}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            i === 0 || i === n - 1 ? (
              <text
                key={p.key}
                x={x(i)}
                y={H - 4}
                textAnchor={i === n - 1 && n > 1 ? "end" : i === 0 && n > 1 ? "start" : "middle"}
                className="fill-zinc-400"
                fontSize={10}
              >
                {p.label}
              </text>
            ) : null
          )}
          {hover != null && (
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="#a1a1aa" strokeWidth={1} />
          )}
          {spec.series.map((s) => (
            <g key={s.key}>
              {segments(s).map((d, i) => (
                <path key={i} d={d} fill="none" stroke={s.color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
              ))}
              {points.map((p, i) => {
                const v = plotted(p, s);
                if (v == null || (!showDots && hover !== i)) return null;
                return (
                  <circle
                    key={p.key}
                    cx={x(i)}
                    cy={y(v)}
                    r={hover === i ? 3 : 2}
                    fill={s.color}
                    stroke="#fff"
                    strokeWidth={1.5}
                  />
                );
              })}
            </g>
          ))}
          <rect
            x={PAD.left - 6}
            y={0}
            width={W - PAD.left - PAD.right + 12}
            height={H}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
        {!filled && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] text-zinc-400">
            暂无数据
          </p>
        )}
        {hovered && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] shadow-sm"
            style={{
              left: `${(x(hover!) / W) * 100}%`,
              transform: x(hover!) > W / 2 ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
            }}
          >
            <p className="whitespace-nowrap text-zinc-500">{hovered.from === hovered.to ? hovered.from : `${hovered.from} – ${hovered.to}`}</p>
            {spec.series.map((s) => {
              const v = hovered[s.key];
              return (
                <p key={s.key} className="flex items-center gap-1 text-zinc-800">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label}
                  <span className="tabular-nums">{v != null ? spec.format(v) : "未记录"}</span>
                </p>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
