import type { Prisma } from "@prisma/client";
import { balanceDelta } from "@/lib/finance-ledger";

export function investmentTxDescription(
  type: "buy" | "sell",
  symbol: string,
  name: string,
  shares: number
) {
  const action = type === "buy" ? "加仓" : "减仓";
  return `投资${action} · ${symbol} ${name}（${shares} 份）`;
}

/** 加仓扣款 / 减仓入账 */
export async function syncInvestmentAccountLedger(
  tx: Prisma.TransactionClient,
  opts: {
    accountId: string;
    type: "buy" | "sell";
    amount: number;
    date: string;
    description: string;
    holdingCurrency: string;
  }
) {
  const account = await tx.financeAccount.findUnique({ where: { id: opts.accountId } });
  if (!account || !account.isActive) {
    throw new Error("账户不存在或已停用");
  }
  if (account.currency !== opts.holdingCurrency) {
    throw new Error(`账户币种（${account.currency}）需与持仓币种（${opts.holdingCurrency}）一致`);
  }

  const txType = opts.type === "buy" ? "expense" : "income";
  const transaction = await tx.transaction.create({
    data: {
      accountId: opts.accountId,
      amount: opts.amount,
      type: txType,
      date: opts.date,
      description: opts.description,
      categoryId: null,
      projectId: null,
    },
  });

  await tx.financeAccount.update({
    where: { id: account.id },
    data: { balance: { increment: balanceDelta(account.type, txType, opts.amount) } },
  });

  return transaction.id;
}
