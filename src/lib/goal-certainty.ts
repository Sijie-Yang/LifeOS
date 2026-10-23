export type CertaintyLabel = "空想" | "起步" | "在路上" | "系统化";

export type CertaintyDimension = {
  ready: boolean;
  hint: string;
};

export type GoalCertainty = {
  people: CertaintyDimension;
  affairs: CertaintyDimension;
  things: CertaintyDimension;
  field: CertaintyDimension;
  momentum: boolean;
  score: number;
  label: CertaintyLabel;
  gaps: string[];
};

export type GoalCertaintyInput = {
  area: string;
  budgetAmount: number | null;
  resourceNote: string | null;
  whyItMatters: string | null;
  contactCount: number;
  activeProjectCount: number;
  actionableAffairCount: number;
  scheduleBlockCount: number;
  scheduledHabitCount: number;
  hasRecentActivity: boolean;
};

export function computeGoalCertainty(input: GoalCertaintyInput): GoalCertainty {
  const peopleReady = input.contactCount >= 1;
  const affairsReady =
    input.activeProjectCount >= 1 || input.actionableAffairCount >= 1;
  const thingsReady =
    input.area === "finance"
      ? input.budgetAmount != null && input.budgetAmount > 0
      : input.budgetAmount != null || !!(input.resourceNote && input.resourceNote.trim());
  const fieldReady = input.scheduleBlockCount >= 1 || input.scheduledHabitCount >= 1;

  const people: CertaintyDimension = {
    ready: peopleReady,
    hint: peopleReady
      ? `已关联 ${input.contactCount} 位关键人物`
      : "还缺关键人物 — 谁可以帮助或监督这个目标？",
  };

  const affairs: CertaintyDimension = {
    ready: affairsReady,
    hint: affairsReady
      ? input.activeProjectCount >= 1
        ? `${input.activeProjectCount} 个进行中项目`
        : "已有可执行的下一步行动"
      : "还缺具体行动 — 创建项目或设定带截止日的任务",
  };

  const things: CertaintyDimension = {
    ready: thingsReady,
    hint: thingsReady
      ? input.budgetAmount != null
        ? `预算 ¥${input.budgetAmount.toLocaleString()}`
        : "资源已记录"
      : input.area === "finance"
        ? "财务目标需要设定预算金额"
        : "还缺资源规划 — 设定预算或记录所需资源",
  };

  const field: CertaintyDimension = {
    ready: fieldReady,
    hint: fieldReady
      ? `${input.scheduleBlockCount} 个时间块 · ${input.scheduledHabitCount} 个排程习惯`
      : "还缺时间/场景 — 在时间表中预留专属时段",
  };

  const dimensionScore =
    (peopleReady ? 20 : 0) +
    (affairsReady ? 20 : 0) +
    (thingsReady ? 20 : 0) +
    (fieldReady ? 20 : 0);
  const momentumScore = input.hasRecentActivity ? 20 : 0;
  const score = dimensionScore + momentumScore;

  let label: CertaintyLabel;
  if (score >= 75) label = "系统化";
  else if (score >= 50) label = "在路上";
  else if (score >= 25) label = "起步";
  else label = "空想";

  const gaps: string[] = [];
  if (!peopleReady) gaps.push("人");
  if (!affairsReady) gaps.push("事");
  if (!thingsReady) gaps.push("物");
  if (!fieldReady) gaps.push("场");
  if (!input.hasRecentActivity) gaps.push("动量");

  return {
    people,
    affairs,
    things,
    field,
    momentum: input.hasRecentActivity,
    score,
    label,
    gaps,
  };
}

export const CERTAINTY_LABELS: Record<
  CertaintyLabel,
  { color: string; description: string }
> = {
  空想: { color: "bg-zinc-100 text-zinc-600", description: "四维未齐，仍是愿望" },
  起步: { color: "bg-amber-100 text-amber-700", description: "开始填充，方向初现" },
  在路上: { color: "bg-blue-100 text-blue-700", description: "大部分就绪，持续执行" },
  系统化: { color: "bg-emerald-100 text-emerald-700", description: "人事物场齐备，有动量" },
};
