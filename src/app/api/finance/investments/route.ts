import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { upsertTodaySnapshot } from "@/lib/finance-service";
import { investmentTxDescription, syncInvestmentAccountLedger } from "@/lib/investment-ledger";
import { toDateString } from "@/lib/utils";

export async function GET() {
  const holdings = await prisma.investmentHolding.findMany({
    where: { isActive: true },
    include: { account: true },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(holdings);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const maxOrder = await prisma.investmentHolding.aggregate({ _max: { sortOrder: true } });
    const today = toDateString();
    const accountId = body.accountId || null;
    const shares = Number(body.shares);
    const currentPrice = Number(body.currentPrice);
    const avgCost =
      body.avgCost != null && body.avgCost !== "" && Number(body.avgCost) > 0
        ? Number(body.avgCost)
        : currentPrice;

    if (!body.symbol?.trim() || !body.name?.trim()) {
      return NextResponse.json({ error: "代码和名称不能为空" }, { status: 400 });
    }
    if (!Number.isFinite(shares) || shares <= 0) {
      return NextResponse.json({ error: "请输入有效份额" }, { status: 400 });
    }
    if (!Number.isFinite(currentPrice) || currentPrice < 0) {
      return NextResponse.json({ error: "请输入有效现价" }, { status: 400 });
    }

    const currency = body.currency || "CNY";
    const amount = shares * avgCost;

    const holding = await prisma.$transaction(async (tx) => {
      if (accountId) {
        const account = await tx.financeAccount.findUnique({ where: { id: accountId } });
        if (!account?.isActive) {
          throw new Error("扣款账户不存在或已停用");
        }
        if (account.currency !== currency) {
          throw new Error(`扣款账户币种（${account.currency}）需与持仓币种（${currency}）一致`);
        }
      }

      const h = await tx.investmentHolding.create({
        data: {
          type: body.type || "stock",
          symbol: body.symbol.trim(),
          name: body.name.trim(),
          shares,
          avgCost,
          currentPrice,
          currency,
          priceUpdatedAt: new Date(),
          accountId,
          notes: body.notes || null,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        },
        include: { account: true },
      });

      await tx.investmentPriceHistory.upsert({
        where: { holdingId_date: { holdingId: h.id, date: today } },
        create: { holdingId: h.id, date: today, price: currentPrice },
        update: { price: currentPrice },
      });

      let transactionId: string | null = null;
      if (accountId) {
        transactionId = await syncInvestmentAccountLedger(tx, {
          accountId,
          type: "buy",
          amount,
          date: today,
          description: investmentTxDescription("buy", h.symbol, h.name, shares),
          holdingCurrency: h.currency,
        });
      }

      await tx.investmentAdjustment.create({
        data: {
          holdingId: h.id,
          type: "buy",
          shares,
          price: avgCost,
          amount,
          date: today,
          note: "初始建仓",
          accountId,
          transactionId,
        },
      });

      return h;
    });

    await upsertTodaySnapshot();

    return NextResponse.json(holding, { status: 201 });
  } catch (e) {
    console.error("[investments POST]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "添加持仓失败" },
      { status: 400 }
    );
  }
}
