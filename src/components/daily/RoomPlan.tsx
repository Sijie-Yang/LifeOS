"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Home, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import {
  ROOM_METHOD,
  ROOM_SCORE_LABELS,
  ROOM_ZONES,
  roomMinutes,
  roomOverall,
  roomStrategy,
  type RoomScore,
  type RoomZoneKey,
  type RoomZones,
} from "@/lib/room-plan";

/** 分区填色：1 乱 → 5 净；没打分灰 */
const SCORE_FILL: Record<RoomScore, string> = {
  1: "#fda4af",
  2: "#fdba74",
  3: "#fde68a",
  4: "#d9f99d",
  5: "#6ee7b7",
};
const SCORE_CHIP: Record<RoomScore, string> = {
  1: "bg-rose-100 text-rose-700 border-rose-200",
  2: "bg-orange-100 text-orange-700 border-orange-200",
  3: "bg-amber-100 text-amber-700 border-amber-200",
  4: "bg-lime-100 text-lime-700 border-lime-200",
  5: "bg-emerald-100 text-emerald-700 border-emerald-200",
};
const SCORES: RoomScore[] = [1, 2, 3, 4, 5];

const TIER_LABEL = { must: "必做", quick: "顺手", keep: "保持" } as const;
const TIER_CHIP = {
  must: "bg-rose-50 text-rose-700 border-rose-100",
  quick: "bg-amber-50 text-amber-700 border-amber-100",
  keep: "bg-emerald-50 text-emerald-700 border-emerald-100",
} as const;

/**
 * 开工 · 房间平面图：点分区打当天的清洁分（1 乱 … 5 净），下面按分数生成今天的清洁策略。
 * 平面图是示例卧室的示意图，不按比例；分区定义在 src/lib/room-plan.ts。
 */
