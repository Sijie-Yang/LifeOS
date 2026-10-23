import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDateString, getWeekStart } from "@/lib/utils";
import { parseISO } from "date-fns";

export async function POST(request: NextRequest) {
  const date = toDateString();
  await prisma.financeAccessLog.create({ data: { date } });

  const weekStart = getWeekStart();
  const weekCount = await prisma.financeAccessLog.count({
    where: { date: { gte: weekStart } },
  });

  const settings = await prisma.financeSettings.upsert({
    where: { id: "default" },
    create: {},
    update: {},
  });

  const limit = settings.financeAccessLimit ?? 7;
  const overLimit = weekCount > limit;

  return NextResponse.json({
    weekCount,
    limit,
    overLimit,
    investmentPolicy: settings.investmentPolicy,
  });
}

export async function GET() {
  const weekStart = getWeekStart();
  const weekCount = await prisma.financeAccessLog.count({
    where: { date: { gte: weekStart } },
  });
  const settings = await prisma.financeSettings.findUnique({ where: { id: "default" } });
  return NextResponse.json({
    weekCount,
    limit: settings?.financeAccessLimit ?? 7,
    investmentPolicy: settings?.investmentPolicy ?? null,
  });
}
