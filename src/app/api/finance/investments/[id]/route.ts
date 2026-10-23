import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { upsertTodaySnapshot } from "@/lib/finance-service";
import { toDateString } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const today = toDateString();
  const priceChanged = body.currentPrice !== undefined;

  const holding = await prisma.investmentHolding.update({
    where: { id },
    data: {
      ...(body.type !== undefined && { type: body.type }),
      ...(body.symbol !== undefined && { symbol: body.symbol }),
      ...(body.name !== undefined && { name: body.name }),
      ...(body.shares !== undefined && { shares: body.shares }),
      ...(body.avgCost !== undefined && { avgCost: body.avgCost }),
      ...(body.currentPrice !== undefined && {
        currentPrice: body.currentPrice,
        priceUpdatedAt: new Date(),
      }),
      ...(body.currency !== undefined && { currency: body.currency }),
      ...(body.accountId !== undefined && { accountId: body.accountId || null }),
      ...(body.notes !== undefined && { notes: body.notes || null }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
    include: { account: true },
  });

  if (priceChanged) {
    await prisma.investmentPriceHistory.upsert({
      where: { holdingId_date: { holdingId: id, date: today } },
      create: { holdingId: id, date: today, price: body.currentPrice },
      update: { price: body.currentPrice },
    });
    await upsertTodaySnapshot();
  }

  return NextResponse.json(holding);
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.investmentHolding.delete({ where: { id } });
  await upsertTodaySnapshot();
  return NextResponse.json({ ok: true });
}

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const [history, adjustments] = await Promise.all([
    prisma.investmentPriceHistory.findMany({
      where: { holdingId: id },
      orderBy: { date: "asc" },
    }),
    prisma.investmentAdjustment.findMany({
      where: { holdingId: id },
      include: { account: { select: { id: true, name: true, currency: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 20,
    }),
  ]);
  return NextResponse.json({ priceHistory: history, adjustments });
}
