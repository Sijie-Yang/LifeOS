import { differenceInCalendarDays, format, parseISO, subDays } from "date-fns";

/**
 * 九力（左人体六力 + 右群体三力）。
 * 归属规则只有两条，全部显式：
 * - 习惯：Habit.power 锁定（base = 生活底盘，不进九力）
 * - 项目：Project.power 手动选入；项目下的步骤 / 任务跟随项目
 * 另外：会议固定归链接力，机会固定归机会力。
 */
export type LifePowerKey =
  | "clean"
  | "vitality"
  | "calm"
  | "learning"
  | "influence"
  | "action"
  | "social"
  | "link"
  | "organize";

/** 左：人体六力（个人系统）；右：群体三力（以我为中心向外） */
export type LifePowerGroup = "body" | "group";

/** 习惯可锁定的值：九力之一，或生活底盘 */
export const HABIT_POWER_BASE = "base";
export type HabitPowerValue = LifePowerKey | typeof HABIT_POWER_BASE;

export type LifePowerLevel = "ok" | "warn" | "critical";

export type LifePowerLeverType =
  | "habit"
  | "task"
  | "plan_step"
  | "meeting"
  | "content"
  | "opportunity"
  | "urge"
  | "room";

export type LifePowerLever = {
  type: LifePowerLeverType;
  id: string;
  label: string;
  done: boolean;
};

export type LifePowerZone = {
  name: string;
  daysSince: number | null;
  score: number;
};

/** 选入该力的项目进度 */
export type LifePowerGrowth = {
  name: string;
  done: number;
  total: number;
};

export type LifePowerDimension = {
  key: LifePowerKey;
  label: string;
  role: string;
  group: LifePowerGroup;
  score: number;
  level: LifePowerLevel;
  daysSince: number | null;
  summary: string;
  todayLevers: LifePowerLever[];
  /** 近 7 日有动作的天数（每周检查） */
  weekDays: number;
  zones?: LifePowerZone[];
  growth: LifePowerGrowth[];
};

export type LifePowersResult = {
  dimensions: LifePowerDimension[];
  criticalCount: number;
  /** 今日事件中没有落进九力视野的部分（未锁定的习惯、未选入项目的步骤 / 任务） */
  unmatched: LifePowerLever[];
  eventTotal: number;
  eventMatched: number;
  /** 生活底盘习惯（不进九力） */
  base: { done: number; total: number };
};

export type MustDoResolved = {
  type: "habit" | "task" | "priority" | "plan_step" | "meeting" | "content" | "opportunity";
  id: string;
  label: string;
  done: boolean;
};

export const LIFE_POWERS: Array<{
  key: LifePowerKey;
  label: string;
  role: string;
  group: LifePowerGroup;
  /** 「N 天未{verb}」 */
  verb: string;
  description: string;
}> = [
  { key: "clean", label: "清洁力", role: "熵减力", group: "body", verb: "整理", description: "清洁卫生：分区整理，久不整理会越脏越急" },
  { key: "vitality", label: "活力", role: "外在力", group: "body", verb: "运动", description: "锻炼与身体能量；进阶 = 学新运动、把一项练深" },
  { key: "calm", label: "定力", role: "内在力", group: "body", verb: "独处", description: "独处、冥想与经典（论语 / 道德经）" },
  { key: "learning", label: "学习力", role: "输入", group: "body", verb: "学习", description: "学习必须绑定具体项目：为个人输出或专业能力服务" },
  { key: "influence", label: "网红力", role: "输出", group: "body", verb: "输出", description: "Personal Branding：选题、写作与发布" },
  { key: "action", label: "行动力", role: "生产", group: "body", verb: "推进", description: "科研与生产：把主线项目往前推" },
  { key: "social", label: "链接力", role: "以我为中心", group: "group", verb: "联系", description: "以我为中心维护关系：会议、联系、饭局" },
  { key: "link", label: "机会力", role: "抓机会", group: "group", verb: "推进机会", description: "发现、跟进、拿下机会；盯 DDL" },
  { key: "organize", label: "组织力", role: "管下游", group: "group", verb: "带团队", description: "管理与组织下游：StartUp、组会、协作" },
];

