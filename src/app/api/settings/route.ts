import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_BEDTIME_TARGET,
  DEFAULT_EMAIL_REMIND_DAYS,
  DEFAULT_WIND_DOWN_CHECKLIST,
  parseEmailRemindDays,
} from "@/lib/app-settings";
import { isEmailConfigured } from "@/lib/email";

export async function GET() {
  let settings = await prisma.appSettings.upsert({
    where: { id: "default" },
    create: { bedtimeTarget: DEFAULT_BEDTIME_TARGET },
    update: {},
  });
  if (!settings.bedtimeTarget) {
    settings = await prisma.appSettings.update({
      where: { id: "default" },
      data: { bedtimeTarget: DEFAULT_BEDTIME_TARGET },
    });
  }
  let checklist: string[] = [...DEFAULT_WIND_DOWN_CHECKLIST];
  try {
    checklist = JSON.parse(settings.windDownChecklist);
  } catch {
    /* keep default */
  }
  return NextResponse.json({
    ...settings,
    bedtimeTarget: settings.bedtimeTarget ?? DEFAULT_BEDTIME_TARGET,
    windDownChecklistParsed: checklist,
    emailRemindDaysParsed: parseEmailRemindDays(settings.emailRemindDays),
    emailConfigured: isEmailConfigured(),
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const update: {
    bedtimeTarget?: string | null;
    windDownChecklist?: string;
    reminderEmail?: string | null;
    emailRemindersEnabled?: boolean;
    emailRemindDays?: string;
  } = {};
  if (body.bedtimeTarget !== undefined) update.bedtimeTarget = body.bedtimeTarget || null;
  if (body.windDownChecklist !== undefined) {
    update.windDownChecklist = JSON.stringify(body.windDownChecklist);
  }
  if (body.reminderEmail !== undefined) {
    const email = typeof body.reminderEmail === "string" ? body.reminderEmail.trim() : "";
    update.reminderEmail = email || null;
  }
  if (body.emailRemindersEnabled !== undefined) {
    update.emailRemindersEnabled = Boolean(body.emailRemindersEnabled);
  }
  if (body.emailRemindDays !== undefined) {
    if (Array.isArray(body.emailRemindDays)) {
      update.emailRemindDays = JSON.stringify(parseEmailRemindDays(JSON.stringify(body.emailRemindDays)));
    } else if (typeof body.emailRemindDays === "string") {
      update.emailRemindDays = JSON.stringify(parseEmailRemindDays(body.emailRemindDays));
    }
  }
  const settings = await prisma.appSettings.upsert({
    where: { id: "default" },
    create: {
      bedtimeTarget: DEFAULT_BEDTIME_TARGET,
      windDownChecklist: JSON.stringify(DEFAULT_WIND_DOWN_CHECKLIST),
      emailRemindDays: JSON.stringify(DEFAULT_EMAIL_REMIND_DAYS),
      ...update,
    },
    update,
  });
  return NextResponse.json({
    ...settings,
    emailRemindDaysParsed: parseEmailRemindDays(settings.emailRemindDays),
    emailConfigured: isEmailConfigured(),
  });
}
