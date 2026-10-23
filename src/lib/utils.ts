import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  differenceInDays,
  format,
  parseISO,
  startOfWeek,
  addDays,
  isToday,
  isSameDay,
} from "date-fns";
import { zhCN } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null | undefined, pattern = "yyyy-MM-dd") {
  if (!date) return "-";
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, pattern, { locale: zhCN });
}

export function formatYearMonth(date: Date | string | null | undefined) {
  if (!date) return "—";
  const raw = typeof date === "string" ? date : format(date, "yyyy-MM-dd");
  const d = parseISO(raw.length === 7 ? `${raw}-01` : raw);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "yyyy年M月", { locale: zhCN });
}

export function toMonthInput(date: Date | string | null | undefined) {
  if (!date) return "";
  return (typeof date === "string" ? date : format(date, "yyyy-MM-dd")).slice(0, 7);
}

export function monthInputToDate(value: string) {
  if (!value) return "";
  return value.length === 7 ? `${value}-01` : value;
}

/** `2026_DemoApp` / `2025-Thesis` → `DemoApp` / `Thesis` */
export function stripProjectYearPrefix(name: string) {
  const stripped = name.replace(/^(?:\d{4}[_.\-\s]+)+/, "").trim();
  return stripped || name;
}

export function formatDateTime(date: Date | string | null | undefined) {
  return formatDate(date, "yyyy-MM-dd HH:mm");
}

export function daysSinceContact(lastContactAt: Date | null | undefined): number | null {
  if (!lastContactAt) return null;
  return differenceInDays(new Date(), lastContactAt);
}

export function isOverdue(lastContactAt: Date | null | undefined, frequencyDays: number): boolean {
  const days = daysSinceContact(lastContactAt);
  if (days === null) return true;
  return days >= frequencyDays;
}

export { daysUntilBirthday, getWeekStart, getWeekRange, parseDaysOfWeek, parseMonthDays, isHabitScheduledOnDate, isHabitScheduledOnDateForHabit, getScheduledDatesInWeekForHabit, getAllScheduledDatesInWeekForHabit } from "./reminders";

export function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function toDateString(date: Date = new Date()): string {
  return format(date, "yyyy-MM-dd");
}

export function getWeekDays(baseDate: Date = new Date()): Date[] {
  const start = startOfWeek(baseDate, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export const WEEKDAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

/** 已结束的项目：不再出现在排程、九力、对齐、看板等「进行中」的地方 */
export const CLOSED_PROJECT_STATUSES = ["COMPLETED", "CANCELLED"];

export const PROJECT_STATUS: Record<string, { label: string; color: string }> = {
  PLANNING: { label: "规划中", color: "bg-slate-100 text-slate-600" },
  ACTIVE: { label: "进行中", color: "bg-emerald-100 text-emerald-700" },
  PAUSED: { label: "已暂停", color: "bg-amber-100 text-amber-700" },
  COMPLETED: { label: "已完成", color: "bg-blue-100 text-blue-700" },
  CANCELLED: { label: "已取消", color: "bg-zinc-100 text-zinc-500" },
};

export const PROJECT_PRIORITY: Record<string, { label: string; color: string }> = {
  LOW: { label: "低", color: "text-zinc-500" },
  MEDIUM: { label: "中", color: "text-blue-600" },
  HIGH: { label: "高", color: "text-amber-600" },
  URGENT: { label: "紧急", color: "text-red-600" },
};

export const CONTACT_TYPES: Record<string, string> = {
  call: "电话",
  message: "消息",
  meeting: "见面",
  email: "邮件",
};

export const HABIT_FREQUENCY: Record<string, string> = {
  DAILY: "每天",
  WEEKLY: "每周",
  MONTHLY: "每月",
};

export const HABIT_SCHEDULE_MODE: Record<string, string> = {
  none: "无时间表",
  weekly: "周时间块（同步到日历周视图）",
  monthly: "月时间块（每月固定日）",
};

/** 习惯是否设置了时间块（周/月模式 + 起止时间） */
export function habitHasTimeBlock(habit: {
  scheduleMode?: string | null;
  startTime?: string | null;
  endTime?: string | null;
}): boolean {
  const mode = habit.scheduleMode ?? "none";
  return mode !== "none" && !!habit.startTime && !!habit.endTime;
}

export const GOAL_AREAS: Record<string, { label: string; color: string }> = {
  career: { label: "事业", color: "bg-indigo-100 text-indigo-700" },
  health: { label: "健康", color: "bg-emerald-100 text-emerald-700" },
  finance: { label: "财务", color: "bg-amber-100 text-amber-700" },
  relationship: { label: "关系", color: "bg-pink-100 text-pink-700" },
  creation: { label: "创作", color: "bg-violet-100 text-violet-700" },
  learning: { label: "学习", color: "bg-blue-100 text-blue-700" },
};

export const GOAL_HORIZONS: Record<string, string> = {
  "1y": "1 年",
  "3y": "3 年",
  "5y": "5 年",
  "10y": "10 年",
};

export const GOAL_STATUS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "进行中", color: "bg-emerald-100 text-emerald-700" },
  PAUSED: { label: "已暂停", color: "bg-amber-100 text-amber-700" },
  COMPLETED: { label: "已完成", color: "bg-blue-100 text-blue-700" },
  ARCHIVED: { label: "已归档", color: "bg-zinc-100 text-zinc-600" },
};