export const LIFE_POWER_META = Object.fromEntries(LIFE_POWERS.map((p) => [p.key, p])) as Record<
  LifePowerKey,
  (typeof LIFE_POWERS)[number]
>;

export function isLifePowerKey(value: string | null | undefined): value is LifePowerKey {
  return value != null && value in LIFE_POWER_META;
}

export function isHabitPowerValue(value: string | null | undefined): value is HabitPowerValue {
  return value === HABIT_POWER_BASE || isLifePowerKey(value);
}

/**
 * 新建习惯时的默认建议（只做建议，存下来后就锁定，不再按名字猜）。
 * 先匹配九力关键词，再匹配生活底盘关键词。
 */
const HABIT_SUGGESTIONS: Array<{ key: LifePowerKey; words: string[] }> = [
  { key: "clean", words: ["整理", "收拾", "清洁", "打扫", "衣屋", "tidy"] },
  { key: "vitality", words: ["运动", "锻炼", "健身", "跑步", "游泳", "swim", "gym", "打球", "篮球", "羽毛球", "网球", "足球", "瑜伽", "徒步"] },
  { key: "calm", words: ["冥想", "独处", "静坐", "正念", "论语", "道德经", "定力", "meditat"] },
  { key: "learning", words: ["阅读", "读书", "学习", "info", "课程", "learn"] },
  { key: "influence", words: ["写作", "发布", "推广", "branding", "小红书", "substack", "公众号"] },
  { key: "action", words: ["科研", "research", "论文", "paper", "实验"] },
  { key: "social", words: ["联系", "社交", "人脉", "networking", "吃饭", "聚会", "饭局"] },
  { key: "link", words: ["机会", "opportunit", "申请", "投递"] },
  { key: "organize", words: ["组会", "创业", "管理", "团队", "一对一", "1:1"] },
];
const BASE_WORDS = ["洗漱", "洗澡", "发型", "指甲", "卫生", "早睡", "补剂", "碳水", "蛋白", "咖啡", "饮食", "睡眠", "戒", "断微信", "断网", "复盘", "关账", "日计划", "周计划"];

export function suggestHabitPower(name: string): HabitPowerValue | null {
  const t = name.toLowerCase();
  for (const rule of HABIT_SUGGESTIONS) {
    if (rule.words.some((w) => t.includes(w.toLowerCase()))) return rule.key;
  }
  if (BASE_WORDS.some((w) => t.includes(w.toLowerCase()))) return HABIT_POWER_BASE;
  return null;
}

/** 学习类步骤标题：在其他力的项目里出现也计入学习力（学习绑定具体项目） */
export const LEARNING_STEP_KEYWORDS = ["学习", "读透", "精读", "阅读", "读书", "课程", "教程", "复习", "制卡", "learn", "course", "tutorial"] as const;

export function isLearningStep(title: string): boolean {
  const t = title.toLowerCase();
  return LEARNING_STEP_KEYWORDS.some((k) => t.includes(k));
}

/** 清洁分区（轮换整理用的通用分区）；任何归入清洁力的项目，步骤里写「今日整理 · 分区」即可识别 */
export const CLEAN_ZONES = [
  "卧室 · 衣柜",
  "卧室 · 衣物",
  "卫生间",
  "卧室 + 客厅主道",
  "厨房",
  "工作区",
  "入口",
  "储物",
  "洗衣",
  "地面",
  "卧室",
  "全屋",
] as const;

const DECAY_PER_DAY: Record<LifePowerKey, number> = {
  clean: 9,
  vitality: 10,
  calm: 9,
  learning: 9,
  influence: 8,
  action: 10,
  social: 8,
  link: 8,
  organize: 8,
};

const ZONE_DETAIL_RE = /今日整理\s*[·•]\s*(.+)/;

