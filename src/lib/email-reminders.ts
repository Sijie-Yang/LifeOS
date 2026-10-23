import { differenceInDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { toDateString } from "@/lib/utils";
import {
  DEFAULT_BEDTIME_TARGET,
  DEFAULT_EMAIL_REMIND_DAYS,
  DEFAULT_WIND_DOWN_CHECKLIST,
  parseEmailRemindDays,
} from "@/lib/app-settings";
import { sendEmail } from "@/lib/email";
import { isHabitScheduledOnDateForHabit } from "@/lib/reminders";

function isChoreHabitName(name: string) {
  return /整理|清洁|收拾|洗衣|衣屋|tidy/i.test(name);
}

function isWorkHabitName(name: string) {
  return /科研|论文|校招|写作|算法|申请/i.test(name);
}

export type DeadlineItem = {
  kind: "task" | "opportunity";
  id: string;
  title: string;
  date: string;
  daysLeft: number;
  priority: string;
  href: string;
  nextAction?: string | null;
};

export type DeadlineDigest = {
  today: string;
  tasks: DeadlineItem[];
  opportunities: DeadlineItem[];
  remindDays: number[];
};

function daysLeftFor(dateStr: string, today: string): number {
  return differenceInDays(new Date(`${dateStr}T12:00:00`), new Date(`${today}T12:00:00`));
}

export async function collectDeadlineDigest(
  today: string = toDateString(),
  remindDays: number[] = [...DEFAULT_EMAIL_REMIND_DAYS]
): Promise<DeadlineDigest> {
  const horizon = Math.max(...remindDays, 0);
  const horizonDate = toDateString(new Date(Date.now() + horizon * 86400000));

  const [tasks, opportunities] = await Promise.all([
    prisma.taskItem.findMany({
      where: {
        completed: false,
        cancelled: false,
        emailRemind: true,
        dueDate: { not: null },
        OR: [
          { dueDate: { lte: horizonDate } },
          // overdue always candidate when 0 is in remindDays
          { dueDate: { lt: today } },
        ],
      },
      orderBy: { dueDate: "asc" },
      take: 40,
    }),
    prisma.opportunity.findMany({
      where: {
        status: { in: ["Watching", "Active"] },
        emailRemind: true,
        deadline: { not: null, lte: horizonDate },
      },
      orderBy: { deadline: "asc" },
      take: 40,
    }),
  ]);

  const taskItems: DeadlineItem[] = [];
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const daysLeft = daysLeftFor(t.dueDate, today);
    const hit = daysLeft < 0 ? remindDays.includes(0) : remindDays.includes(daysLeft);
    if (!hit) continue;
    taskItems.push({
      kind: "task",
      id: t.id,
      title: t.title,
      date: t.dueDate,
      daysLeft,
      priority: t.priority,
      href: "/tasks",
    });
  }

  const oppItems: DeadlineItem[] = [];
  for (const o of opportunities) {
    if (!o.deadline) continue;
    const daysLeft = daysLeftFor(o.deadline, today);
    const hit = daysLeft < 0 ? remindDays.includes(0) : remindDays.includes(daysLeft);
    if (!hit) continue;
    oppItems.push({
      kind: "opportunity",
      id: o.id,
      title: o.title,
      date: o.deadline,
      daysLeft,
      priority: o.priority,
      href: `/opportunities?id=${o.id}`,
      nextAction: o.nextAction,
    });
  }

  return { today, tasks: taskItems, opportunities: oppItems, remindDays };
}

function labelDaysLeft(n: number): string {
  if (n < 0) return `逾期 ${-n} 天`;
  if (n === 0) return "今天截止";
  if (n === 1) return "明天截止";
  return `${n} 天后截止`;
}

