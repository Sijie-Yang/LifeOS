import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const EDITABLE_SOURCES = new Set([
  "foresight-era",
  "foresight-vision",
  "foresight-prediction",
]);

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const source = String(body.source ?? "");
  const sourceId = String(body.sourceId ?? "");
  if (!EDITABLE_SOURCES.has(source) || !sourceId) {
    return NextResponse.json({ error: "Invalid timeline source" }, { status: 400 });
  }

  const clean = (value: unknown) => {
    if (value === undefined) return undefined;
    const text = String(value ?? "").trim();
    return text || null;
  };
  const data = {
    title: clean(body.title),
    detail:
      body.detail === undefined ? undefined : String(body.detail ?? "").trim(),
    startDate: clean(body.startDate),
    endDate: clean(body.endDate),
  };

  const override = await prisma.timelineOverride.upsert({
    where: { source_sourceId: { source, sourceId } },
    create: { source, sourceId, ...data },
    update: data,
  });
  return NextResponse.json(override);
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const source = String(body.source ?? "");
  const sourceId = String(body.sourceId ?? "");
  await prisma.timelineOverride.deleteMany({ where: { source, sourceId } });
  return NextResponse.json({ ok: true });
}
