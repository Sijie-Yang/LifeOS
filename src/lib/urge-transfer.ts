import { addDays, format, parseISO } from "date-fns";
import type { WellnessScore } from "@/lib/wellness-scores";

/**
 * 冲动 · 转化：早上给想改掉的那个冲动（刷手机、冲动消费、拖延……）打强度分 → 按分数给今天的转移预案；
 * 冲动来了点一下记转移方式。数据在冲动管理（UrgeCategory「冲动转化」，默认私密）。
 * 转移成功（转移 / 硬扛）计入定力；当天有破戒就不算。
 */
export const URGE_TRANSFER_CATEGORY = "冲动转化";
export const URGE_TRANSFER_LABEL = "冲动 · 转化";

export type UrgeRedirect = "cold_shower" | "exercise" | "outside" | "work";

/** 冲动来了的选项：前四个是转移，后两个是硬扛 / 破戒 */
export const URGE_ACTIONS: Array<{
  key: UrgeRedirect | "surfed" | "gave_in";
  label: string;
  outcome: "redirected" | "surfed" | "gave_in";
}> = [
  { key: "cold_shower", label: "冷水澡", outcome: "redirected" },
  { key: "exercise", label: "运动", outcome: "redirected" },
  { key: "outside", label: "出门", outcome: "redirected" },
  { key: "work", label: "做事", outcome: "redirected" },
  { key: "surfed", label: "硬扛", outcome: "surfed" },
  { key: "gave_in", label: "破戒", outcome: "gave_in" },
];

export const REDIRECT_LABEL: Record<UrgeRedirect, string> = {
  cold_shower: "冷水澡",
  exercise: "运动",
  outside: "出门",
  work: "做事",
};

export function isUrgeRedirect(value: unknown): value is UrgeRedirect {
  return typeof value === "string" && value in REDIRECT_LABEL;
}

/** 早上打分后给出的今天预案 */
export const URGE_PLAN: Record<WellnessScore, string> = {
  1: "照常，留意一下就行",
  2: "照常；冲动来了先停 10 秒，换个场景",
  3: "备好一次转移：出门走 10 分钟，或换一件具体的小事做",
  4: "把今天的运动提前；冲动来了先离开当前场景",
  5: "现在就运动或出门，把诱因（手机 / 购物 App 等）放远，找人一起做事",
};

export type UrgeEventLite = { outcome: string; redirect?: string | null; date: string };

export function eventLabel(e: { outcome: string; redirect?: string | null }): string {
  if (e.outcome === "gave_in") return "破戒";
  if (e.outcome === "surfed") return "硬扛";
  return isUrgeRedirect(e.redirect) ? REDIRECT_LABEL[e.redirect] : "转移";
}

export function isTransfer(e: { outcome: string }): boolean {
  return e.outcome === "redirected" || e.outcome === "surfed";
}

/** 有转移、且当天没有破戒的日期（计入定力） */
export function transferDates(events: UrgeEventLite[]): string[] {
  const broke = new Set(events.filter((e) => e.outcome === "gave_in").map((e) => e.date));
  return [...new Set(events.filter((e) => isTransfer(e) && !broke.has(e.date)).map((e) => e.date))];
}

/**
 * 连续守住天数：从今天往回数。某天算「守住」= 有记录（早上打分 / 冲动记录 / 旧习惯打卡）且没有破戒。
 * 今天还没任何记录时从昨天开始数（今天还没过完，不算断）。
 */
export function keptStreak(input: {
  today: string;
  events: UrgeEventLite[];
  /** 有早上打分或旧习惯打卡的日期 */
  recordedDates: string[];
}): number {
  const broke = new Set(input.events.filter((e) => e.outcome === "gave_in").map((e) => e.date));
  const recorded = new Set([...input.recordedDates, ...input.events.map((e) => e.date)]);
  let day = input.today;
  if (!recorded.has(day) && !broke.has(day)) day = format(addDays(parseISO(`${day}T12:00:00`), -1), "yyyy-MM-dd");
  let streak = 0;
  while (recorded.has(day) && !broke.has(day)) {
    streak += 1;
    day = format(addDays(parseISO(`${day}T12:00:00`), -1), "yyyy-MM-dd");
  }
  return streak;
}
