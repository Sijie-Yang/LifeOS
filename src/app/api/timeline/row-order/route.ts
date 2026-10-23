import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ORDERABLE_LAYERS,
  ROW_ORDER_SOURCE,
  mergeRowOrder,
  parseRowOrder,
  type TimelineLayer,
} from "@/lib/timeline";

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const layer = String(body.layer ?? "") as TimelineLayer;
  const rowIds = body.rowIds as unknown;

  if (!ORDERABLE_LAYERS.includes(layer)) {
    return NextResponse.json({ error: "Invalid layer" }, { status: 400 });
  }
  if (!Array.isArray(rowIds) || rowIds.length === 0 || !rowIds.every((id) => typeof id === "string" && id.includes(":"))) {
    return NextResponse.json({ error: "rowIds 无效" }, { status: 400 });
  }

  const existing = await prisma.timelineOverride.findUnique({
    where: { source_sourceId: { source: ROW_ORDER_SOURCE, sourceId: layer } },
  });
  const previous = existing ? parseRowOrder([existing])[layer] ?? [] : [];
  const detail = JSON.stringify(mergeRowOrder(previous, rowIds as string[]));

  await prisma.timelineOverride.upsert({
    where: { source_sourceId: { source: ROW_ORDER_SOURCE, sourceId: layer } },
    create: { source: ROW_ORDER_SOURCE, sourceId: layer, detail },
    update: { detail },
  });

  return NextResponse.json({ ok: true });
}