export function parseCleanZone(detail: string | null | undefined, title?: string): string | null {
  if (detail) {
    const m = detail.match(ZONE_DETAIL_RE);
    if (m?.[1]) return m[1].trim().split("\n")[0]!.trim();
  }
  if (title) {
    // fallback: use title prefix after first ·
    const parts = title.split("·");
    if (parts.length >= 2) return parts.slice(1).join("·").trim() || null;
  }
  return null;
}

export function daysBetween(fromDate: string, toDate: string): number {
  return differenceInCalendarDays(parseISO(`${toDate}T12:00:00`), parseISO(`${fromDate}T12:00:00`));
}

export function decayScore(daysSince: number | null, decayPerDay: number): number {
  if (daysSince == null) return 25;
  return Math.max(0, Math.min(100, Math.round(100 - daysSince * decayPerDay)));
}

export function levelFromScore(score: number): LifePowerLevel {
  if (score >= 70) return "ok";
  if (score >= 40) return "warn";
  return "critical";
}

export type LifePowersContext = {
  date: string;
  /** 今日排程内的习惯；power 为锁定的归属 */
  habits: Array<{
    id: string;
    name: string;
    checked: boolean;
    level?: string | null;
    power: string | null;
  }>;
  /** 全部启用习惯的锁定归属（历史要算上今天不排程的习惯，如每周一的组会） */
  lockedHabits: Array<{ id: string; power: string | null }>;
  /** 近期习惯打卡 */
  habitHistory: Array<{ habitId: string; date: string; level: string | null }>;
  /** 今日日历步骤；projectPower 为所属项目选入的力 */
  planStepsToday: Array<{
    id: string;
    title: string;
    detail: string | null;
    done: boolean;
    projectName: string;
    projectPower: string | null;
  }>;
  /** 选入九力的项目里，近期完成的步骤 */
  stepHistory: Array<{ power: string; title: string; detail: string | null; doneDate: string }>;
  /** 选入九力的项目（进度） */
  projects: Array<{ id: string; name: string; power: string; done: number; total: number }>;
  /** 今日会议（链接力） */
  meetings: Array<{ id: string; title: string; status: string }>;
  /** YYYY-MM-DD of last completed meeting or contact log */
  lastSocialDate: string | null;
  contactLogsToday: number;
  tasks: Array<{ id: string; title: string; completed: boolean; projectPower: string | null }>;
  /** Open opportunities for 机会力 (Watching / Active) */
  opportunities: Array<{
    id: string;
    title: string;
    status: string;
    deadline: string | null;
    activityDate: string;
    /** 今日推进标记：日期 = 今天点了推进；undo:日期 = 今天取消了推进 */
    pushedDate?: string | null;
  }>;
  /** YYYY-MM-DD of last opportunity create/update/won */
  lastLinkDate: string | null;
  /** 冲动 · 转化：有转移且没破戒的日期（计入定力） */
  urgeTransferDates?: string[];
  /** 今天的转移（定力的今日动作） */
  urgeTransfersToday?: LifePowerLever[];
  /** 房间清洁打勾的日期（计入清洁力） */
  roomCleanDates?: string[];
  /** 今天打勾的房间分区（清洁力的今日动作） */
  roomDoneToday?: LifePowerLever[];
  /** 房间每个分区最近一次打勾的日期（zone key → date），清洁力的「各区几天没清」 */
  roomZoneLastDone?: Record<string, string>;
  /** 房间分区名（zone key → 名称），和 roomZoneLastDone 一起用 */
  roomZoneNames?: Record<string, string>;
};

function lastDateOnOrBefore(dates: string[], asOf: string): string | null {
  let best: string | null = null;
  for (const d of dates) {
    if (d > asOf) continue;
    if (!best || d > best) best = d;
  }
  return best;
}

/** 近 days 天（含今日）里出现过的不同日期数 */
function activeDaysInWindow(dates: string[], asOf: string, days = 7): number {
  const window = new Set(recentDateStrings(asOf, days));
  return new Set(dates.filter((d) => window.has(d))).size;
}

