import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDateString } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") || toDateString();
  const logs = await prisma.nudgeLog.findMany({ where: { date } });
  return NextResponse.json({ date, sent: logs.map((l) => l.key) });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const key = body.key as string;
  const date = body.date || toDateString();
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

  const existing = await prisma.nudgeLog.findUnique({
    where: { key_date: { key, date } },
  });
  if (existing) return NextResponse.json({ ok: true, duplicate: true });

  await prisma.nudgeLog.create({ data: { key, date } });
  return NextResponse.json({ ok: true, duplicate: false });
}
