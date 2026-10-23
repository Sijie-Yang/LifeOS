/** Balance change when money flows into/out of an account */

export function balanceDelta(
  accountType: string,
  txType: string,
  amount: number,
  role: "normal" | "transferFrom" | "transferTo" = "normal"
): number {
  const isCredit = accountType === "credit";

  if (role === "transferFrom") {
    return isCredit ? amount : -amount;
  }
  if (role === "transferTo") {
    return isCredit ? -amount : amount;
  }

  if (isCredit) {
    if (txType === "expense") return amount;
    if (txType === "income") return -amount;
    return 0;
  }

  if (txType === "income") return amount;
  if (txType === "expense") return -amount;
  return 0;
}

export function reverseDelta(accountType: string, txType: string, amount: number, toAccountId?: string | null) {
  if (txType === "transfer" && toAccountId) {
    return -balanceDelta(accountType, txType, amount, "transferFrom");
  }
  return -balanceDelta(accountType, txType, amount, "normal");
}
