import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { upsertTodaySnapshot } from "@/lib/finance-service";

export async function GET() {
  const snapshots = await prisma.wealthSnapshot.findMany({
    orderBy: { date: "asc" },
    take: 365,
  });
  return NextResponse.json(snapshots);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const snapshot = await upsertTodaySnapshot(body.note);
  return NextResponse.json(snapshot, { status: 201 });
}