export const PLATFORMS: Record<string, { label: string; color: string }> = {
  linkedin: { label: "LinkedIn", color: "bg-blue-100 text-blue-700" },
  substack: { label: "Substack", color: "bg-orange-100 text-orange-700" },
  xiaohongshu: { label: "小红书", color: "bg-red-100 text-red-700" },
  youtube: { label: "YouTube", color: "bg-red-100 text-red-700" },
  website: { label: "个人网站", color: "bg-violet-100 text-violet-700" },
  wechat: { label: "微信", color: "bg-green-100 text-green-700" },
  x: { label: "X / Twitter", color: "bg-zinc-100 text-zinc-700" },
  other: { label: "其他", color: "bg-zinc-100 text-zinc-600" },
};

export const CONTENT_STATUS: Record<string, { label: string; color: string }> = {
  idea: { label: "灵感库", color: "bg-zinc-100 text-zinc-600" },
  preparing: { label: "准备中", color: "bg-amber-100 text-amber-700" },
  scheduled: { label: "待发布", color: "bg-indigo-100 text-indigo-700" },
  published: { label: "已发布", color: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "已取消", color: "bg-zinc-200 text-zinc-500" },
};

export const CONTENT_STATUS_KEYS = [
  "idea",
  "preparing",
  "scheduled",
  "published",
  "cancelled",
] as const;

const LEGACY_CONTENT_STATUS: Record<string, string> = {
  draft: "preparing",
  outlining: "preparing",
  recording: "preparing",
  editing: "preparing",
  archived: "cancelled",
};

export function normalizeContentStatus(status: string): string {
  return LEGACY_CONTENT_STATUS[status] ?? status;
}

export function contentStatusMeta(status: string) {
  const key = normalizeContentStatus(status);
  return CONTENT_STATUS[key] ?? { label: status, color: "bg-zinc-100 text-zinc-600" };
}

export const NOTE_TYPES: Record<string, string> = {
  note: "笔记",
  idea: "灵感",
  sop: "SOP",
};

/** 项目笔记类型（type 字段） */
export const PROJECT_NOTE_TYPES: Record<string, { label: string; color: string }> = {
  overview: { label: "概览", color: "bg-indigo-100 text-indigo-700" },
  sop: { label: "SOP", color: "bg-violet-100 text-violet-700" },
  template: { label: "模板", color: "bg-amber-100 text-amber-700" },
  reference: { label: "参考", color: "bg-sky-100 text-sky-700" },
  source: { label: "信息源", color: "bg-cyan-100 text-cyan-800" },
  clip: { label: "浏览摘录", color: "bg-orange-100 text-orange-800" },
  insight: { label: "提炼", color: "bg-emerald-100 text-emerald-700" },
  log: { label: "日志", color: "bg-emerald-100 text-emerald-700" },
  note: { label: "笔记", color: "bg-zinc-100 text-zinc-600" },
};

export const PROJECT_NOTE_TEMPLATES: Record<string, { title: string; content: string }> = {
  overview: {
    title: "项目概览",
    content: "## 目标\n\n\n## 背景\n\n\n## 关键结果\n\n",
  },
  sop: {
    title: "SOP / 流程",
    content: "## 适用场景\n\n\n## 步骤\n\n1. \n2. \n3. \n\n## 检查清单\n\n- [ ] \n",
  },
  template: {
    title: "模板",
    content: "## 模板说明\n\n\n---\n\n（在此粘贴可复用模板）\n",
  },
  reference: {
    title: "参考资料",
    content: "## 链接\n\n| 名称 | 链接 | 说明 |\n|------|------|------|\n| | | |\n",
  },
  source: {
    title: "固定信息源",
    content: "## 槽位\n\n（观点 / 成长 / 前沿 / 慢读）\n\n## 来源\n\n| 名称 | 链接 | 频率 |\n|------|------|------|\n| | | 每日/每周 |\n",
  },
  clip: {
    title: "浏览摘录",
    content: `## 链接\n\n\n## 摘录 / 要点\n\n\n## 为什么点开\n\n\n## 槽位\n\n- [ ] 观点  - [ ] 成长  - [ ] 前沿  - [ ] 慢读\n\n## 下一步\n\n- [ ] 周六小红书输出\n- [ ] 转 Science Info 精读\n`,
  },
  insight: {
    title: "提炼",
    content: `## 核心观点（1–3 句）\n\n\n## 可迁移到哪里\n\n- 研究 / 生活 / 内容输出\n\n## 原文链接\n\n\n`,
  },
  log: {
    title: "进展日志",
    content: "## 日志\n\n### {{date}}\n\n- \n",
  },
  note: {
    title: "笔记",
    content: "",
  },
};

