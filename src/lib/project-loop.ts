import { differenceInCalendarDays, format, parseISO } from "date-fns";

/** 项目闭环理论与 SOP（页面 / API 共用） */

export const PROJECT_LOOP_SOP_SUMMARY =
  "进展 ≈ 起点优势 × 执行闭环。闭环 = 执行 → 反馈 → 修正 → 再执行；有可验证交付才算进环。";

export const PROJECT_LOOP_SOP_SECTIONS = [
  {
    title: "公式",
    lines: [
      "进展 = 起点优势 × 执行闭环。优势单独不够，闭环单独也不够。",
      "执行闭环最低配置：执行 + 反馈 + 修正 + 再执行（留下时间戳）。",
      "预测（交付什么）→ 行动（最小步骤）→ 证据（done）→ 更新 → 再预测。",
    ],
  },
  {
    title: "四类执行闭环（示例）",
    lines: [
      "研究项目类（Research）：日历步骤 / 里程碑 gate → 本页「行动力」色块。",
      "个人气质类（Life）：运动、英语、卫生/清洁 → 习惯 + Life 项目日闭环。",
      "学习类（Learning）：两条环不要混。快环 = Info 摘录→输出；慢环 = 深读书 / Science → 知识笔记 → Research，产出必须回流。",
      "商业类（StartUp）：组织力步骤 + 机会/推广窗口，同样看日闭环密度。",
      "日切分：运动 / 论文 / 学习 / 商业各占一块时间；混忙一天 ≠ 四环都转了。",
    ],
  },
  {
    title: "怎么统计（口径）",
    lines: [
      "只认项目「计划步骤」勾 done 且带 doneDate（通常来自日历/日计划映射的那一步）。",
      "日闭环 = 某个日期上，该项目至少有 1 个步骤完成；间隔 = 相邻两个有交付日之间的天数。",
      "里程碑闭环 = isMilestone 步骤完成。习惯打卡、纯会议、没勾步骤的「感觉做了」都不进统计。",
      "点开项目可看：上次闭环日、当天完成了哪些步骤、反馈与修正（可编辑）。",
    ],
  },
  {
    title: "执行 SOP（每天）",
    lines: [
      "打开日历/日计划 → 今日步骤做完立刻勾 done。",
      "勾完补一句「反馈」+「修正」（下一轮改什么）——这才是完整闭环。",
      "读完 Info 必须记笔记（有 tag）才算快环闭环，不只是刷完。",
      "论文进 Library 只算入库；写成知识笔记并链回 Research 问题，才算慢环转了一圈。",
      "收工前四问：今天练了？论文步骤勾了？学习有摘录或回流？商业有一步交付？",
    ],
  },
] as const;

export type ProjectLoopStepInput = {
  id: string;
  title: string;
  done: boolean;
  doneDate: string | null;
  isMilestone: boolean;
  sortOrder: number;
  feedback?: string | null;
  correction?: string | null;
  detail?: string | null;
};

export type ProjectLoopDayStep = {
  id: string;
  title: string;
  isMilestone: boolean;
  feedback: string | null;
  correction: string | null;
  detail: string | null;
};

/** 某一天的日闭环明细 */
export type ProjectLoopDay = {
  date: string;
  steps: ProjectLoopDayStep[];
};

export type ProjectLoopProjectInput = {
  id: string;
  name: string;
  status: string;
  planActive: boolean;
  categoryName: string | null;
  color: string;
  steps: ProjectLoopStepInput[];
};

export type ProjectLoopStat = {
  projectId: string;
  projectName: string;
  categoryName: string | null;
  color: string;
  planActive: boolean;
  status: string;
  /** 有步骤完成的日期（升序） */
  dayLoopDates: string[];
  dayLoopCount: number;
  /** 平均间隔（天）；仅 2+ 次闭环时有值 */
  dayLoopAvgInterval: number | null;
  /** 最近一次日闭环距 asOf 的天数；从未闭环为 null */
  daysSinceLastDayLoop: number | null;
  /** 最近一次日闭环日期 */
  lastDayLoopDate: string | null;
  milestoneLoopDates: string[];
  milestoneLoopCount: number;
  milestoneLoopAvgInterval: number | null;
  daysSinceLastMilestone: number | null;
  totalSteps: number;
  doneSteps: number;
  /** 最近若干次日闭环（新→旧），含步骤与反馈/修正 */
  recentLoops: ProjectLoopDay[];
};

