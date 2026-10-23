import { NextRequest, NextResponse } from "next/server";
import { addDays, format, parseISO } from "date-fns";
import { prisma } from "@/lib/prisma";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const fromDate = String(body.fromDate ?? "");
  const days = Math.min(30, Math.max(1, Number(body.days) || 1));

  if (!DATE_RE.test(fromDate)) {
    return NextResponse.json({ error: "Invalid fromDate" }, { status: 400 });
  }

  const steps = await prisma.projectPlanStep.findMany({
    where: {
      done: false,
      scheduledDate: { gte: fromDate },
      project: { status: "ACTIVE" },
    },
    select: { id: true, scheduledDate: true },
  });

  await prisma.$transaction(
    steps.map((step) =>
      prisma.projectPlanStep.update({
        where: { id: step.id },
        data: {
          scheduledDate: format(
            addDays(parseISO(`${step.scheduledDate}T12:00:00`), days),
            "yyyy-MM-dd"
          ),
        },
      })
    )
  );

  return NextResponse.json({ updated: steps.length, fromDate, days });
}
