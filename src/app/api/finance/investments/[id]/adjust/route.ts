import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { upsertTodaySnapshot } from "@/lib/finance-service";
import { applyBuy, applySell } from "@/lib/investment-adjust";
import { investmentTxDescription, syncInvestmentAccountLedger } from "@/lib/investment-ledger";
import { toDateString } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const adjustments = await prisma.investmentAdjustment.findMany({
    where: { holdingId: id },
    include: { account: { select: { id: true, name: true, currency: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(adjustments);
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const type = body.type as string;

  if (!["buy", "sell", "price"].includes(type)) {
    return NextResponse.json({ error: "无效操作类型" }, { status: 400 });
  }

  const holding = await prisma.investmentHolding.findUnique({ where: { id } });
  if (!holding || !holding.isActive) {
    return NextResponse.json({ error: "持仓不存在" }, { status: 404 });
  }

  const date = (body.date as string) || toDateString();
  const note = body.note?.trim() || null;
  const accountId = (body.accountId as string) || null;
  const today = toDateString();

  if (type === "price") {
    const newPrice = Number(body.price);
    if (!Number.isFinite(newPrice) || newPrice < 0) {
      return NextResponse.json({ error: "请输入有效现价" }, { status: 400 });
    }

    const [adjustment, updated] = await prisma.$transaction(async (tx) => {
      const adj = await tx.investmentAdjustment.create({
        data: {
          holdingId: id,
          type: "price",
          shares: 0,
          price: newPrice,
          amount: 0,
          date,
          note,
        },
        include: { account: { select: { id: true, name: true, currency: true } } },
      });
      const h = await tx.investmentHolding.update({
        where: { id },
        data: { currentPrice: newPrice, priceUpdatedAt: new Date() },
        include: { account: true },
      });
      await tx.investmentPriceHistory.upsert({
        where: { holdingId_date: { holdingId: id, date: today } },
        create: { holdingId: id, date: today, price: newPrice },
        update: { price: newPrice },
      });
      return [adj, h] as const;
    });

    await upsertTodaySnapshot();
    return NextResponse.json({ holding: updated, adjustment });
  }

  const shares = Number(body.shares);
  const price = Number(body.price);
  if (!Number.isFinite(shares) || shares <= 0) {
    return NextResponse.json({ error: "请输入有效份额" }, { status: 400 });
  }
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: "请输入有效价格" }, { status: 400 });
  }

  let nextShares: number;
  let nextAvgCost: number;

  try {
    if (type === "buy") {
      const result = applyBuy(holding, shares, price);
      nextShares = result.shares;
      nextAvgCost = result.avgCost;
    } else {
      const result = applySell(holding, shares);
      nextShares = result.shares;
      nextAvgCost = result.avgCost;
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "操作失败" },
      { status: 400 }
    );
  }

  const amount = shares * price;
  const description = investmentTxDescription(type as "buy" | "sell", holding.symbol, holding.name, shares);

  try {
    const [adjustment, updated] = await prisma.$transaction(async (tx) => {
      let transactionId: string | null = null;

      if (accountId) {
        transactionId = await syncInvestmentAccountLedger(tx, {
          accountId,
          type: type as "buy" | "sell",
          amount,
          date,
          description,
          holdingCurrency: holding.currency,
        });
      }

      const adj = await tx.investmentAdjustment.create({
        data: {
          holdingId: id,
          type,
          shares,
          price,
          amount,
          date,
          note,
          reason: body.reason?.trim() || null,
          emotion: body.emotion?.trim() || null,
          accountId,
          transactionId,
        },
        include: { account: { select: { id: true, name: true, currency: true } } },
      });

      const h = await tx.investmentHolding.update({
        where: { id },
        data: {
          shares: nextShares,
          avgCost: nextAvgCost,
          ...(type === "buy" && { currentPrice: price, priceUpdatedAt: new Date() }),
          ...(type === "buy" && accountId && !holding.accountId && { accountId }),
          isActive: nextShares > 0,
        },
        include: { account: true },
      });

      if (type === "buy") {
        await tx.investmentPriceHistory.upsert({
          where: { holdingId_date: { holdingId: id, date: today } },
          create: { holdingId: id, date: today, price },
          update: { price },
        });
      }

      return [adj, h] as const;
    });

    await upsertTodaySnapshot();
    return NextResponse.json({ holding: updated, adjustment });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "操作失败" },
      { status: 400 }
    );
  }
}
