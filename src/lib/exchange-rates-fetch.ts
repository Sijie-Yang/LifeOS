import { CURRENCIES } from "@/lib/finance";

const FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest";

/** 个人记账常用基准：人民币 / 新币 */
export const PRIMARY_BASE_CURRENCIES = ["CNY", "SGD"] as const;

export type FrankfurterResponse = {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
};

/** 从 Frankfurter（欧央行参考价，工作日更新）拉取汇率，换算为 rateToBase：1 外币 = ? 基准货币 */
export async function fetchRatesFromFrankfurter(baseCurrency: string): Promise<{
  rateDate: string;
  rateToBase: Record<string, number>;
}> {
  if (!CURRENCIES[baseCurrency]) {
    throw new Error(`不支持的基准货币: ${baseCurrency}`);
  }

  const symbols = Object.keys(CURRENCIES).filter((c) => c !== baseCurrency);
  const url = `${FRANKFURTER_URL}?base=${encodeURIComponent(baseCurrency)}&symbols=${symbols.join(",")}`;

  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) {
    throw new Error(`汇率服务不可用 (${res.status})`);
  }

  const data = (await res.json()) as FrankfurterResponse;
  if (!data.rates || typeof data.date !== "string") {
    throw new Error("汇率数据格式异常");
  }

  const rateToBase: Record<string, number> = { [baseCurrency]: 1 };

  for (const [currency, perBase] of Object.entries(data.rates)) {
    if (perBase <= 0) continue;
    // API: 1 base = perBase foreign → 1 foreign = 1/perBase base
    rateToBase[currency] = 1 / perBase;
  }

  return { rateDate: data.date, rateToBase };
}

export function isRatesStale(
  rates: Array<{ updatedAt: Date | string }>,
  maxAgeMs = 24 * 60 * 60 * 1000
): boolean {
  if (rates.length === 0) return true;
  const latest = Math.max(...rates.map((r) => new Date(r.updatedAt).getTime()));
  return Date.now() - latest > maxAgeMs;
}