export function renderDeadlineEmailHtml(
  digest: DeadlineDigest,
  baseUrl: string
): { subject: string; html: string; text: string } {
  const total = digest.tasks.length + digest.opportunities.length;
  const subject =
    total === 0
      ? `LifeOS · 早间 · 今日无截止提醒 (${digest.today})`
      : `LifeOS · 早间 · ${total} 项截止提醒 (${digest.today})`;

  const row = (item: DeadlineItem) => {
    const url = `${baseUrl.replace(/\/$/, "")}${item.href}`;
    const extra = item.nextAction ? `<br/><span style="color:#52525b">下一步：${escapeHtml(item.nextAction)}</span>` : "";
    return `<li style="margin:0 0 10px">
      <strong>${escapeHtml(item.title)}</strong>
      · ${labelDaysLeft(item.daysLeft)} · ${item.date}
      ${extra}
      <br/><a href="${url}">打开</a>
    </li>`;
  };

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#18181b">
  <h2 style="margin:0 0 8px">LifeOS 早间截止提醒</h2>
  <p style="color:#71717a;margin:0 0 16px">${digest.today} · 任务 ${digest.tasks.length} · 机会 ${digest.opportunities.length}</p>
  ${
    digest.tasks.length
      ? `<h3 style="margin:16px 0 8px">任务</h3><ul style="padding-left:18px">${digest.tasks.map(row).join("")}</ul>`
      : ""
  }
  ${
    digest.opportunities.length
      ? `<h3 style="margin:16px 0 8px">机会</h3><ul style="padding-left:18px">${digest.opportunities.map(row).join("")}</ul>`
      : ""
  }
  ${total === 0 ? "<p>今天没有命中提醒窗口的任务/机会。</p>" : ""}
  <p style="margin-top:24px;color:#a1a1aa;font-size:12px">在日计划页可开关邮件提醒 · 单条任务/机会可关闭「邮件提醒」</p>
</body></html>`;

  const textLines = [
    `LifeOS 截止提醒 · ${digest.today}`,
    `任务 ${digest.tasks.length} · 机会 ${digest.opportunities.length}`,
    ...digest.tasks.map((t) => `- [任务] ${t.title} · ${labelDaysLeft(t.daysLeft)} · ${t.date}`),
    ...digest.opportunities.map(
      (o) =>
        `- [机会] ${o.title} · ${labelDaysLeft(o.daysLeft)} · ${o.date}${o.nextAction ? ` · 下一步：${o.nextAction}` : ""}`
    ),
  ];

  return { subject, html, text: textLines.join("\n") };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type SendDeadlineRemindersOptions = {
  force?: boolean;
  dryRun?: boolean;
  date?: string;
};

export async function sendDeadlineReminders(opts: SendDeadlineRemindersOptions = {}) {
  const today = opts.date || toDateString();
  const settings = await prisma.appSettings.upsert({
    where: { id: "default" },
    create: {
      bedtimeTarget: DEFAULT_BEDTIME_TARGET,
      windDownChecklist: JSON.stringify(DEFAULT_WIND_DOWN_CHECKLIST),
    },
    update: {},
  });

  const remindDays = parseEmailRemindDays(settings.emailRemindDays);
  const digest = await collectDeadlineDigest(today, remindDays);
  const total = digest.tasks.length + digest.opportunities.length;

  const to = settings.reminderEmail?.trim() || process.env.REMINDER_EMAIL?.trim();
  if (!to) {
    return { skipped: true as const, reason: "reminderEmail empty", digest, total };
  }

  if (!settings.emailRemindersEnabled && !opts.force) {
    // Allow cloud env to enable via EMAIL_REMINDERS_ENABLED=1 without opening the UI once
    if (process.env.EMAIL_REMINDERS_ENABLED !== "1") {
      return {
        skipped: true as const,
        reason: "emailRemindersEnabled=false",
        digest,
        total,
      };
    }
  }

  if (total === 0 && !opts.force) {
    return { skipped: true as const, reason: "nothing due", digest, total };
  }

  const nudgeKey = "email-deadline-digest";
  if (!opts.force) {
    const existing = await prisma.nudgeLog.findUnique({
      where: { key_date: { key: nudgeKey, date: today } },
    });
    if (existing) {
      return { skipped: true as const, reason: "already sent today", digest, total };
    }
  }

  const baseUrl = process.env.LIFEOS_URL || "http://127.0.0.1:3000";
  const { subject, html, text } = renderDeadlineEmailHtml(digest, baseUrl);

  if (opts.dryRun || process.env.EMAIL_DRY_RUN === "1") {
    console.log("[deadline-email:dry-run]", { to, subject, total });
    return { skipped: false as const, dryRun: true as const, to, subject, digest, total };
  }

  const result = await sendEmail({ to, subject, html, text });
  if (!result.ok) {
    return { skipped: false as const, sent: false as const, error: result.error, digest, total };
  }

  await prisma.nudgeLog.upsert({
    where: { key_date: { key: nudgeKey, date: today } },
    create: { key: nudgeKey, date: today },
    update: { sentAt: new Date() },
  });

  return {
    skipped: false as const,
    sent: true as const,
    dryRun: result.dryRun === true,
    id: result.id,
    to,
    subject,
    digest,
    total,
  };
}

export type EveningCloseDigest = {
  today: string;
  closed: boolean;
  closedAt: string | null;
  hasWellness: boolean;
  uncheckedHabits: string[];
  leftoverTasks: { id: string; title: string; priority: string }[];
  windDown: string[];
  /** Work progress existed, chore habit did not — productive procrastination. */
  productiveAvoidance: boolean;
  missedChores: string[];
};

export async function collectEveningClose(today: string = toDateString()): Promise<EveningCloseDigest> {
  const [log, allHabits, todayCheckIns, leftoverTasks, settings] = await Promise.all([
    prisma.dailyLog.findUnique({ where: { date: today } }),
    prisma.habit.findMany({ where: { isActive: true } }),
    prisma.habitCheckIn.findMany({ where: { date: today, completed: true } }),
    prisma.taskItem.findMany({
      where: {
        cancelled: false,
        completed: false,
        OR: [{ dueDate: today }, { scheduledDate: today }],
      },
      take: 10,
    }),
    prisma.appSettings.findUnique({ where: { id: "default" } }),
  ]);

  const checkedIds = new Set(todayCheckIns.map((c) => c.habitId));
  const scheduled = allHabits.filter((h) => isHabitScheduledOnDateForHabit(h, today));
  const uncheckedHabits = scheduled.filter((h) => !checkedIds.has(h.id)).map((h) => h.name);
  const missedChores = scheduled
    .filter((h) => isChoreHabitName(h.name) && !checkedIds.has(h.id))
    .map((h) => h.name);
  const workDone = scheduled.some((h) => isWorkHabitName(h.name) && checkedIds.has(h.id));
  const productiveAvoidance = workDone && missedChores.length > 0;

  let windDown: string[] = [...DEFAULT_WIND_DOWN_CHECKLIST];
  try {
    const parsed = JSON.parse(settings?.windDownChecklist || "[]");
    if (Array.isArray(parsed) && parsed.length) windDown = parsed.map(String);
  } catch {
    /* keep default */
  }

  return {
    today,
    closed: Boolean(log?.closedAt),
    closedAt: log?.closedAt ? log.closedAt.toISOString() : null,
    hasWellness: log?.energy != null || log?.mood != null,
    uncheckedHabits,
    leftoverTasks: leftoverTasks.map((t) => ({ id: t.id, title: t.title, priority: t.priority })),
    windDown,
    productiveAvoidance,
    missedChores,
  };
}

export function renderEveningCloseEmail(
  digest: EveningCloseDigest,
  baseUrl: string
): { subject: string; html: string; text: string } {
  const dailyUrl = `${baseUrl.replace(/\/$/, "")}/daily`;
  if (digest.closed) {
    const subject = `LifeOS · 晚间 · 已关账，收工 (${digest.today})`;
    const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#18181b">
  <h2 style="margin:0 0 8px">今天已经关账</h2>
  <p>收工。去休息，不要再开新战线。</p>
  <p style="margin-top:24px;color:#a1a1aa;font-size:12px"><a href="${dailyUrl}">打开日计划</a></p>
</body></html>`;
    return { subject, html, text: `${subject}\n收工。去休息。` };
  }

  const subject = digest.productiveAvoidance
    ? `LifeOS · 晚间 · 工作有进度，家务还在拖 (${digest.today})`
    : `LifeOS · 晚间 · 该收工了 (${digest.today})`;
  const avoidance = digest.productiveAvoidance
    ? `<p style="background:#fef3c7;padding:10px 12px;border-radius:8px">今天有工作进度，但 ${digest.missedChores
        .map(escapeHtml)
        .join(" / ")} 没打卡。这是<strong>生产性拖延</strong>：用正经事推迟家务。最低版：清一个平面，再关账。</p>`
    : "";
  const habitList = digest.uncheckedHabits.length
    ? `<h3 style="margin:16px 0 8px">未打卡习惯</h3><ul style="padding-left:18px">${digest.uncheckedHabits
        .map((n) => `<li>${escapeHtml(n)}</li>`)
        .join("")}</ul>`
    : "";
  const taskList = digest.leftoverTasks.length
    ? `<h3 style="margin:16px 0 8px">今日未完成</h3><ul style="padding-left:18px">${digest.leftoverTasks
        .map((t) => `<li>${escapeHtml(t.title)}</li>`)
        .join("")}</ul>`
    : "";
  const wind = `<h3 style="margin:16px 0 8px">收工清单</h3><ul style="padding-left:18px">${digest.windDown
    .map((n) => `<li>${escapeHtml(n)}</li>`)
    .join("")}</ul>`;

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#18181b">
  <h2 style="margin:0 0 8px">该收工了</h2>
  <p style="color:#71717a;margin:0 0 16px">${digest.today} · 打开日计划关账，然后停下来。</p>
  <p>${digest.hasWellness ? "状态已记。" : "状态还没记（精力 / 心情）。"}</p>
  ${avoidance}
  ${habitList}
  ${taskList}
  ${wind}
  <p style="margin-top:24px"><a href="${dailyUrl}">去关账</a></p>
