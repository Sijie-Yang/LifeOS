import { MORNING_HABIT_NAMES } from "@/lib/personal-config";
/** 今日三段：开工（含逐项目对齐）→ 执行（自动排程）→ 记录（做了 / 没做 · 关账） */
export type DayPhase = "start" | "do" | "record";

export const DAY_PHASES: Array<{ key: DayPhase; label: string; hint: string }> = [
  { key: "start", label: "开工", hint: "状态 · 九力 · 逐项目对齐" },
  { key: "do", label: "执行", hint: "自动排程 · 习惯 · 时间块" },
  { key: "record", label: "记录", hint: "做了什么 · 没做什么 · 关账" },
];

/** 开工截止 / 记录开始的整点 */
export const DAY_START_UNTIL_HOUR = 11;
export const DAY_RECORD_FROM_HOUR = 20;

/** 每天开工时的逐项目对齐习惯（约 15 分钟，和 Claude 对话完成） */
export const PROJECT_ALIGN_HABIT_NAME = "逐项目对齐 · 15 分钟";

/**
 * 开工时先并列打卡的晨间习惯（按这个顺序显示），排在逐项目对齐之前。
 * 名单在 personal-config 里，可以在 private/ 覆盖；按名字开头匹配。
 */
export { MORNING_HABIT_NAMES };

/** 从当天习惯里挑出晨间习惯，按 MORNING_HABIT_NAMES 的顺序返回（带短名 label）；没排到当天的跳过 */
export function pickMorningHabits<T extends { name: string }>(habits: T[]): Array<T & { label: string }> {
  return MORNING_HABIT_NAMES.flatMap((n) => {
    const hit = habits.find((h) => h.name === n || h.name.startsWith(`${n} `));
    return hit ? [{ ...hit, label: n }] : [];
  });
}

/**
 * 自动选阶段：已关账 / 晚上 → 记录；开工过或过了上午 → 执行；否则开工。
 * 看过去的日子默认记录（回看），看未来默认开工。
 */
export function defaultDayPhase(input: {
  date: string;
  today: string;
  hour: number;
  started: boolean;
  closed: boolean;
}): DayPhase {
  if (input.date < input.today) return "record";
  if (input.date > input.today) return "start";
  if (input.closed || input.hour >= DAY_RECORD_FROM_HOUR) return "record";
  if (input.started || input.hour >= DAY_START_UNTIL_HOUR) return "do";
  return "start";
}