/** 某一力今天的动作与历史：锁定习惯 + 选入项目的步骤 / 任务（学习力另含其他力项目里的学习步骤） */
function collect(ctx: LifePowersContext, key: LifePowerKey) {
  const habits = ctx.habits.filter((h) => h.power === key);
  const habitIds = new Set(ctx.lockedHabits.filter((h) => h.power === key).map((h) => h.id));
  const ownsStep = (s: { projectPower: string | null; title: string }) =>
    s.projectPower === key || (key === "learning" && s.projectPower != null && isLearningStep(s.title));

  const levers: LifePowerLever[] = [
    ...habits.map((h) => ({
      type: "habit" as const,
      id: h.id,
      label: h.name,
      done: h.checked && h.level !== "skip",
    })),
    ...ctx.planStepsToday.filter(ownsStep).map((s) => ({
      type: "plan_step" as const,
      id: s.id,
      label: s.projectPower === key ? s.title : `${s.title} → ${s.projectName}`,
      done: s.done,
    })),
    ...ctx.tasks
      .filter((t) => t.projectPower === key)
      .map((t) => ({ type: "task" as const, id: t.id, label: t.title, done: t.completed })),
  ];
  const history = [
    ...ctx.habitHistory.filter((h) => habitIds.has(h.habitId) && h.level !== "skip").map((h) => h.date),
    ...ctx.stepHistory
      .filter((s) => s.power === key || (key === "learning" && isLearningStep(s.title)))
      .map((s) => s.doneDate),
  ];
  return { levers, history };
}

function buildDimension(
  ctx: LifePowersContext,
  key: LifePowerKey,
  extra: { levers?: LifePowerLever[]; dates?: string[]; touchedToday?: boolean } = {}
): LifePowerDimension {
  const meta = LIFE_POWER_META[key];
  const own = collect(ctx, key);
  const levers = [...own.levers, ...(extra.levers ?? [])];
  const doneToday = extra.touchedToday || levers.some((l) => l.done);
  const dates = [...own.history, ...(extra.dates ?? []), ...(doneToday ? [ctx.date] : [])];
  const last = lastDateOnOrBefore(dates, ctx.date);
  const daysSince = last != null ? daysBetween(last, ctx.date) : null;
  let score = decayScore(daysSince, DECAY_PER_DAY[key]);
  if (doneToday) score = Math.max(score, 90);
  const weekDays = activeDaysInWindow(dates, ctx.date);

  const base =
    daysSince == null ? "尚无记录" : daysSince === 0 ? `今日已${meta.verb}` : `${daysSince} 天未${meta.verb}`;

  return {
    key,
    label: meta.label,
    role: meta.role,
    group: meta.group,
    score,
    level: levelFromScore(score),
    daysSince,
    summary: `${base} · 本周 ${weekDays}/7`,
    todayLevers: levers,
    weekDays,
    growth: ctx.projects
      .filter((p) => p.power === key)
      .map(({ name, done, total }) => ({ name, done, total })),
  };
}

/** 清洁力：有分区记录时附带各区「几天没清」 */
function cleanZones(ctx: LifePowersContext): LifePowerZone[] | undefined {
  // 有房间平面图的分区数据时，按房间分区算（每个分区最近一次打勾）
  if (ctx.roomZoneNames && Object.keys(ctx.roomZoneLastDone ?? {}).length > 0) {
    return Object.entries(ctx.roomZoneNames)
      .map(([key, name]) => {
        const doneDate = ctx.roomZoneLastDone?.[key];
        const daysSince = doneDate ? daysBetween(doneDate, ctx.date) : null;
        return { name, daysSince, score: decayScore(daysSince ?? 14, DECAY_PER_DAY.clean) };
      })
      .sort((a, b) => a.score - b.score);
  }
  const lastByZone = new Map<string, string>();
  for (const s of ctx.stepHistory) {
    if (s.power !== "clean") continue;
    const zone = parseCleanZone(s.detail, s.title);
    if (!zone) continue;
    const prev = lastByZone.get(zone);
    if (!prev || s.doneDate > prev) lastByZone.set(zone, s.doneDate);
  }
  if (lastByZone.size === 0) return undefined;
  for (const z of CLEAN_ZONES) if (!lastByZone.has(z)) lastByZone.set(z, "");
  return [...lastByZone.entries()]
    .map(([name, doneDate]) => {
      const daysSince = doneDate ? daysBetween(doneDate, ctx.date) : null;
      return { name, daysSince, score: decayScore(daysSince ?? 14, DECAY_PER_DAY.clean) };
    })
    .sort((a, b) => a.score - b.score);
}

