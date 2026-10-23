import type { PushMessage } from "@/lib/push";

/**
 * 每分钟算一次「现在该推什么」（纯函数，好测）。每条推送有唯一 key，发过就记进 NudgeLog，不会重复。
 * - 计时到点
 * - 会议 / 时间块开始前 10 分钟
 * - 08:00 早上汇总：今天到期 / 过期的任务、3 天内的机会 DDL、今天排到的步骤数，提醒开工对齐
 * - 21:00 晚上：写今日记录、复制今日总结给 Claude、关账
 */
export type PlannedPush = PushMessage & { key: string; date: string };

export type PushInput = {
  today: string;
  /** 本地时间 HH:mm */
  now: string;
  timersDone: Array<{ id: string; title: string; minutes: number | null }>;
  meetings: Array<{ id: string; title: string; time: string | null }>;
  blocks: Array<{ id: string; title: string; time: string }>;
  tasksDue: Array<{ title: string; dueDate: string }>;
  deadlines: Array<{ title: string; deadline: string }>;
  stepsToday: number;
  /** 已经关账 */
  closed: boolean;
};

export const MORNING_AT = "08:00";
export const EVENING_AT = "21:00";
const LEAD_MINUTES = 10;

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 60 + m!;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000);
}

export function planPushes(input: PushInput): PlannedPush[] {
  const out: PlannedPush[] = [];
  const now = minutes(input.now);
  const d = input.today;

  for (const t of input.timersDone) {
    out.push({
      key: `timer:${t.id}`,
      date: d,
      title: `⏰ ${t.title} · 时间到`,
      message: t.minutes ? `${t.minutes} 分钟到了。` : "计时结束。",
      priority: 4,
      tags: ["alarm_clock"],
    });
  }

  const soon = (time: string | null) => {
    if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return false;
    const diff = minutes(time) - now;
    return diff > 0 && diff <= LEAD_MINUTES;
  };
  for (const m of input.meetings) {
    if (!soon(m.time)) continue;
    out.push({ key: `meeting:${m.id}`, date: d, title: `📅 ${m.time} · ${m.title}`, message: `${minutes(m.time!) - now} 分钟后开始。`, priority: 4, tags: ["calendar"] });
  }
  for (const b of input.blocks) {
    if (!soon(b.time)) continue;
    out.push({ key: `block:${b.id}`, date: d, title: `🗓 ${b.time} · ${b.title}`, message: `${minutes(b.time) - now} 分钟后开始。`, priority: 3, tags: ["spiral_calendar"] });
  }

  if (now >= minutes(MORNING_AT)) {
    const overdue = input.tasksDue.filter((t) => t.dueDate < d);
    const dueToday = input.tasksDue.filter((t) => t.dueDate === d);
    const ddl = input.deadlines.filter((o) => daysBetween(d, o.deadline) <= 3);
    const lines = [
      `今天排到 ${input.stepsToday} 个项目步骤 · 先开工：逐项目对齐 15 分钟`,
      dueToday.length ? `今天到期：${dueToday.map((t) => t.title).join("、")}` : null,
      overdue.length ? `已过期：${overdue.map((t) => t.title).join("、")}` : null,
      ddl.length
        ? `机会 DDL：${ddl.map((o) => `${o.title}（${daysBetween(d, o.deadline) < 0 ? "已过" : daysBetween(d, o.deadline) === 0 ? "今天" : `${daysBetween(d, o.deadline)} 天后`}）`).join("、")}`
        : null,
    ].filter(Boolean);
    out.push({
      key: "morning",
      date: d,
      title: "☀️ 今天",
      message: lines.join("\n"),
      priority: overdue.length || ddl.some((o) => o.deadline <= d) ? 4 : 3,
      tags: ["sunrise"],
    });
  }

  if (now >= minutes(EVENING_AT) && !input.closed) {
    out.push({
      key: "evening",
      date: d,
      title: "🌙 晚上复盘",
      message: "写今日记录（没做的写原因）→ 复制今日总结发给 Claude → 关账。计划 21:30 睡。",
      priority: 3,
      tags: ["crescent_moon"],
    });
  }
  return out;
}
