/** 加仓：加权平均成本 */
export function applyBuy(
  holding: { shares: number; avgCost: number },
  buyShares: number,
  buyPrice: number
) {
  if (buyShares <= 0) throw new Error("加仓份额须大于 0");
  if (buyPrice < 0) throw new Error("价格无效");
  const newShares = holding.shares + buyShares;
  const newAvgCost =
    newShares > 0
      ? (holding.shares * holding.avgCost + buyShares * buyPrice) / newShares
      : buyPrice;
  return { shares: newShares, avgCost: newAvgCost };
}

/** 减仓：成本价不变 */
export function applySell(
  holding: { shares: number; avgCost: number },
  sellShares: number
) {
  if (sellShares <= 0) throw new Error("减仓份额须大于 0");
  if (sellShares > holding.shares + 1e-9) throw new Error("减仓份额超过持有量");
  return { shares: holding.shares - sellShares, avgCost: holding.avgCost };
}

export const ADJUSTMENT_TYPES: Record<string, string> = {
  buy: "加仓",
  sell: "减仓",
  price: "更新现价",
};
