import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const settings = await prisma.financeSettings.upsert({
    where: { id: "default" },
    create: { baseCurrency: "CNY" },
    update: {},
  });
  const rates = await prisma.exchangeRate.findMany({ orderBy: { currency: "asc" } });
  return NextResponse.json({ settings, rates });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const update: { baseCurrency?: string; investmentPolicy?: string | null; financeAccessLimit?: number } = {};
  if (body.baseCurrency) update.baseCurrency = body.baseCurrency;
  if (body.investmentPolicy !== undefined) update.investmentPolicy = body.investmentPolicy?.trim() || null;
  if (body.financeAccessLimit != null) update.financeAccessLimit = Number(body.financeAccessLimit);

  const settings = await prisma.financeSettings.upsert({
    where: { id: "default" },
    create: { baseCurrency: body.baseCurrency || "CNY", ...update },
    update,
  });
  return NextResponse.json(settings);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const rate = await prisma.exchangeRate.upsert({
    where: { currency: body.currency },
    create: { currency: body.currency, rateToBase: body.rateToBase },
    update: { rateToBase: body.rateToBase },
  });
  return NextResponse.json(rate, { status: 201 });
}
