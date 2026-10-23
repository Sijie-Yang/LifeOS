import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateEventTimer } from "@/lib/event-timer-service";
import { timerErrorResponse } from "@/lib/event-timer-response";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(await updateEventTimer(prisma, (await params).id, await request.json())); }
  catch (error) { return timerErrorResponse(error); }
}
