import type { PrismaClient } from "@prisma/client";

/** 默认的健康打卡习惯：通用、低门槛，按自己的情况改名或改提示 */
export const HEALTH_CHECKIN_HABITS = [
  {
    name: "饮食 · 均衡一餐",
    color: "#d97706",
    cue: "至少一餐有蔬菜和蛋白质，主食适量",
  },
  {
    name: "力量 · 俯卧撑",
    color: "#059669",
    cue: "按自己的水平做几组，记下每种的次数",
  },
  {
    name: "核心 · 平板支撑",
    color: "#2563eb",
    cue: "做完当天计划的组数即可",
  },
] as const;

export const HEALTH_CHECKIN_NAMES = HEALTH_CHECKIN_HABITS.map((h) => h.name);

/** 俯卧撑需要记次数（分变式）；另外两个只打卡 */
export const PUSHUP_HABIT_NAME = "力量 · 俯卧撑";

export const PUSHUP_VARIANTS = [
  { key: "chest_flat", no: 1, group: "胸部", angle: "标准", color: "#22c55e" },
  { key: "chest_diag", no: 2, group: "胸部", angle: "上斜", color: "#22c55e" },
  { key: "balanced_flat", no: 3, group: "均衡", angle: "标准", color: "#f97316" },
  { key: "balanced_diag", no: 4, group: "均衡", angle: "上斜", color: "#f97316" },
  { key: "arms_flat", no: 5, group: "手臂", angle: "窄距", color: "#3b82f6" },
  { key: "shoulders_diag", no: 6, group: "肩", angle: "下斜", color: "#737373" },
] as const;

export type PushupKey = (typeof PUSHUP_VARIANTS)[number]["key"];
export type PushupReps = Record<PushupKey, number>;

/** 打卡 note 里的 kind；旧数据可能是 "keep-pushup"，读的时候也认 */
const PUSHUP_NOTE_KIND = "pushup";
const LEGACY_PUSHUP_NOTE_KINDS = new Set([PUSHUP_NOTE_KIND, "keep-pushup"]);

export function emptyPushupReps(): PushupReps {
  return {
    chest_flat: 0,
    chest_diag: 0,
    balanced_flat: 0,
    balanced_diag: 0,
    arms_flat: 0,
    shoulders_diag: 0,
  };
}

export function parsePushupNote(note: string | null | undefined): PushupReps {
  const reps = emptyPushupReps();
  if (!note?.trim()) return reps;
  try {
    const parsed = JSON.parse(note) as { kind?: string; reps?: Record<string, unknown> };
    if (!parsed?.kind || !LEGACY_PUSHUP_NOTE_KINDS.has(parsed.kind) || !parsed.reps) return reps;
    for (const variant of PUSHUP_VARIANTS) {
      const raw = parsed.reps[variant.key];
      const n = Number(raw);
      reps[variant.key] = Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
    }
  } catch {
    return reps;
  }
  return reps;
}

export function serializePushupNote(reps: Partial<Record<string, number>>): string | null {
  const clean: Partial<PushupReps> = {};
  let total = 0;
  for (const variant of PUSHUP_VARIANTS) {
    const n = Math.max(0, Math.round(Number(reps[variant.key]) || 0));
    if (n > 0) {
      clean[variant.key] = n;
      total += n;
    }
  }
  if (total === 0) return null;
  return JSON.stringify({ kind: PUSHUP_NOTE_KIND, reps: clean, total });
}

export function pushupTotal(reps: Partial<Record<string, number>>): number {
  return PUSHUP_VARIANTS.reduce((sum, variant) => sum + (Number(reps[variant.key]) || 0), 0);
}

export async function ensureHealthCheckinHabits(prisma: PrismaClient) {
  const [existing, maxOrder] = await Promise.all([
    prisma.habit.findMany({
      where: { name: { in: [...HEALTH_CHECKIN_NAMES] } },
    }),
    prisma.habit.aggregate({ _max: { sortOrder: true } }),
  ]);

  const byName = new Map(existing.map((h) => [h.name, h]));
  let nextOrder = (maxOrder._max.sortOrder ?? 0) + 1;

  for (const spec of HEALTH_CHECKIN_HABITS) {
    const found = byName.get(spec.name);
    if (found) {
      const needsCue = found.cue !== spec.cue;
      if (!found.isActive || needsCue) {
        const updated = await prisma.habit.update({
          where: { id: found.id },
          data: {
            isActive: true,
            cue: spec.cue,
          },
        });
        byName.set(spec.name, updated);
      }
      continue;
    }
    const created = await prisma.habit.create({
      data: {
        name: spec.name,
        cue: spec.cue,
        color: spec.color,
        frequency: "DAILY",
        scheduleMode: "none",
        daysOfWeek: "[0,1,2,3,4,5,6]",
        isActive: true,
        sortOrder: nextOrder++,
      },
    });
    byName.set(spec.name, created);
  }

  return HEALTH_CHECKIN_HABITS.map((spec) => byName.get(spec.name)!);
}