function buildSocial(ctx: LifePowersContext): LifePowerDimension {
  const meetingLevers: LifePowerLever[] = ctx.meetings
    .filter((m) => m.status !== "Cancelled")
    .map((m) => ({ type: "meeting", id: m.id, label: m.title, done: m.status === "Completed" }));
  return buildDimension(ctx, "social", {
    levers: meetingLevers,
    dates: ctx.lastSocialDate ? [ctx.lastSocialDate] : [],
    touchedToday: ctx.contactLogsToday > 0,
  });
}

function buildLink(ctx: LifePowersContext): LifePowerDimension {
  const open = ctx.opportunities.filter((o) => o.status === "Watching" || o.status === "Active");
  const overdue = open.filter((o) => o.deadline && o.deadline < ctx.date);
  const dueToday = open.filter((o) => o.deadline === ctx.date);
  // 今天取消过推进的不算；点过推进的算（就算今天还没改别的）
  const undone = (o: (typeof ctx.opportunities)[number]) => o.pushedDate === `undo:${ctx.date}`;
  const pushed = (o: (typeof ctx.opportunities)[number]) =>
    !undone(o) && (o.pushedDate === ctx.date || (o.activityDate === ctx.date && o.status !== "Watching"));
  const touchedToday = ctx.opportunities.some((o) => !undone(o) && (o.activityDate === ctx.date || o.pushedDate === ctx.date));

  const oppLevers: LifePowerLever[] = [...dueToday, ...overdue, ...open.filter((o) => !o.deadline || o.deadline >= ctx.date)]
    .filter((o, i, arr) => arr.findIndex((x) => x.id === o.id) === i)
    .slice(0, 6)
    .map((o) => ({
      type: "opportunity",
      id: o.id,
      label:
        o.status === "Watching"
          ? `发现/跟进 · ${o.title}`
          : o.deadline === ctx.date
            ? `推进 DDL · ${o.title}`
            : `推进机会 · ${o.title}`,
      done: pushed(o),
    }));

  const dim = buildDimension(ctx, "link", {
    levers: oppLevers,
    dates: ctx.lastLinkDate ? [ctx.lastLinkDate] : [],
    touchedToday,
  });
  if (overdue.length === 0 && dueToday.length === 0) return dim;
  // DDL 是机会力唯一的额外扣分项
  const score = touchedToday ? dim.score : Math.max(0, dim.score - 12 * Math.min(overdue.length, 3));
  const ddl = overdue.length > 0 ? `${overdue.length} 个机会 DDL 已过` : `今日 ${dueToday.length} 个机会 DDL`;
  return { ...dim, score, level: levelFromScore(score), summary: `${ddl} · 本周 ${dim.weekDays}/7` };
}