export function RoomPlan({
  zones,
  onScore,
  done = [],
  onToggleDone,
  carriedFrom,
  className,
}: {
  zones: RoomZones;
  /** 未传 = 只读（已关账 / 不是今天） */
  onScore?: (key: RoomZoneKey, score: RoomScore | null) => void;
  /** 今天已经打勾的分区 */
  done?: RoomZoneKey[];
  /** 清洁策略打勾 / 取消；打勾后该分区按「良」算 */
  onToggleDone?: (key: RoomZoneKey, done: boolean) => void;
  /** 今天还没打分、沿用的是哪天的分数 */
  carriedFrom?: string | null;
  className?: string;
}) {
  const [selected, setSelected] = useState<RoomZoneKey | null>(null);
  const overall = roomOverall(zones);
  const tasks = roomStrategy(zones);
  const minutes = roomMinutes(tasks);
  const rated = ROOM_ZONES.filter((z) => zones[z.key]).length;
  const zone = selected ? ROOM_ZONES.find((z) => z.key === selected) ?? null : null;
  const zoneScore = zone ? zones[zone.key] : undefined;
  const zoneTask = zone ? tasks.find((t) => t.key === zone.key) : undefined;

  return (
    <Card className={cn("border-zinc-200/80", className)}>
      <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-100 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Home className="h-4 w-4 text-sky-600" />
          房间 · 清洁度
          <span className="text-[11px] font-normal text-zinc-400">点分区打分 · 1 乱 … 5 净</span>
        </CardTitle>
        <span className={cn("text-xs font-semibold", overall == null ? "text-zinc-400" : overall >= 70 ? "text-emerald-700" : overall >= 40 ? "text-amber-700" : "text-rose-700")}>
          {overall == null ? "还没打分" : `${carriedFrom ? "沿用" : "今日"} ${overall}% · ${rated}/${ROOM_ZONES.length} 区`}
        </span>
      </CardHeader>
      <CardContent className="grid gap-4 p-4 lg:grid-cols-[1.35fr_1fr]">
        <div>
          <svg viewBox="0 0 420 380" className="w-full select-none" role="img" aria-label="房间平面图">
            {/* 墙体：卧室 x 20–280，走廊在东侧 x 280–400 */}
            <path d="M20 20 H280 V200 H400 V300 H20 Z" fill="#fafafa" stroke="#a1a1aa" strokeWidth="3" strokeLinejoin="round" />
            {/* 窗户：北墙 */}
            <line x1="20" y1="20" x2="280" y2="20" stroke="#7dd3fc" strokeWidth="6" />
            <text x="150" y="16" textAnchor="middle" fontSize="9" fill="#0369a1">窗户</text>
            {/* 走廊尽头的房门 */}
            <line x1="400" y1="236" x2="400" y2="282" stroke="#c2410c" strokeWidth="6" />
            <text x="411" y="262" textAnchor="middle" fontSize="8" fill="#c2410c" transform="rotate(90 411 262)">房门</text>
            {/* 卧室外的公共区域：下方单独一排 */}
            <line x1="20" y1="320" x2="400" y2="320" stroke="#e4e4e7" strokeWidth="1" strokeDasharray="4 3" />
            <text x="20" y="329" fontSize="8" fill="#71717a">公共区域（卧室外）</text>
            {/* 分区 */}
            {ROOM_ZONES.map((z) => {
              const score = zones[z.key];
              const active = selected === z.key;
              const cx = z.rect.x + z.rect.w / 2;
              const cy = z.rect.y + z.rect.h / 2;
              const narrow = z.rect.w < 30;
              return (
                <g
                  key={z.key}
                  onClick={() => setSelected(active ? null : z.key)}
                  className="cursor-pointer"
                  role="button"
                  aria-label={`${z.name}${score ? ` ${score} 分` : " 未打分"}`}
                >
                  <rect
                    x={z.rect.x}
                    y={z.rect.y}
                    width={z.rect.w}
                    height={z.rect.h}
                    rx="4"
                    fill={score ? SCORE_FILL[score] : "#f4f4f5"}
                    stroke={active ? "#4f46e5" : "#a1a1aa"}
                    strokeWidth={active ? 2.5 : 1}
                    opacity={score ? 0.9 : 1}
                  />
                  <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={narrow ? 8 : 10}
                    fontWeight={600}
                    fill="#27272a"
                    transform={narrow ? `rotate(-90 ${cx} ${cy})` : undefined}
                  >
                    {z.short ?? z.name}
                    {score ? ` ${score}` : ""}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[10px] text-zinc-500">
            {SCORES.map((s) => (
              <span key={s} className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: SCORE_FILL[s] }} />
                {s} {ROOM_SCORE_LABELS[s]}
              </span>
            ))}
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-zinc-100 ring-1 ring-zinc-300" />
              未打分
            </span>
            <span className="ml-auto">示意图 · 不按比例</span>
          </div>
        </div>

        <div className="space-y-3">
          {zone ? (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-900">{zone.name}</p>
                {zoneScore && (
                  <span className={cn("rounded border px-1.5 text-[11px]", SCORE_CHIP[zoneScore])}>
                    {zoneScore} {ROOM_SCORE_LABELS[zoneScore]}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-zinc-500">合格：{zone.standard}</p>
              <div className="mt-2 flex gap-1">
                {SCORES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={!onScore}
                    onClick={() => onScore?.(zone.key, zoneScore === s ? null : s)}
                    className={cn(
                      "flex-1 rounded-lg border py-1.5 text-xs font-semibold transition disabled:cursor-default",
                      zoneScore === s ? cn(SCORE_CHIP[s], "ring-2 ring-indigo-300") : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                    )}
                    title={`${s} ${ROOM_SCORE_LABELS[s]}${zoneScore === s ? " · 再点清掉" : ""}`}
                  >
                    {s}
                    <span className="ml-0.5 font-normal text-[10px]">{ROOM_SCORE_LABELS[s]}</span>
                  </button>
                ))}
              </div>
              {zoneTask && (
                <p className="mt-2 text-xs text-zinc-700">
                  <span className={cn("mr-1 rounded border px-1 text-[10px]", TIER_CHIP[zoneTask.tier])}>{TIER_LABEL[zoneTask.tier]}</span>
                  {zoneTask.text}
                  {zoneTask.minutes > 0 && <span className="text-zinc-400"> · 约 {zoneTask.minutes} 分钟</span>}
                </p>
              )}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-zinc-200 p-3 text-[11px] text-zinc-500">
              点平面图上的分区给它打分。也可以拍 10 秒房间视频发给 Claude，让它看完直接更新打分和策略。
            </p>
          )}

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="flex items-center gap-1 text-xs font-semibold text-zinc-700">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                今日清洁策略
              </p>
              {tasks.length > 0 && (
                <span className="text-[11px] text-zinc-400">
                  {done.length > 0 && <span className="mr-1 text-emerald-600">已做 {done.length} 项 ·</span>}
                  动手约 {minutes} 分钟
                </span>
              )}
            </div>
            <p className="mb-1.5 rounded-md bg-amber-50/60 px-2 py-1 text-[11px] leading-relaxed text-amber-900/80">{ROOM_METHOD}</p>
            {carriedFrom && (
              <p className="mb-1.5 text-[11px] text-zinc-500">
                分数沿用 {carriedFrom.slice(5).replace("-", "/")}：只点变化了的分区改分；做完一项打勾，那个分区自动变「良」。
              </p>
            )}
            {tasks.length === 0 ? (
              <p className="text-[11px] text-zinc-400">先给几个分区打分，策略会按「最乱的先做」自动排出来。</p>
            ) : (
              <ol className="space-y-1">
                {tasks.map((t) => {
                  const isDone = done.includes(t.key);
                  const checkable = Boolean(onToggleDone) && (isDone || t.tier !== "keep");
                  return (
                  <li
                    key={t.key}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border px-2 py-1.5 text-xs",
                      isDone
                        ? "border-emerald-100 bg-emerald-50/40 text-zinc-500"
                        : t.tier === "keep"
                          ? "border-zinc-100 text-zinc-400"
                          : "border-zinc-200 text-zinc-800",
                      selected === t.key && "ring-1 ring-indigo-300"
                    )}
                  >
                    {checkable ? (
                      <button
                        type="button"
                        onClick={() => onToggleDone?.(t.key, !isDone)}
                        className="mt-px shrink-0"
                        title={isDone ? "取消打勾" : "做完了，打勾"}
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Circle className="h-4 w-4 text-zinc-300 hover:text-emerald-500" />
                        )}
                      </button>
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}
                    <span className={cn("mt-px shrink-0 rounded border px-1 text-[10px]", isDone ? "border-emerald-200 bg-emerald-50 text-emerald-700" : TIER_CHIP[t.tier])}>
                      {isDone ? "已做" : TIER_LABEL[t.tier]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <button type="button" className="font-semibold hover:underline" onClick={() => setSelected(t.key)}>
                        {t.zone}
                      </button>
                      <span className="text-zinc-400"> {t.score}</span> · {t.text}
                      {t.minutes > 0 && <span className="text-zinc-400"> · {t.minutes} 分钟</span>}
                    </span>
                  </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
