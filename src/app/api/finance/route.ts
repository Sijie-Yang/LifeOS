import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { balanceDelta } from "@/lib/finance-ledger";
import { getFullFinancePayload } from "@/lib/finance-service";

export async function GET() {
  const data = await getFullFinancePayload({ recordSnapshot: true });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const type = body.type as string;
  const amount = Math.abs(body.amount);

  const transaction = await prisma.$transaction(async (tx) => {
    const fromAccount = await tx.financeAccount.findUnique({ where: { id: body.accountId } });
    if (!fromAccount) throw new Error("Account not found");

    if (type === "transfer") {
      if (!body.toAccountId) throw new Error("需要选择转入账户");
      const toAccount = await tx.financeAccount.findUnique({ where: { id: body.toAccountId } });
      if (!toAccount) throw new Error("转入账户不存在");

      const t = await tx.transaction.create({
        data: {
          accountId: body.accountId,
          toAccountId: body.toAccountId,
          categoryId: null,
          amount,
          type: "transfer",
          date: body.date,
          description: body.description || null,
        },
        include: { category: true, account: true, toAccount: true },
      });

      await tx.financeAccount.update({
        where: { id: fromAccount.id },
        data: { balance: { increment: balanceDelta(fromAccount.type, "transfer", amount, "transferFrom") } },
      });
      await tx.financeAccount.update({
        where: { id: toAccount.id },
        data: { balance: { increment: balanceDelta(toAccount.type, "transfer", amount, "transferTo") } },
      });

      return t;
    }

    const t = await tx.transaction.create({
      data: {
        accountId: body.accountId,
        categoryId: body.categoryId || null,
        amount,
        type,
        date: body.date,
        description: body.description || null,
        projectId: body.projectId || null,
      },
      include: { category: true, account: true, toAccount: true },
    });

    await tx.financeAccount.update({
      where: { id: body.accountId },
      data: { balance: { increment: balanceDelta(fromAccount.type, type, amount) } },
    });

    return t;
  });

  return NextResponse.json(transaction, { status: 201 });
}
