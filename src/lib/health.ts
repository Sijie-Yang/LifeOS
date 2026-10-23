export const HEALTH_TIP_CATEGORIES = [
  "strategy",
  "body",
  "nutrition",
  "training",
  "sleep",
  "energy",
  "mindset",
] as const;

export type HealthTipCategory = (typeof HEALTH_TIP_CATEGORIES)[number];

export const HEALTH_TIP_CATEGORY_LABELS: Record<HealthTipCategory, string> = {
  strategy: "核心策略",
  body: "体态",
  nutrition: "饮食",
  training: "训练",
  sleep: "睡眠",
  energy: "精力",
  mindset: "心态",
};

export const HEALTH_TIP_CATEGORY_COLORS: Record<HealthTipCategory, string> = {
  strategy: "bg-rose-100 text-rose-800",
  body: "bg-orange-100 text-orange-800",
  nutrition: "bg-amber-100 text-amber-900",
  training: "bg-emerald-100 text-emerald-800",
  sleep: "bg-indigo-100 text-indigo-800",
  energy: "bg-violet-100 text-violet-800",
  mindset: "bg-sky-100 text-sky-800",
};

export type HealthTipDto = {
  id: string;
  category: string;
  title: string;
  content: string;
  pinned: boolean;
  sortOrder: number;
  updatedAt: string;
};

export type HealthDailyDto = {
  date: string;
  energy: number | null;
  mood: number | null;
  sleepHours: number | null;
  reflection: string | null;
  weightKg: number | null;
  waistCm: number | null;
  bodyNote: string | null;
};

export type HealthTrendPoint = {
  date: string;
  label: string;
  weightKg: number | null;
  waistCm: number | null;
  energy: number | null;
  mood: number | null;
  sleepHours: number | null;
};

export type HealthCheckinDto = {
  id: string;
  name: string;
  color: string;
  cue: string | null;
  checked: boolean;
  note: string | null;
  pushupReps: Record<string, number> | null;
  pushupTotal: number | null;
};

export type HealthWeekDay = {
  date: string;
  label: string;
  sleepHours: number | null;
  weightKg: number | null;
  energy: number | null;
  checks: boolean[];
};

export type HealthPayload = {
  date: string;
  entry: HealthDailyDto | null;
  latestWeight: number | null;
  checkins: HealthCheckinDto[];
  week: HealthWeekDay[];
};

export function mapHealthTip(row: {
  id: string;
  category: string;
  title: string;
  content: string;
  pinned: boolean;
  sortOrder: number;
  updatedAt: Date;
}): HealthTipDto {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    content: row.content,
    pinned: row.pinned,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapHealthDaily(row: {
  date: string;
  energy: number | null;
  mood: number | null;
  sleepHours: number | null;
  reflection: string | null;
  weightKg: number | null;
  waistCm: number | null;
  bodyNote: string | null;
}): HealthDailyDto {
  return {
    date: row.date,
    energy: row.energy,
    mood: row.mood,
    sleepHours: row.sleepHours,
    reflection: row.reflection,
    weightKg: row.weightKg,
    waistCm: row.waistCm,
    bodyNote: row.bodyNote,
  };
}
