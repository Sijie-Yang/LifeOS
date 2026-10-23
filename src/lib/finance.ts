export type RateMap = Record<string, number>;

export const CURRENCIES: Record<string, { label: string; symbol: string }> = {
  CNY: { label: "人民币", symbol: "¥" },
  USD: { label: "美元", symbol: "$" },
  HKD: { label: "港币", symbol: "HK$" },
  EUR: { label: "欧元", symbol: "€" },
  GBP: { label: "英镑", symbol: "£" },
  JPY: { label: "日元", symbol: "¥" },
  SGD: { label: "新币", symbol: "S$" },
};

export const INVESTMENT_TYPES: Record<string, string> = {
  stock: "股票",
  fund: "基金",
};

export function buildRateMap(baseCurrency: string, rates: { currency: string; rateToBase: number }[]): RateMap {
  const map: RateMap = { [baseCurrency]: 1 };
  for (const r of rates) {
    map[r.currency] = r.rateToBase;
  }
  return map;
}

/** Convert amount from `currency` into base currency */
export function toBase(amount: number, currency: string, baseCurrency: string, rates: RateMap): number {
  if (currency === baseCurrency) return amount;
  const rate = rates[currency];
  if (!rate) return amount;
  return amount * rate;
}

export function holdingMarketValue(shares: number, price: number): number {
  return shares * price;
}

export function holdingPnL(shares: number, avgCost: number, currentPrice: number) {
  const cost = shares * avgCost;
  const market = shares * currentPrice;
  return { cost, market, pnl: market - cost, pnlPct: cost > 0 ? ((market - cost) / cost) * 100 : 0 };
}

type AccountLike = { balance: number; currency: string; type?: string };

export function accountBalanceInBase(
  account: AccountLike,
  baseCurrency: string,
  rates: RateMap
): number {
  const raw = toBase(account.balance, account.currency, baseCurrency, rates);
  return account.type === "credit" ? -raw : raw;
}

type HoldingLike = { shares: number; currentPrice: number; currency: string; isActive?: boolean };
type TxLike = { amount: number; type: string; account?: { currency: string } | null };

export function computeCashTotal(
  accounts: AccountLike[],
  baseCurrency: string,
  rates: RateMap
): number {
  return accounts.reduce((s, a) => s + accountBalanceInBase(a, baseCurrency, rates), 0);
}

export function computeInvestmentTotal(holdings: HoldingLike[], baseCurrency: string, rates: RateMap): number {
  return holdings
    .filter((h) => h.isActive !== false)
    .reduce((s, h) => {
      const mv = holdingMarketValue(h.shares, h.currentPrice);
      return s + toBase(mv, h.currency, baseCurrency, rates);
    }, 0);
}

export function computeNetWorth(
  accounts: AccountLike[],
  holdings: HoldingLike[],
  baseCurrency: string,
  rates: RateMap
) {
  const cashTotal = computeCashTotal(accounts, baseCurrency, rates);
  const investmentTotal = computeInvestmentTotal(holdings, baseCurrency, rates);
  return { cashTotal, investmentTotal, netWorth: cashTotal + investmentTotal };
}

export function computeMonthFlows(
  transactions: TxLike[],
  baseCurrency: string,
  rates: RateMap
) {
  let monthIncome = 0;
  let monthExpense = 0;
  for (const t of transactions) {
    const cur = t.account?.currency ?? baseCurrency;
    const base = toBase(t.amount, cur, baseCurrency, rates);
    if (t.type === "income") monthIncome += base;
    else if (t.type === "expense") monthExpense += base;
  }
  return { monthIncome, monthExpense, monthBalance: monthIncome - monthExpense };
}

export function currencySymbol(currency: string): string {
  return CURRENCIES[currency]?.symbol ?? currency;
}

export function fmtMoney(amount: number, currency: string, opts?: { showSign?: boolean }) {
  const sym = currencySymbol(currency);
  const formatted = amount.toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  if (opts?.showSign && amount > 0) return `+${sym}${formatted}`;
  if (opts?.showSign && amount < 0) return `-${sym}${formatted.replace("-", "")}`;
  return `${sym}${formatted}`;
}

export function breakdownByCurrency(
  accounts: AccountLike[],
  holdings: HoldingLike[],
  baseCurrency: string,
  rates: RateMap
) {
  const totals: Record<string, { cash: number; investment: number }> = {};
  const add = (currency: string, field: "cash" | "investment", amount: number) => {
    if (!totals[currency]) totals[currency] = { cash: 0, investment: 0 };
    totals[currency][field] += amount;
  };

  for (const a of accounts) {
    const signed = a.type === "credit" ? -a.balance : a.balance;
    add(a.currency, "cash", signed);
  }
  for (const h of holdings.filter((x) => x.isActive !== false)) {
    add(h.currency, "investment", holdingMarketValue(h.shares, h.currentPrice));
  }

  return Object.entries(totals).map(([currency, v]) => ({
    currency,
    cash: v.cash,
    investment: v.investment,
    total: v.cash + v.investment,
    totalInBase: toBase(v.cash + v.investment, currency, baseCurrency, rates),
  }));
}
