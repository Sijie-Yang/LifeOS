"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  categoryDisplayName,
  type CategoryLoopStat,
  type LoopBar,
  type ProjectLoopResult,
  type ProjectLoopStat,
} from "@/lib/project-loop";
import { cn } from "@/lib/utils";

function healthBadge(h: CategoryLoopStat["health"]) {
  if (h === "ok") return "bg-emerald-50 text-emerald-800";
  if (h === "warn") return "bg-amber-50 text-amber-900";
  return "bg-rose-50 text-rose-800";
}

function healthLabel(h: CategoryLoopStat["health"]) {
  if (h === "ok") return "正常";
  if (h === "warn") return "偏疏";
  return "告警";
}

function RankBarChart({
  title,
  subtitle,
  data,
  unit,
  showCategoryLegend = false,
  onBarClick,
}: {
  title: string;
  subtitle: string;
  data: LoopBar[];
  unit: string;
  showCategoryLegend?: boolean;
  onBarClick?: (key: string) => void;
}) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-500 py-6 text-center">
          暂无足够数据（至少需要 2 次闭环才能算间隔）
        </CardContent>
      </Card>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const legend = showCategoryLegend
    ? [...new Map(data.map((d) => [d.categoryName || "未分类", d.color])).entries()]
    : [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>
        {legend.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {legend.map(([name, color]) => (
              <span
                key={String(name)}
                className="inline-flex items-center gap-1 text-[10px] text-zinc-600"
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                {categoryDisplayName(String(name))}
              </span>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {data.map((d, i) => {
          const clickable = Boolean(onBarClick);
          const row = (
            <>
              <div className="flex items-center justify-between gap-2 text-xs mb-0.5">
                <span className="text-zinc-600 truncate min-w-0 inline-flex items-center gap-1.5">
                  <span className="text-zinc-400 shrink-0">{i + 1}.</span>
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="truncate">{d.label}</span>
                  {d.categoryName && (
                    <span className="text-[10px] text-zinc-400 shrink-0 hidden sm:inline">
                      {categoryDisplayName(d.categoryName)}
                    </span>
                  )}
                </span>
                <span className="font-medium text-zinc-800 shrink-0 tabular-nums">
                  {d.value}
                  {unit}
                </span>
              </div>
              <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(6, (d.value / max) * 100)}%`,
                    backgroundColor: d.color,
                  }}
                />
              </div>
            </>
          );
          if (clickable) {
            return (
              <button
                key={d.key}
                type="button"
                title={d.hint}
                className="w-full text-left rounded-md hover:bg-zinc-50 -mx-1 px-1 py-0.5"
                onClick={() => onBarClick?.(d.key)}
              >
                {row}
              </button>
            );
          }
          return (
            <div key={d.key} title={d.hint}>
              {row}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function CategoryOverview({ categories }: { categories: CategoryLoopStat[] }) {
  if (categories.length === 0) return null;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-zinc-900">生活块总览（按类别）</h2>
        <p className="text-[11px] text-zinc-400">颜色 = 类别 · 看平均多少天闭环一次</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map((c) => (
          <Card
            key={c.categoryName}
            className={cn(
              "overflow-hidden border-l-4",
              c.health === "critical" && "bg-rose-50/30",
              c.health === "warn" && "bg-amber-50/20"
            )}
            style={{ borderLeftColor: c.color }}
          >
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: c.color }}
                    />
                    <p className="text-sm font-semibold text-zinc-900 truncate">{c.labelZh}</p>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {c.projectCount} 项目 · {c.planActiveCount} 活跃 plan
                  </p>
                </div>
                <Badge className={healthBadge(c.health)}>{healthLabel(c.health)}</Badge>
              </div>

              <p className="text-2xl font-semibold tabular-nums text-zinc-900">
                {c.dayLoopAvgInterval != null ? (
                  <>
                    {c.dayLoopAvgInterval}
                    <span className="text-sm font-normal text-zinc-500 ml-1">天/次</span>
                  </>
                ) : (
                  <span className="text-lg text-zinc-400">—</span>
                )}
              </p>
              <p className="text-xs text-zinc-600 mt-1">{c.healthHint}</p>

              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-[11px] text-zinc-500">
                <span>{c.dayLoopCount} 个交付日</span>
                <span>
                  最近{" "}
                  {c.daysSinceLastDayLoop == null
                    ? "—"
                    : c.daysSinceLastDayLoop === 0
                      ? "今天"
                      : `${c.daysSinceLastDayLoop} 天前`}
                </span>
                {c.staleCount > 0 && (
                  <span className="text-rose-600">{c.staleCount} 个停滞</span>
                )}
                {c.neverLoopedCount > 0 && (
                  <span className="text-amber-700">{c.neverLoopedCount} 个未启动</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function RankTable({
  title,
  rows,
  empty,
  valueLabel,
  getValue,
  onSelect,
}: {
  title: string;
  rows: ProjectLoopStat[];
  empty: string;
  valueLabel: string;
  getValue: (s: ProjectLoopStat) => string;
  onSelect?: (s: ProjectLoopStat) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        {onSelect && (
          <p className="text-[11px] text-zinc-400 mt-0.5">点击项目查看上次闭环与反馈/修正</p>
        )}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-500 py-4 text-center">{empty}</p>
        ) : (
          <div className="space-y-2">
            {rows.map((s, i) => (
              <button
                key={s.projectId}
                type="button"
                onClick={() => onSelect?.(s)}
                className="w-full text-left flex items-center justify-between gap-3 rounded-lg border border-zinc-100 px-3 py-2 hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <span className="text-xs text-zinc-400 w-5 shrink-0">{i + 1}</span>
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">{s.projectName}</p>
                    <p className="text-[11px] text-zinc-400 truncate">
                      <span style={{ color: s.color }}>
                        {categoryDisplayName(s.categoryName)}
                      </span>
                      {s.planActive ? " · plan 开" : " · plan 关"}
                      {" · "}
                      {s.doneSteps}/{s.totalSteps} 步
                      {s.lastDayLoopDate && (
                        <span className="text-zinc-500">
                          {" · "}上次 {s.lastDayLoopDate}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-zinc-900 tabular-nums">{getValue(s)}</p>
                  <p className="text-[10px] text-zinc-400">{valueLabel}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ProjectLoopCharts({
  data,
  onSelectProject,
}: {
  data: ProjectLoopResult;
  onSelectProject?: (s: ProjectLoopStat) => void;
}) {
  const { totals, charts, ranking, categories } = data;
  const selectById = (id: string) => {
    const s = data.stats.find((x) => x.projectId === id);
    if (s) onSelectProject?.(s);
  };

  return (
    <div className="space-y-6">
      <CategoryOverview categories={categories} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-[11px] text-zinc-500">统计项目</p>
            <p className="text-2xl font-semibold text-zinc-900 mt-1">{totals.projects}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-[11px] text-zinc-500">有日闭环</p>
            <p className="text-2xl font-semibold text-zinc-900 mt-1">{totals.withDayLoops}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-[11px] text-zinc-500">生活块（类别）</p>
            <p className="text-2xl font-semibold text-zinc-900 mt-1">{categories.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-[11px] text-zinc-500">日闭环间隔中位</p>
            <p className="text-2xl font-semibold text-zinc-900 mt-1">
              {totals.medianDayInterval != null ? `${totals.medianDayInterval}d` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <RankBarChart
          title="类别平均间隔（生活状况）"
          subtitle="该类别所有交付日合并后，平均多少天闭环一次 · 色块=类别"
          data={charts.categoryIntervalBars}
          unit=" 天"
        />
        <RankBarChart
          title="项目日闭环间隔（按类别着色）"
          subtitle="越短越好 · 图例为类别色 · 点击项目看详情"
          data={charts.dayIntervalBars}
          unit=" 天"
          showCategoryLegend
          onBarClick={onSelectProject ? selectById : undefined}
        />
        <RankBarChart
          title="日闭环次数（按类别着色）"
          subtitle="累计有交付的天数 · 点击项目看详情"
          data={charts.loopCountBars}
          unit=" 次"
          showCategoryLegend
          onBarClick={onSelectProject ? selectById : undefined}
        />
        <RankBarChart
          title="里程碑闭环间隔（按类别着色）"
          subtitle="gate 之间的平均天数 · 点击项目看详情"
          data={charts.milestoneIntervalBars}
          unit=" 天"
          showCategoryLegend
          onBarClick={onSelectProject ? selectById : undefined}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">需要关注</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-rose-50 text-rose-700">≥14 天未日闭环</Badge>
                <span className="text-xs text-zinc-400">{ranking.stale.length}</span>
              </div>
              {ranking.stale.length === 0 ? (
                <p className="text-xs text-zinc-500">暂无停滞项目</p>
              ) : (
                <ul className="text-xs text-zinc-700 space-y-1">
                  {ranking.stale.slice(0, 8).map((s) => (
                    <li key={s.projectId} className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      <button
                        type="button"
                        onClick={() => onSelectProject?.(s)}
                        className="text-indigo-700 hover:underline truncate text-left"
                      >
                        {s.projectName}
                      </button>
                      <span className="text-zinc-400 shrink-0">
                        {categoryDisplayName(s.categoryName)} · {s.daysSinceLastDayLoop}d
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-zinc-100 text-zinc-600">plan 开但从未闭环</Badge>
                <span className="text-xs text-zinc-400">{ranking.neverLooped.length}</span>
              </div>
              {ranking.neverLooped.length === 0 ? (
                <p className="text-xs text-zinc-500">没有「有步骤却零完成」的活跃计划</p>
              ) : (
                <ul className="text-xs text-zinc-700 space-y-1">
                  {ranking.neverLooped.slice(0, 8).map((s) => (
                    <li key={s.projectId} className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      <button
                        type="button"
                        onClick={() => onSelectProject?.(s)}
                        className="text-indigo-700 hover:underline truncate text-left"
                      >
                        {s.projectName}
                      </button>
                      <span className="text-zinc-400 shrink-0">
                        {categoryDisplayName(s.categoryName)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <RankTable
          title="日闭环间隔榜（完整 · 类别色）"
          rows={ranking.byDayInterval}
          empty="至少 2 次日闭环的项目才会出现在此榜"
          valueLabel="天/次"
          getValue={(s) => `${s.dayLoopAvgInterval}`}
          onSelect={onSelectProject}
        />
      </div>

      <RankTable
        title="里程碑间隔榜（完整 · 类别色）"
        rows={ranking.byMilestoneInterval}
        empty="至少 2 次里程碑闭环才会上榜"
        valueLabel="天/次"
        getValue={(s) => `${s.milestoneLoopAvgInterval}`}
        onSelect={onSelectProject}
      />
    </div>
  );
}