export const MEETING_STATUS: Record<string, { label: string; color: string }> = {
  Scheduled: { label: "已安排", color: "bg-indigo-100 text-indigo-700" },
  Tentative: { label: "待定", color: "bg-amber-100 text-amber-700" },
  NeedsReview: { label: "待确认", color: "bg-rose-100 text-rose-700" },
  Completed: { label: "已完成", color: "bg-emerald-100 text-emerald-700" },
  Cancelled: { label: "已取消", color: "bg-zinc-100 text-zinc-500" },
};

export const MEETING_CATEGORIES = [
  "Lecture",
  "Career",
  "Research",
  "Lab",
  "Collaboration",
  "Other",
] as const;

/** 场域层：时间窗口内的人·事机会（有 DDL 进时间线） */
export const OPPORTUNITY_STATUS: Record<string, { label: string; color: string }> = {
  Watching: { label: "观察中", color: "bg-zinc-100 text-zinc-700" },
  Active: { label: "推进中", color: "bg-amber-100 text-amber-800" },
  Won: { label: "已拿下", color: "bg-emerald-100 text-emerald-700" },
  Lost: { label: "未拿下", color: "bg-rose-100 text-rose-700" },
  Passed: { label: "已放弃", color: "bg-zinc-100 text-zinc-500" },
  Archived: { label: "已归档", color: "bg-zinc-100 text-zinc-500" },
};

/** Closed records: not open, not calendar, not reminders. */
export const OPPORTUNITY_CLOSED_STATUSES = ["Won", "Lost", "Passed", "Archived"] as const;

export const OPPORTUNITY_LANES = ["career", "life"] as const;
export type OpportunityLane = (typeof OPPORTUNITY_LANES)[number];

export const OPPORTUNITY_CATEGORIES = [
  "Career",
  "Research",
  "Funding",
  "Collaboration",
  "Partnership",
  "Industry",
  "Media",
  "Other",
] as const;

/** 业余 Networking / 丰富生活 */
export const LIFE_OPPORTUNITY_CATEGORIES = [
  "Social",
  "Hobby",
  "Sports",
  "Culture",
  "Food",
  "Community",
  "Travel",
  "Other",
] as const;

export const TRAVEL_STATUS: Record<string, { label: string; color: string }> = {
  Planned: { label: "计划中", color: "bg-indigo-100 text-indigo-700" },
  Confirmed: { label: "已确认", color: "bg-sky-100 text-sky-700" },
  InProgress: { label: "进行中", color: "bg-amber-100 text-amber-700" },
  Completed: { label: "已完成", color: "bg-emerald-100 text-emerald-700" },
  Cancelled: { label: "已取消", color: "bg-zinc-100 text-zinc-500" },
};

export const TRAVEL_CATEGORIES = ["Leisure", "Research", "Work", "Family", "Other"] as const;

export const PROJECT_CATEGORIES = [
  "Research", "StartUp", "Life", "Learning Habit", "Professional", "Collaboration",
  "Long-term Project", "Course", "Outdoor", "Community", "Other",
] as const;

export const CONTENT_FORMATS = ["video", "article", "carousel", "thread"] as const;
export const CONTENT_LANGUAGES = ["en", "zh", "bilingual"] as const;

export const ACCOUNT_TYPES: Record<string, string> = {
  cash: "现金",
  bank: "银行卡",
  credit: "信用卡",
  investment: "证券账户",
};

export const TRANSACTION_TYPES: Record<string, string> = {
  income: "收入",
  expense: "支出",
  transfer: "转账",
};

export { CURRENCIES, INVESTMENT_TYPES, fmtMoney, currencySymbol } from "./finance";

export { isToday, isSameDay, format, zhCN };
