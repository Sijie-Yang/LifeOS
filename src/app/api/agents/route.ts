import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { linkAgentProjects } from "@/lib/agent-projects";
import { format } from "date-fns";
import { agentSlotCounts } from "@/lib/agent-activity";
import { listAgentsForDate } from "@/lib/local-agents";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const today = format(new Date(), "yyyy-MM-dd");
  const requested = request.nextUrl.searchParams.get("date") ?? "";
  if (requested && (!DATE_RE.test(requested) || !Number.isFinite(Date.parse(`${requested}T12:00:00Z`)) || new Date(`${requested}T12:00:00Z`).toISOString().slice(0, 10) !== requested)) {
    return NextResponse.json({ error: "请输入有效日期" }, { status: 400 });
  }
  const date = requested || today;
  const projects = await prisma.project.findMany({ select: { id: true, name: true, status: true, tags: true }, orderBy: { name: "asc" } });
  const agents = linkAgentProjects(listAgentsForDate(date), projects);
  return NextResponse.json({
    date,
    now: new Date().toISOString(),
    agents,
    projects: projects.map(({ id, name, status }) => ({ id, name, status })),
    counts: agentSlotCounts(agents, date),
  }, { headers: { "Cache-Control": "no-store" } });
}