export type ProjectLoopRanking = {
  byDayInterval: ProjectLoopStat[];
  byMilestoneInterval: ProjectLoopStat[];
  neverLooped: ProjectLoopStat[];
  stale: ProjectLoopStat[];
};

export type LoopBar = {
  key: string;
  label: string;
  value: number;
  hint: string;
  color: string;
  categoryName: string | null;
};

/** 类别级生活状况（合并该类别下所有项目的交付日） */
export type CategoryLoopStat = {
  categoryName: string;
  labelZh: string;
  color: string;
  projectCount: number;
  planActiveCount: number;
  withDayLoops: number;
  dayLoopCount: number;
  /** 合并类别内全部交付日后的平均间隔 */
  dayLoopAvgInterval: number | null;
  daysSinceLastDayLoop: number | null;
  staleCount: number;
  neverLoopedCount: number;
  /** ok | warn | critical — 便于一眼看生活块健康度 */
  health: "ok" | "warn" | "critical";
  healthHint: string;
};

export type ProjectLoopResult = {
  asOf: string;
  sopSummary: string;
  stats: ProjectLoopStat[];
  categories: CategoryLoopStat[];
  ranking: ProjectLoopRanking;
  charts: {
    dayIntervalBars: LoopBar[];
    milestoneIntervalBars: LoopBar[];
    loopCountBars: LoopBar[];
    categoryIntervalBars: LoopBar[];
  };
  totals: {
    projects: number;
    withDayLoops: number;
    withMilestoneLoops: number;
    medianDayInterval: number | null;
  };
};

/** 固定类别色（DB 色缺失时用）；与生活块语义对齐 */
export const CATEGORY_LOOP_COLORS: Record<string, string> = {
  Research: "#4f46e5",
  StartUp: "#d97706",
  Life: "#059669",
  "Learning Habit": "#0ea5e9",
  Professional: "#7c3aed",
  Collaboration: "#db2777",
  "Long-term Project": "#64748b",
  Course: "#0284c7",
  Outdoor: "#16a34a",
  Community: "#ea580c",
  Other: "#71717a",
  未分类: "#a1a1aa",
};

export const CATEGORY_LOOP_LABELS: Record<string, string> = {
  Research: "科研",
  StartUp: "创业",
  Life: "生活",
  "Learning Habit": "学习习惯",
  Professional: "职业",
  Collaboration: "协作",
  "Long-term Project": "长期",
  Course: "课程",
  Outdoor: "户外",
  Community: "社群",
  Other: "其他",
  未分类: "未分类",
};

export function categoryDisplayName(name: string | null | undefined): string {
  const key = name?.trim() || "未分类";
  return CATEGORY_LOOP_LABELS[key] ?? key;
}

export function categoryColor(name: string | null | undefined, fallback?: string): string {
  const key = name?.trim() || "未分类";
  return fallback || CATEGORY_LOOP_COLORS[key] || CATEGORY_LOOP_COLORS["未分类"]!;
}

function uniqueSortedDates(dates: string[]): string[] {
  return [...new Set(dates.filter(Boolean))].sort();
}

function avgIntervals(dates: string[]): number | null {
  if (dates.length < 2) return null;
  let sum = 0;
  for (let i = 1; i < dates.length; i++) {
    sum += differenceInCalendarDays(
      parseISO(`${dates[i]}T12:00:00`),
      parseISO(`${dates[i - 1]}T12:00:00`)
    );
  }
  return Math.round((sum / (dates.length - 1)) * 10) / 10;
}

function daysSince(last: string | null, asOf: string): number | null {
  if (!last) return null;
  return differenceInCalendarDays(
    parseISO(`${asOf}T12:00:00`),
    parseISO(`${last}T12:00:00`)
  );
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 0) return Math.round(((s[mid - 1]! + s[mid]!) / 2) * 10) / 10;
  return s[mid]!;
}

function buildRecentLoops(
  doneSteps: ProjectLoopStepInput[],
  dayLoopDates: string[],
  limit = 8
): ProjectLoopDay[] {
  const recentDates = [...dayLoopDates].reverse().slice(0, limit);
  return recentDates.map((date) => ({
    date,
    steps: doneSteps
      .filter((s) => s.doneDate === date)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => ({
        id: s.id,
        title: s.title,
        isMilestone: s.isMilestone,
        feedback: s.feedback ?? null,
        correction: s.correction ?? null,
        detail: s.detail ?? null,
      })),
  }));
}

