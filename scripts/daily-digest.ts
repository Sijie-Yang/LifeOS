/**
 * Local digest / email reminder. Email path talks to Prisma + Resend directly,
 * so Next.js / LifeOS does not need to be running.
 *
 * LaunchAgent (preferred): scripts/install-deadline-email-agent.sh
 * Manual: npx tsx scripts/daily-digest.ts email
 *
 * Env (.env):
 *   DATABASE_URL=file:./prisma/dev.db
 *   RESEND_API_KEY=re_xxx
 *   RESEND_FROM="LifeOS <onboarding@resend.dev>"
 *   REMINDER_EMAIL=you@example.com
 *   EMAIL_REMINDERS_ENABLED=1
 */

import { sendDeadlineReminders, sendEveningCloseEmail } from "../src/lib/email-reminders";
import { prisma } from "../src/lib/prisma";

const BASE_URL = process.env.LIFEOS_URL || "http://localhost:3000";

async function runBriefing(slot: string) {
  const date = new Date().toISOString().slice(0, 10);
  const key = slot === "evening" ? "evening-close" : "morning-briefing";

  const sentRes = await fetch(`${BASE_URL}/api/nudge?date=${date}`);
  const sentData = await sentRes.json();
  if (sentData.sent?.includes(key)) {
    console.log(`[daily-digest] ${key} already sent for ${date}`);
    return;
  }

  const briefingRes = await fetch(`${BASE_URL}/api/briefing?date=${date}`);
  if (!briefingRes.ok) {
    console.error("[daily-digest] briefing fetch failed", briefingRes.status);
    process.exit(1);
  }
  const briefing = await briefingRes.json();

  let message = "";
  if (slot === "morning") {
    const parts: string[] = [];
    if (briefing.mustDoCount > 0) parts.push(`${briefing.mustDoCount} 项必做`);
    if (briefing.tasks?.length) parts.push(`${briefing.tasks.length} 个任务`);
    if (briefing.meetings?.length) parts.push(`${briefing.meetings.length} 场会议`);
    message = parts.join(" · ") || "查看今日安排";
  } else {
    const parts: string[] = [];
    if (!briefing.closed) parts.push("尚未关账");
    if (briefing.uncheckedHabits?.length) parts.push(`${briefing.uncheckedHabits.length} 个习惯未打卡`);
    if (!briefing.hasWellness) parts.push("状态未记录");
    message = parts.join(" · ");
    if (!message) {
      console.log("[daily-digest] nothing to remind for evening");
      return;
    }
  }

  console.log(`[LifeOS ${slot}] ${message}`);
  console.log(`Open: ${BASE_URL}/briefing`);

  await fetch(`${BASE_URL}/api/nudge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, date }),
  });
}

async function runEmail(slot: "morning" | "evening", force = false) {
  const data =
    slot === "evening" ? await sendEveningCloseEmail({ force }) : await sendDeadlineReminders({ force });
  console.log(`[daily-digest:${slot}]`, JSON.stringify(data, null, 2));
  if ("error" in data && data.error) {
    process.exit(1);
  }
}

function resolveSlot(arg: string | undefined): "morning" | "evening" {
  if (arg === "evening" || arg === "close") return "evening";
  if (arg === "morning" || arg === "email") return "morning";
  const hour = new Date().getHours();
  return hour < 12 ? "morning" : "evening";
}

async function main() {
  const arg = process.argv[2];
  const force = process.argv.includes("--force");
  if (arg === "morning" || arg === "evening" || arg === "close" || arg === "email" || arg === "auto" || !arg) {
    await runEmail(resolveSlot(arg === "auto" ? undefined : arg), force);
    return;
  }
  await runBriefing(arg);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
