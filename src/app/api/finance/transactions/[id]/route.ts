import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { balanceDelta, reverseDelta } from "@/lib/finance-ledger";

type Params = { params: Promise<{ id: string }> };

async function applyBalanceChange(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  accountId: string,
  accountType: string,
  txType: string,
  amount: number,
  toAccountId?: string | null,
  toAccountType?: string
) {
  if (txType === "transfer" && toAccountId && toAccountType) {
    await tx.financeAccount.update({
      where: { id: accountId },
      data: { balance: { increment: balanceDelta(accountType, "transfer", amount, "transferFrom") } },
    });
    await tx.financeAccount.update({
      where: { id: toAccountId },
      data: { balance: { increment: balanceDelta(toAccountType, "transfer", amount, "transferTo") } },
    });
  } else {
    await tx.financeAccount.update({
      where: { id: accountId },
      data: { balance: { increment: balanceDelta(accountType, txType, amount) } },
    });
  }
}

async function reverseBalanceChange(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  accountId: string,
  accountType: string,
  txType: string,
  amount: number,
  toAccountId?: string | null,
  toAccountType?: string
) {
  if (txType === "transfer" && toAccountId && toAccountType) {
    await tx.financeAccount.update({
      where: { id: accountId },
      data: { balance: { increment: reverseDelta(accountType, txType, amount, toAccountId) } },
    });
    await tx.financeAccount.update({
      where: { id: toAccountId },
      data: { balance: { increment: -balanceDelta(toAccountType, "transfer", amount, "transferTo") } },
    });
  } else {
    await tx.financeAccount.update({
      where: { id: accountId },
      data: { balance: { increment: reverseDelta(accountType, txType, amount) } },
    });
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params;

  await prisma.$transaction(async (tx) => {
    const t = await tx.transaction.findUnique({
      where: { id },
      include: { account: true, toAccount: true },
    });
    if (!t) throw new Error("Not found");

    await reverseBalanceChange(
      tx,
      t.accountId,
      t.account.type,
      t.type,
      t.amount,
      t.toAccountId,
      t.toAccount?.type
    );

    await tx.transaction.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const old = await tx.transaction.findUnique({
        where: { id },
        include: { account: true, toAccount: true },
      });
      if (!old) throw new Error("Not found");

      await reverseBalanceChange(
        tx,
        old.accountId,
        old.account.type,
        old.type,
        old.amount,
        old.toAccountId,
        old.toAccount?.type
      );

      const type = (body.type ?? old.type) as string;
      const amount = Math.abs(body.amount ?? old.amount);
      const accountId = body.accountId ?? old.accountId;
      const toAccountId = type === "transfer" ? (body.toAccountId ?? old.toAccountId) : null;
      const categoryId = type === "transfer" ? null : (body.categoryId !== undefined ? body.categoryId || null : old.categoryId);
      const projectId = body.projectId !== undefined ? body.projectId || null : old.projectId;

      const fromAccount = await tx.financeAccount.findUnique({ where: { id: accountId } });
      if (!fromAccount) throw new Error("Account not found");

      let toAccount = null;
      if (type === "transfer") {
        if (!toAccountId) throw new Error("需要选择转入账户");
        toAccount = await tx.financeAccount.findUnique({ where: { id: toAccountId } });
        if (!toAccount) throw new Error("转入账户不存在");
      }

      const t = await tx.transaction.update({
        where: { id },
        data: {
          accountId,
          toAccountId,
          categoryId,
          projectId,
          amount,
          type,
          date: body.date ?? old.date,
          description: body.description !== undefined ? body.description || null : old.description,
        },
        include: { category: true, account: true, toAccount: true, project: { select: { id: true, name: true } } },
      });

      await applyBalanceChange(
        tx,
        accountId,
        fromAccount.type,
        type,
        amount,
        toAccountId,
        toAccount?.type
      );

      return t;
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新失败" },
      { status: 400 }
    );
  }
}
