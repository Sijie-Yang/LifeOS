import { NextRequest, NextResponse } from "next/server";
import { sendDeadlineReminders } from "@/lib/email-reminders";

/**
 * Vercel Cron only issues GET. Secure with CRON_SECRET / REMINDER_SECRET.
 * (00:00 UTC ≈ 08:00 Singapore / China)
 */
function authorize(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || process.env.REMINDER_SECRET;
  const isCloud = Boolean(process.env.VERCEL || process.env.REQUIRE_CRON_SECRET === "1");
  if (!secret) {
    // Refuse open cron on hosted deployments
    return !isCloud;
  }
  const header = request.headers.get("authorization");
  const query = request.nextUrl.searchParams.get("secret");
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET> when configured in project
  return header === `Bearer ${secret}` || query === secret;
}

export async function GET(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = request.nextUrl.searchParams.get("force") === "1";
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  const date = request.nextUrl.searchParams.get("date") || undefined;

  const result = await sendDeadlineReminders({ force, dryRun, date: date || undefined });
  return NextResponse.json({ ok: true, via: "cron", ...result });
}
