/**
 * Bot 日报（每个 bot 每天一个 JSON），由 /api/plan/ingest 合并成一次 align 预览。
 * proposed_ops 原样写库；habits[] 自动转 check_habit；其余文字进摘要并存档成 Note（save_bot_digest）。
 */
export type BotReport = {
  bot: string;
  date: string;
  done: string[];
  habits: string[];
  proposed_ops: unknown[];
  blockers: string[];
  needs_user: string[];
  tomorrow: string[];
};

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()) : [];
}

export function parseBotReport(input: unknown, fallbackDate: string): { report: BotReport | null; error: string | null } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { report: null, error: "日报需要是 JSON 对象" };
  const r = input as Record<string, unknown>;
  const bot = typeof r.bot === "string" ? r.bot.trim() : "";
  if (!bot) return { report: null, error: "日报缺 bot 字段" };
  const date = typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : fallbackDate;
  if (r.proposed_ops !== undefined && !Array.isArray(r.proposed_ops)) {
    return { report: null, error: `${bot}：proposed_ops 需要是数组` };
  }
  return {
    report: {
      bot,
      date,
      done: strList(r.done),
      habits: strList(r.habits),
      proposed_ops: Array.isArray(r.proposed_ops) ? r.proposed_ops : [],
      blockers: strList(r.blockers),
      needs_user: strList(r.needs_user),
      tomorrow: strList(r.tomorrow),
    },
    error: null,
  };
}

/** 合并后的人类可读摘要（不写库） */
export function summarizeReports(reports: BotReport[]): string {
  const lines: string[] = [];
  for (const r of reports) {
    lines.push(`## ${r.bot}（${r.date}）`);
    const sec = (title: string, items: string[]) => {
      if (items.length) lines.push(`${title}：`, ...items.map((x) => `- ${x}`));
    };
    sec("完成", r.done);
    sec("习惯", r.habits);
    sec("卡点", r.blockers);
    sec("需要你", r.needs_user);
    sec("明天", r.tomorrow);
    lines.push(`提议操作：${r.proposed_ops.length} 条`, "");
  }
  return lines.join("\n").trim();
}

/** habits[] 里的名字 → habit id。先全等，再忽略空格 / 「·」/ 大小写全等，再唯一包含匹配；对不上返回 null */
export function matchHabitName(name: string, habits: Array<{ id: string; name: string }>): string | null {
  const norm = (x: string) => x.toLowerCase().replace(/[\s·・•\-_]/g, "");
  const exact = habits.find((h) => h.name === name);
  if (exact) return exact.id;
  const n = norm(name);
  if (!n) return null;
  const loose = habits.filter((h) => norm(h.name) === n);
  if (loose.length === 1) return loose[0].id;
  const contains = habits.filter((h) => norm(h.name).includes(n) || n.includes(norm(h.name)));
  return contains.length === 1 ? contains[0].id : null;
}

/**
 * habits[]（今天已完成的习惯名）→ check_habit 操作。
 * proposed_ops 里已有同一习惯的 check_habit / uncheck_habit 时不重复生成；对不上的名字进 errors。
 */
export function habitOpsFromReport(
  report: BotReport,
  habits: Array<{ id: string; name: string }>
): { ops: Array<{ op: "check_habit"; habitId: string }>; errors: string[] } {
  const already = new Set(
    report.proposed_ops.flatMap((o) => {
      const r = (o ?? {}) as Record<string, unknown>;
      return (r.op === "check_habit" || r.op === "uncheck_habit") && typeof r.habitId === "string" ? [r.habitId] : [];
    })
  );
  const ops: Array<{ op: "check_habit"; habitId: string }> = [];
  const errors: string[] = [];
  for (const name of report.habits) {
    const id = matchHabitName(name, habits);
    if (!id) errors.push(`${report.bot}：habits 里的「${name}」对不上任何启用的习惯，没打卡`);
    else if (!already.has(id)) {
      already.add(id);
      ops.push({ op: "check_habit", habitId: id });
    }
  }
  return { ops, errors };
}

/** 有没有值得存档的文字（done / blockers / needs_user / tomorrow / habits） */
export function reportHasText(r: BotReport): boolean {
  return r.done.length + r.habits.length + r.blockers.length + r.needs_user.length + r.tomorrow.length > 0;
}

/** 明天的建议（给第二天早上的计划用） */
export function collectTomorrow(reports: BotReport[]): Array<{ bot: string; item: string }> {
  return reports.flatMap((r) => r.tomorrow.map((item) => ({ bot: r.bot, item })));
}