</body></html>`;

  const text = [
    subject,
    digest.hasWellness ? "状态已记" : "状态未记",
    digest.productiveAvoidance
      ? `生产性拖延：工作有进度，但未做 ${digest.missedChores.join(" / ")}。先清一个平面再关账。`
      : "",
    ...digest.uncheckedHabits.map((n) => `- 未打卡：${n}`),
    ...digest.leftoverTasks.map((t) => `- 未完成：${t.title}`),
    "收工清单：",
    ...digest.windDown.map((n) => `- ${n}`),
    dailyUrl,
  ].join("\n");

  return { subject, html, text };
}

export async function sendEveningCloseEmail(opts: SendDeadlineRemindersOptions = {}) {
  const today = opts.date || toDateString();
  const settings = await prisma.appSettings.upsert({
    where: { id: "default" },
    create: {
      bedtimeTarget: DEFAULT_BEDTIME_TARGET,
      windDownChecklist: JSON.stringify(DEFAULT_WIND_DOWN_CHECKLIST),
    },
    update: {},
  });

  const digest = await collectEveningClose(today);
  const to = settings.reminderEmail?.trim() || process.env.REMINDER_EMAIL?.trim();
  if (!to) {
    return { skipped: true as const, reason: "reminderEmail empty", digest };
  }

  if (!settings.emailRemindersEnabled && !opts.force) {
    if (process.env.EMAIL_REMINDERS_ENABLED !== "1") {
      return { skipped: true as const, reason: "emailRemindersEnabled=false", digest };
    }
  }

  const nudgeKey = "email-evening-close";
  if (!opts.force) {
    const existing = await prisma.nudgeLog.findUnique({
      where: { key_date: { key: nudgeKey, date: today } },
    });
    if (existing) {
      return { skipped: true as const, reason: "already sent today", digest };
    }
  }

  const baseUrl = process.env.LIFEOS_URL || "http://127.0.0.1:3000";
  const { subject, html, text } = renderEveningCloseEmail(digest, baseUrl);

  if (opts.dryRun || process.env.EMAIL_DRY_RUN === "1") {
    console.log("[evening-email:dry-run]", { to, subject });
    return { skipped: false as const, dryRun: true as const, to, subject, digest };
  }

  const result = await sendEmail({ to, subject, html, text });
  if (!result.ok) {
    return { skipped: false as const, sent: false as const, error: result.error, digest };
  }

  await prisma.nudgeLog.upsert({
    where: { key_date: { key: nudgeKey, date: today } },
    create: { key: nudgeKey, date: today },
    update: { sentAt: new Date() },
  });

  return {
    skipped: false as const,
    sent: true as const,
    dryRun: result.dryRun === true,
    id: result.id,
    to,
    subject,
    digest,
  };
}
