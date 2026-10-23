import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  const contains = { contains: q };

  const [contacts, projects, notes, planSteps, goals, habits, transactions, meetings, travels, tasks, opportunities, libraryDocs] = await Promise.all([
    prisma.contact.findMany({
      where: {
        OR: [
          { name: contains },
          { company: contains },
          { institution: contains },
          { city: contains },
          { email: contains },
          { tags: contains },
        ],
      },
      take: 6,
      select: { id: true, name: true, company: true, institution: true, city: true },
    }),
    prisma.project.findMany({
      where: { OR: [{ name: contains }, { description: contains }, { tags: contains }] },
      take: 6,
      select: { id: true, name: true, status: true },
    }),
    prisma.note.findMany({
      where: { OR: [{ title: contains }, { content: contains }] },
      take: 6,
      select: { id: true, title: true, type: true },
    }),
    prisma.projectPlanStep.findMany({
      where: { title: contains },
      take: 6,
      select: { id: true, title: true, projectId: true, done: true, project: { select: { name: true } } },
    }),
    prisma.lifeGoal.findMany({
      where: { OR: [{ title: contains }, { description: contains }] },
      take: 6,
      select: { id: true, title: true, area: true },
    }),
    prisma.habit.findMany({
      where: { OR: [{ name: contains }, { description: contains }] },
      take: 4,
      select: { id: true, name: true },
    }),
    prisma.transaction.findMany({
      where: { OR: [{ description: contains }] },
      take: 4,
      select: { id: true, description: true, amount: true, type: true },
    }),
    prisma.meeting.findMany({
      where: { OR: [{ title: contains }, { purpose: contains }, { content: contains }] },
      take: 5,
      select: { id: true, title: true, meetingDate: true },
    }),
    prisma.travel.findMany({
      where: { OR: [{ title: contains }, { destination: contains }, { purpose: contains }, { content: contains }] },
      take: 5,
      select: { id: true, title: true, startDate: true, destination: true },
    }),
    prisma.taskItem.findMany({
      where: { title: contains, cancelled: false },
      take: 5,
      select: { id: true, title: true, dueDate: true },
    }),
    prisma.opportunity.findMany({
      where: {
        OR: [
          { title: contains },
          { source: contains },
          { nextAction: contains },
          { notes: contains },
        ],
      },
      take: 5,
      select: { id: true, title: true, deadline: true, status: true, lane: true },
    }),
    prisma.libraryDocument.findMany({
      where: {
        OR: [
          { title: contains },
          { authors: contains },
          { whySelected: contains },
          { notes: contains },
          { doi: contains },
        ],
      },
      take: 5,
      select: { id: true, title: true, year: true, status: true },
    }),
  ]);

  const results = [
    ...contacts.map((c) => {
      let subtitle = "联系人";
      try {
        const orgs = c.institution ? (JSON.parse(c.institution) as unknown) : [];
        if (Array.isArray(orgs) && orgs.length) subtitle = orgs.join(" · ");
        else if (c.institution) subtitle = c.institution;
        else if (c.company) subtitle = c.company;
      } catch {
        subtitle = c.institution || c.company || "联系人";
      }
      return {
        type: "contact" as const,
        id: c.id,
        title: c.name,
        subtitle,
        href: `/contacts?id=${c.id}`,
      };
    }),
    ...projects.map((p) => ({
      type: "project" as const,
      id: p.id,
      title: p.name,
      subtitle: p.status,
      href: `/projects?id=${p.id}`,
    })),
    ...notes.map((n) => ({
      type: "note" as const,
      id: n.id,
      title: n.title,
      subtitle: n.type,
      href: `/notes?id=${n.id}`,
    })),
    ...planSteps.map((step) => ({
      type: "planStep" as const,
      id: step.id,
      title: step.title,
      subtitle: `${step.project.name}${step.done ? " · 已完成" : ""}`,
      href: `/projects?id=${step.projectId}`,
    })),
    ...goals.map((g) => ({
      type: "goal" as const,
      id: g.id,
      title: g.title,
      subtitle: g.area,
      href: `/goals?id=${g.id}`,
    })),
    ...habits.map((h) => ({
      type: "habit" as const,
      id: h.id,
      title: h.name,
      subtitle: "习惯",
      href: `/habits`,
    })),
    ...meetings.map((m) => ({
      type: "meeting" as const,
      id: m.id,
      title: m.title,
      subtitle: m.meetingDate,
      href: `/meetings?id=${m.id}`,
    })),
    ...travels.map((t) => ({
      type: "travel" as const,
      id: t.id,
      title: t.title,
      subtitle: t.destination ? `${t.startDate} · ${t.destination}` : t.startDate,
      href: `/travel?id=${t.id}`,
    })),
    ...tasks.map((t) => ({
      type: "task" as const,
      id: t.id,
      title: t.title,
      subtitle: t.dueDate ? `截止 ${t.dueDate}` : "任务",
      href: `/tasks`,
    })),
    ...opportunities.map((o) => ({
      type: "opportunity" as const,
      id: o.id,
      title: o.title,
      subtitle: o.deadline ? `DDL ${o.deadline}` : o.status,
      href: `${o.lane === "life" ? "/social" : "/opportunities"}?id=${o.id}`,
    })),
    ...libraryDocs.map((d) => ({
      type: "library" as const,
      id: d.id,
      title: d.title,
      subtitle: d.year ? `文献 · ${d.year}` : "文献库",
      href: `/library`,
    })),
    ...transactions.map((t) => ({
      type: "transaction" as const,
      id: t.id,
      title: t.description || `${t.type} ${t.amount}`,
      subtitle: "交易",
      href: "/finance",
    })),
  ];

  return NextResponse.json({ results: results.slice(0, 20) });
}
