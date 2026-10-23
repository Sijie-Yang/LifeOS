import { prisma } from "@/lib/prisma";
import { getWeekStart } from "@/lib/reminders";
import { isRatesStale } from "@/lib/exchange-rates-fetch";
import {
  buildRateMap,
  computeMonthFlows,
  computeNetWorth,
  breakdownByCurrency,
  toBase,
  holdingPnL,
} from "@/lib/finance";

export async function getFinanceContext() {
  const settings = await prisma.financeSettings.upsert({
    where: { id: "default" },
    create: { baseCurrency: "CNY" },
    update: {},
  });

  const rates = await prisma.exchangeRate.findMany();
  const rateMap = buildRateMap(settings.baseCurrency, rates);

  return { settings, rates, rateMap };
}

export async function buildWealthSnapshotData() {
  const { settings, rateMap } = await getFinanceContext();

  const [accounts, holdings] = await Promise.all([
    prisma.financeAccount.findMany({ where: { isActive: true } }),
    prisma.investmentHolding.findMany({ where: { isActive: true } }),
  ]);

  const { cashTotal, investmentTotal, netWorth } = computeNetWorth(
    accounts,
    holdings,
    settings.baseCurrency,
    rateMap
  );

  const breakdown = breakdownByCurrency(accounts, holdings, settings.baseCurrency, rateMap);

  return {
    baseCurrency: settings.baseCurrency,
    netWorth,
    cashTotal,
    investmentTotal,
    breakdown: JSON.stringify(breakdown),
  };
}

export async function upsertTodaySnapshot(note?: string) {
  const today = new Date().toISOString().slice(0, 10);
  const data = await buildWealthSnapshotData();

  return prisma.wealthSnapshot.upsert({
    where: { date: today },
    create: { date: today, ...data, note: note || null },
    update: { ...data, note: note ?? undefined },
  });
}

export async function maybeAutoWeeklySnapshot() {
  const weekStart = getWeekStart();
  const existing = await prisma.wealthSnapshot.findUnique({ where: { date: weekStart } });
  if (existing) return existing;

  const today = new Date().toISOString().slice(0, 10);
  if (today < weekStart) return null;

  const data = await buildWealthSnapshotData();
  return prisma.wealthSnapshot.create({
    data: { date: weekStart, ...data, note: "每周自动快照" },
  });
}

/** Lightweight read for dashboard — no snapshot writes. */
export async function getFinanceDashboardSummary() {
  const { settings, rateMap } = await getFinanceContext();
  const [accounts, holdings, snapshots] = await Promise.all([
    prisma.financeAccount.findMany({ where: { isActive: true } }),
    prisma.investmentHolding.findMany({ where: { isActive: true } }),
    prisma.wealthSnapshot.findMany({ orderBy: { date: "desc" }, take: 6 }),
  ]);

  const { cashTotal, investmentTotal, netWorth } = computeNetWorth(
    accounts,
    holdings,
    settings.baseCurrency,
    rateMap
  );

  return {
    summary: {
      baseCurrency: settings.baseCurrency,
      netWorth,
      cashTotal,
      investmentTotal,
    },
    wealthHistory: [...snapshots].reverse(),
  };
}

export async function getFullFinancePayload(options?: { recordSnapshot?: boolean }) {
  if (options?.recordSnapshot) {
    await maybeAutoWeeklySnapshot();
    await upsertTodaySnapshot().catch(() => null);
  }
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const { settings, rates, rateMap } = await getFinanceContext();

  const [accounts, categories, monthTransactions, recentTransactions, holdings, snapshots] =
    await Promise.all([
      prisma.financeAccount.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.financeCategory.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.transaction.findMany({
        where: { date: { gte: monthStart } },
        include: { category: true, account: true, toAccount: true, project: { select: { id: true, name: true } } },
      }),
      prisma.transaction.findMany({
        take: 10,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        include: { category: true, account: true, toAccount: true, project: { select: { id: true, name: true } } },
      }),
      prisma.investmentHolding.findMany({
        where: { isActive: true },
        include: { account: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.wealthSnapshot.findMany({
        orderBy: { date: "asc" },
        take: 90,
      }),
    ]);

  const { monthIncome, monthExpense, monthBalance } = computeMonthFlows(
    monthTransactions,
    settings.baseCurrency,
    rateMap
  );

  const { cashTotal, investmentTotal, netWorth } = computeNetWorth(
    accounts,
    holdings,
    settings.baseCurrency,
    rateMap
  );

  const currencyBreakdown = breakdownByCurrency(
    accounts,
    holdings,
    settings.baseCurrency,
    rateMap
  );

  const expenseByCategory = categories
    .filter((c) => c.type === "expense")
    .map((cat) => {
      const spent = monthTransactions
        .filter((t) => t.categoryId === cat.id && t.type === "expense")
        .reduce((s, t) => {
          const cur = t.account?.currency ?? settings.baseCurrency;
          return s + toBase(t.amount, cur, settings.baseCurrency, rateMap);
        }, 0);
      return { ...cat, spent, remaining: cat.budget != null ? cat.budget - spent : null };
    });

  const holdingsWithMetrics = holdings.map((h) => {
    const { cost, market, pnl, pnlPct } = holdingPnL(h.shares, h.avgCost, h.currentPrice);
    return {
      ...h,
      marketValue: market,
      cost,
      pnl,
      pnlPct,
      marketValueBase: toBase(market, h.currency, settings.baseCurrency, rateMap),
    };
  });

  return {
    settings,
    exchangeRates: rates,
    ratesMeta: {
      lastUpdated: rates.length
        ? new Date(Math.max(...rates.map((r) => r.updatedAt.getTime()))).toISOString()
        : null,
      isStale: isRatesStale(rates),
      autoRefreshSupported: ["CNY", "SGD"].includes(settings.baseCurrency),
    },
    accounts,
    categories,
    holdings: holdingsWithMetrics,
    wealthHistory: snapshots,
    currencyBreakdown,
    summary: {
      baseCurrency: settings.baseCurrency,
      netWorth,
      cashTotal,
      investmentTotal,
      monthIncome,
      monthExpense,
      monthBalance,
      transactionCount: monthTransactions.length,
    },
    expenseByCategory,
    recentTransactions,
  };
}
