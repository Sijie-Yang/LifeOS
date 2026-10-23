import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeWorkspace, updateWorkspaceTags, workspaceAliases } from "@/lib/agent-projects";

export async function GET() {
  const projects = await prisma.project.findMany({ select: { id: true, name: true, status: true, tags: true }, orderBy: { name: "asc" } });
  return NextResponse.json({ projects: projects.map(({ tags, ...project }) => ({ ...project, workspaces: workspaceAliases(tags) })) });
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.workspace !== "string" || body.workspace.length > 200 || !normalizeWorkspace(body.workspace) || (body.projectId !== null && typeof body.projectId !== "string")) {
    return NextResponse.json({ error: "请选择有效 workspace 和项目" }, { status: 400 });
  }
  const workspace = body.workspace.trim();
  const result = await prisma.$transaction(async (tx) => {
    const projects = await tx.project.findMany({ select: { id: true, tags: true } });
    if (body.projectId !== null && !projects.some((p) => p.id === body.projectId)) return false;
    for (const project of projects) {
      const tags = updateWorkspaceTags(project.tags, workspace, project.id === body.projectId);
      if (tags !== project.tags) await tx.project.update({ where: { id: project.id }, data: { tags } });
    }
    return true;
  });
  if (!result) return NextResponse.json({ error: "项目不存在，请刷新后重试" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