export function computeProjectLoopStat(
  project: ProjectLoopProjectInput,
  asOf: string
): ProjectLoopStat {
  const doneSteps = project.steps.filter((s) => s.done && s.doneDate);
  const dayLoopDates = uniqueSortedDates(doneSteps.map((s) => s.doneDate!));
  const milestoneLoopDates = uniqueSortedDates(
    doneSteps.filter((s) => s.isMilestone).map((s) => s.doneDate!)
  );
  const lastDay = dayLoopDates[dayLoopDates.length - 1] ?? null;
  const lastMs = milestoneLoopDates[milestoneLoopDates.length - 1] ?? null;

  return {
    projectId: project.id,
    projectName: project.name,
    categoryName: project.categoryName,
    color: project.color,
    planActive: project.planActive,
    status: project.status,
    dayLoopDates,
    dayLoopCount: dayLoopDates.length,
    dayLoopAvgInterval: avgIntervals(dayLoopDates),
    daysSinceLastDayLoop: daysSince(lastDay, asOf),
    lastDayLoopDate: lastDay,
    milestoneLoopDates,
    milestoneLoopCount: milestoneLoopDates.length,
    milestoneLoopAvgInterval: avgIntervals(milestoneLoopDates),
    daysSinceLastMilestone: daysSince(lastMs, asOf),
    totalSteps: project.steps.length,
    doneSteps: project.steps.filter((s) => s.done).length,
    recentLoops: buildRecentLoops(doneSteps, dayLoopDates),
  };
}

function categoryHealth(
  avgInterval: number | null,
  daysSinceLast: number | null,
  withLoops: number,
  planActive: number
): { health: CategoryLoopStat["health"]; healthHint: string } {
  if (planActive === 0) {
    return { health: "ok", healthHint: "无活跃 plan" };
  }
  if (withLoops === 0) {
    return { health: "critical", healthHint: "活跃项目尚无日闭环" };
  }
  if (daysSinceLast != null && daysSinceLast >= 14) {
    return { health: "critical", healthHint: `${daysSinceLast} 天未在该类别闭环` };
  }
  if (daysSinceLast != null && daysSinceLast >= 7) {
    return { health: "warn", healthHint: `${daysSinceLast} 天未闭环 · 偏疏` };
  }
  if (avgInterval != null && avgInterval > 10) {
    return { health: "warn", healthHint: `平均 ${avgInterval} 天/次 · 节奏偏慢` };
  }
  if (avgInterval != null) {
    return { health: "ok", healthHint: `约 ${avgInterval} 天闭环一次` };
  }
  return { health: "warn", healthHint: "闭环次数不足，尚算不出间隔" };
}

function buildCategoryStats(stats: ProjectLoopStat[], asOf: string): CategoryLoopStat[] {
  const groups = new Map<string, ProjectLoopStat[]>();
  for (const s of stats) {
    const key = s.categoryName?.trim() || "未分类";
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }

  const out: CategoryLoopStat[] = [];
  for (const [categoryName, list] of groups) {
    const color = categoryColor(categoryName, list[0]?.color);
    const mergedDates = uniqueSortedDates(list.flatMap((s) => s.dayLoopDates));
    const last = mergedDates[mergedDates.length - 1] ?? null;
    const dayLoopAvgInterval = avgIntervals(mergedDates);
    const daysSinceLastDayLoop = daysSince(last, asOf);
    const planActiveCount = list.filter((s) => s.planActive).length;
    const withDayLoops = list.filter((s) => s.dayLoopCount > 0).length;
    const staleCount = list.filter(
      (s) =>
        s.planActive &&
        s.dayLoopCount > 0 &&
        s.daysSinceLastDayLoop != null &&
        s.daysSinceLastDayLoop >= 14
    ).length;
    const neverLoopedCount = list.filter(
      (s) => s.planActive && s.dayLoopCount === 0 && s.totalSteps > 0
    ).length;
    const { health, healthHint } = categoryHealth(
      dayLoopAvgInterval,
      daysSinceLastDayLoop,
      withDayLoops,
      planActiveCount
    );

    out.push({
      categoryName,
      labelZh: categoryDisplayName(categoryName),
      color,
      projectCount: list.length,
      planActiveCount,
      withDayLoops,
      dayLoopCount: mergedDates.length,
      dayLoopAvgInterval,
      daysSinceLastDayLoop,
      staleCount,
      neverLoopedCount,
      health,
      healthHint,
    });
  }

  // 有活跃 plan / 有闭环的排前面
  return out.sort((a, b) => {
    if (a.planActiveCount !== b.planActiveCount) return b.planActiveCount - a.planActiveCount;
    if (a.dayLoopCount !== b.dayLoopCount) return b.dayLoopCount - a.dayLoopCount;
    return a.labelZh.localeCompare(b.labelZh, "zh");
  });
}

