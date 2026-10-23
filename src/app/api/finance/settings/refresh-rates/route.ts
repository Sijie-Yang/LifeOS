import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchRatesFromFrankfurter, PRIMARY_BASE_CURRENCIES } from "@/lib/exchange-rates-fetch";
import { upsertTodaySnapshot } from "@/lib/finance-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const settings = await prisma.financeSettings.upsert({
      where: { id: "default" },
      create: { baseCurrency: "CNY" },
      update: {},
    });

    const baseCurrency = (body.baseCurrency as string) || settings.baseCurrency;

    if (!PRIMARY_BASE_CURRENCIES.includes(baseCurrency as (typeof PRIMARY_BASE_CURRENCIES)[number])) {
      return NextResponse.json(
        { error: "自动汇率目前支持基准货币：CNY（人民币）或 SGD（新币）" },
        { status: 400 }
      );
    }

    const { rateDate, rateToBase } = await fetchRatesFromFrankfurter(baseCurrency);

    const rates = await prisma.$transaction(async (tx) => {
      if (body.baseCurrency && body.baseCurrency !== settings.baseCurrency) {
        await tx.financeSettings.update({
          where: { id: "default" },
          data: { baseCurrency },
        });
      }

      const updated = [];
      for (const [currency, rate] of Object.entries(rateToBase)) {
        if (currency === baseCurrency) continue;
        const row = await tx.exchangeRate.upsert({
          where: { currency },
          create: { currency, rateToBase: rate },
          update: { rateToBase: rate },
        });
        updated.push(row);
      }
      return updated;
    });

    await upsertTodaySnapshot();

    return NextResponse.json({
      baseCurrency,
      rateDate,
      source: "Frankfurter / ECB",
      rates: rates.sort((a, b) => a.currency.localeCompare(b.currency)),
    });
  } catch (e) {
    console.error("[refresh-rates]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "刷新汇率失败" },
      { status: 502 }
    );
  }
}