export function computeLifePowers(ctx: LifePowersContext): LifePowersResult {
  const clean = buildDimension(ctx, "clean", { dates: ctx.roomCleanDates ?? [], levers: ctx.roomDoneToday ?? [] });
  const zones = cleanZones(ctx);
  const dimensions = [
    zones ? { ...clean, zones } : clean,
    buildDimension(ctx, "vitality"),
    buildDimension(ctx, "calm", { dates: ctx.urgeTransferDates ?? [], levers: ctx.urgeTransfersToday ?? [] }),
    buildDimension(ctx, "learning"),
    buildDimension(ctx, "influence"),
    buildDimension(ctx, "action"),
    buildSocial(ctx),
    buildLink(ctx),
    buildDimension(ctx, "organize"),
  ];

  const powerHabits = ctx.habits.filter((h) => h.power !== HABIT_POWER_BASE);
  const baseHabits = ctx.habits.filter((h) => h.power === HABIT_POWER_BASE);
  const unmatched: LifePowerLever[] = [
    ...powerHabits
      .filter((h) => !isLifePowerKey(h.power))
      .map((h) => ({ type: "habit" as const, id: h.id, label: `习惯未锁定 · ${h.name}`, done: h.checked })),
    ...ctx.planStepsToday
      .filter((s) => !isLifePowerKey(s.projectPower))
      .map((s) => ({ type: "plan_step" as const, id: s.id, label: `${s.projectName} · ${s.title}`, done: s.done })),
    ...ctx.tasks
      .filter((t) => !isLifePowerKey(t.projectPower))
      .map((t) => ({ type: "task" as const, id: t.id, label: t.title, done: t.completed })),
  ];
  const eventTotal = powerHabits.length + ctx.planStepsToday.length + ctx.tasks.length + ctx.meetings.length;

  return {
    dimensions,
    criticalCount: dimensions.filter((d) => d.level === "critical").length,
    unmatched,
    eventTotal,
    eventMatched: eventTotal - unmatched.length,
    base: { done: baseHabits.filter((h) => h.checked).length, total: baseHabits.length },
  };
}

/** Pick up to 3 urgent levers from critical dimensions (lowest score first). */
export function pickUrgentMustDos(powers: LifePowersResult): MustDoResolved[] {
  const critical = [...powers.dimensions]
    .filter((d) => d.level === "critical")
    .sort((a, b) => a.score - b.score);

  const out: MustDoResolved[] = [];
  const seen = new Set<string>();

  for (const dim of critical) {
    // 转移只记录已发生的，不会是待办
    const lever = dim.todayLevers.find((l) => !l.done);
    if (!lever || lever.type === "urge" || lever.type === "room") continue;
    const key = `${lever.type}:${lever.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      type: lever.type,
      id: lever.id,
      label: lever.label,
      done: lever.done,
    });
    if (out.length >= 3) break;
  }
  return out;
}

export function mergeMustDoItems(
  urgent: MustDoResolved[],
  stored: MustDoResolved[],
  max = 3
): MustDoResolved[] {
  const seen = new Set<string>();
  const out: MustDoResolved[] = [];
  for (const item of [...urgent, ...stored]) {
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

export function recentDateStrings(asOf: string, days: number): string[] {
  const end = parseISO(`${asOf}T12:00:00`);
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push(format(subDays(end, i), "yyyy-MM-dd"));
  }
  return out;
}

/** 弹窗：某一力当前关联的全部东西 */
export type LifePowerDetail = {
  key: LifePowerKey;
  habits: Array<{
    id: string;
    name: string;
    /** 执行日：每天 / 工作日 / 每周二、四、日 / 每月 1 号 */
    schedule: string;
    scheduledToday: boolean;
    checkedToday: boolean;
    /** 近 7 日（旧 → 新）：done = 已打卡，rest = 非执行日 */
    week: Array<"done" | "missed" | "rest">;
    lastDate: string | null;
  }>;
  /** 选入该力的项目（学习力另列其他力项目里的学习步骤） */
  projects: Array<{
    id: string;
    name: string;
    category: string | null;
    done: number;
    total: number;
    nextStep: string | null;
    lastDoneDate: string | null;
    /** false = 只是其中的学习步骤被计入（学习力），不能在这里移出 */
    selected: boolean;
  }>;
  /** 可选入的项目（未完成、未归档） */
  projectOptions: Array<{ id: string; name: string; category: string | null; power: string | null }>;
  tasks: Array<{ id: string; title: string; due: string | null; projectName: string | null }>;
  meetings: Array<{ id: string; title: string; date: string; time: string | null; status: string }>;
  opportunities: Array<{
    id: string;
    title: string;
    status: string;
    deadline: string | null;
    nextAction: string | null;
  }>;
  contacts: Array<{ id: string; name: string; daysSince: number | null; frequencyDays: number }>;
  recent: Array<{ date: string; label: string; kind: "step" | "habit" | "contact" | "meeting" | "opportunity" }>;
};
