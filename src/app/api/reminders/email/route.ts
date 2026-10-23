import { NextRequest, NextResponse } from "next/server";
import { sendDeadlineReminders, collectDeadlineDigest } from "@/lib/email-reminders";
import { prisma } from "@/lib/prisma";
import { parseEmailRemindDays, DEFAULT_BEDTIME_TARGET, DEFAULT_WIND_DOWN_CHECKLIST } from "@/lib/app-settings";
import { toDateString } from "@/lib/utils";
import { isEmailConfigured } from "@/lib/email";

function authorize(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || process.env.REMINDER_SECRET;
  const isCloud = Boolean(process.env.VERCEL || process.env.REQUIRE_CRON_SECRET === "1");
  if (!secret) return !isCloud; // local open; hosted must set secret
  const header = request.headers.get("authorization");
  const query = request.nextUrl.searchParams.get("secret");
  return header === `Bearer ${secret}` || query === secret;
}

/** Preview upcoming deadline digest (no send). */
export async function GET(request: NextRequest) {
  const settings = await prisma.appSettings.upsert({
    where: { id: "default" },
    create: {
      bedtimeTarget: DEFAULT_BEDTIME_TARGET,
      windDownChecklist: JSON.stringify(DEFAULT_WIND_DOWN_CHECKLIST),
    },
    update: {},
  });
  const remindDays = parseEmailRemindDays(settings.emailRemindDays);
  const today = request.nextUrl.searchParams.get("date") || toDateString();
  const digest = await collectDeadlineDigest(today, remindDays);
  return NextResponse.json({
    today,
    emailConfigured: isEmailConfigured(),
    emailRemindersEnabled: settings.emailRemindersEnabled,
    reminderEmail: settings.reminderEmail,
    remindDays,
    total: digest.tasks.length + digest.opportunities.length,
    digest,
  });
}

/** Send deadline email digest (tasks + opportunities). */
export async function POST(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const result = await sendDeadlineReminders({
    force: Boolean(body.force),
    dryRun: Boolean(body.dryRun),
    date: typeof body.date === "string" ? body.date : undefined,
  });
  return NextResponse.json(result);
}
