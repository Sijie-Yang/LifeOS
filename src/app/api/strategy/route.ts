import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapEntry, mapPhase } from "@/lib/life-strategy";

export async function GET() {
  const [meta, phases, entries] = await Promise.all([
    prisma.lifeStrategyMeta.upsert({
      where: { id: "default" },
      create: {},
      update: {},
    }),
    prisma.lifeStrategyPhase.findMany({
      orderBy: [{ sortOrder: "asc" }, { startDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.lifeStrategyEntry.findMany({
      orderBy: [{ date: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  return NextResponse.json({
    meta: {
      northStar: meta.northStar,
      decisionFilter: meta.decisionFilter,
      operatingSystem: meta.operatingSystem,
      updatedAt: meta.updatedAt.toISOString(),
    },
    phases: phases.map(mapPhase),
    entries: entries.map(mapEntry),
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const meta = await prisma.lifeStrategyMeta.upsert({
    where: { id: "default" },
    create: {
      northStar: body.northStar ?? null,
      decisionFilter: body.decisionFilter ?? null,
      operatingSystem: body.operatingSystem ?? null,
    },
    update: {
      ...(body.northStar !== undefined && { northStar: body.northStar || null }),
      ...(body.decisionFilter !== undefined && {
        decisionFilter: body.decisionFilter || null,
      }),
      ...(body.operatingSystem !== undefined && {
        operatingSystem: body.operatingSystem || null,
      }),
    },
  });
  return NextResponse.json({
    northStar: meta.northStar,
    decisionFilter: meta.decisionFilter,
    operatingSystem: meta.operatingSystem,
    updatedAt: meta.updatedAt.toISOString(),
  });
}
