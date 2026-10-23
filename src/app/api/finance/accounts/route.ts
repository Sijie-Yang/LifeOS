import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const accounts = await prisma.financeAccount.findMany({
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }],
  });
  return NextResponse.json(accounts);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const maxOrder = await prisma.financeAccount.aggregate({ _max: { sortOrder: true } });

  const account = await prisma.financeAccount.create({
    data: {
      name: body.name,
      type: body.type || "cash",
      balance: body.balance ?? 0,
      currency: body.currency || "CNY",
      color: body.color || "#6366f1",
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json(account, { status: 201 });
}