export function buildProjectLoopResult(
  projects: ProjectLoopProjectInput[],
  asOf: string
): ProjectLoopResult {
  const stats = projects
    .map((p) => {
      const stat = computeProjectLoopStat(p, asOf);
      return {
        ...stat,
        color: categoryColor(p.categoryName, p.color),
      };
    })
    .sort((a, b) => a.projectName.localeCompare(b.projectName, "zh"));

  const categories = buildCategoryStats(stats, asOf);

  const withInterval = stats.filter((s) => s.dayLoopAvgInterval != null);
  const byDayInterval = [...withInterval].sort(
    (a, b) => (a.dayLoopAvgInterval ?? 999) - (b.dayLoopAvgInterval ?? 999)
  );

  const withMsInterval = stats.filter((s) => s.milestoneLoopAvgInterval != null);
  const byMilestoneInterval = [...withMsInterval].sort(
    (a, b) => (a.milestoneLoopAvgInterval ?? 999) - (b.milestoneLoopAvgInterval ?? 999)
  );

  const neverLooped = stats.filter(
    (s) => s.dayLoopCount === 0 && s.totalSteps > 0 && s.planActive
  );

  const stale = stats.filter(
    (s) =>
      s.planActive &&
      s.dayLoopCount > 0 &&
      s.daysSinceLastDayLoop != null &&
      s.daysSinceLastDayLoop >= 14
  );

  const shortName = (name: string) =>
    name.length > 14 ? `${name.slice(0, 12)}…` : name;

  const dayIntervalBars: LoopBar[] = byDayInterval.slice(0, 12).map((s) => ({
    key: s.projectId,
    label: shortName(s.projectName),
    value: s.dayLoopAvgInterval ?? 0,
    hint: `${s.projectName} · ${categoryDisplayName(s.categoryName)} · 平均 ${s.dayLoopAvgInterval} 天/次`,
    color: s.color,
    categoryName: s.categoryName,
  }));

  const milestoneIntervalBars: LoopBar[] = byMilestoneInterval.slice(0, 12).map((s) => ({
    key: s.projectId,
    label: shortName(s.projectName),
    value: s.milestoneLoopAvgInterval ?? 0,
    hint: `${s.projectName} · ${categoryDisplayName(s.categoryName)} · 里程碑 ${s.milestoneLoopAvgInterval} 天/次`,
    color: s.color,
    categoryName: s.categoryName,
  }));

  const loopCountBars: LoopBar[] = [...stats]
    .filter((s) => s.dayLoopCount > 0)
    .sort((a, b) => b.dayLoopCount - a.dayLoopCount)
    .slice(0, 12)
    .map((s) => ({
      key: s.projectId,
      label: shortName(s.projectName),
      value: s.dayLoopCount,
      hint: `${s.projectName} · ${categoryDisplayName(s.categoryName)} · ${s.dayLoopCount} 次`,
      color: s.color,
      categoryName: s.categoryName,
    }));

  const categoryIntervalBars: LoopBar[] = categories
    .filter((c) => c.dayLoopAvgInterval != null)
    .sort((a, b) => (a.dayLoopAvgInterval ?? 999) - (b.dayLoopAvgInterval ?? 999))
    .map((c) => ({
      key: c.categoryName,
      label: c.labelZh,
      value: c.dayLoopAvgInterval ?? 0,
      hint: `${c.labelZh} · 平均 ${c.dayLoopAvgInterval} 天/次 · ${c.dayLoopCount} 个交付日 · ${c.healthHint}`,
      color: c.color,
      categoryName: c.categoryName,
    }));

  return {
    asOf,
    sopSummary: PROJECT_LOOP_SOP_SUMMARY,
    stats,
    categories,
    ranking: { byDayInterval, byMilestoneInterval, neverLooped, stale },
    charts: {
      dayIntervalBars,
      milestoneIntervalBars,
      loopCountBars,
      categoryIntervalBars,
    },
    totals: {
      projects: stats.length,
      withDayLoops: stats.filter((s) => s.dayLoopCount > 0).length,
      withMilestoneLoops: stats.filter((s) => s.milestoneLoopCount > 0).length,
      medianDayInterval: median(
        withInterval.map((s) => s.dayLoopAvgInterval!).filter((n) => n > 0)
      ),
    },
  };
}

export function todayString(): string {
  return format(new Date(), "yyyy-MM-dd");
}
