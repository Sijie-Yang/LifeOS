import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isOverdue, daysSinceContact, toDateString } from "@/lib/utils";
import { daysUntilBirthday } from "@/lib/reminders";
import { differenceInDays } from "date-fns";

export async function GET() {
  const today = toDateString();
  const contacts = await prisma.contact.findMany({
    include: { category: true },
    orderBy: [{ importance: "desc" }, { name: "asc" }],
  });

  const projects = await prisma.project.findMany({
    where: { status: { in: ["ACTIVE", "PLANNING"] } },
    orderBy: { targetDate: "asc" },
  });

  const overdueContacts = contacts
    .filter((c) => isOverdue(c.lastContactAt, c.contactFrequencyDays))
    .map((c) => ({
      id: c.id,
      name: c.name,
      importance: c.importance,
      category: c.category,
      lastContactAt: c.lastContactAt,
      daysSince: daysSinceContact(c.lastContactAt),
      contactFrequencyDays: c.contactFrequencyDays,
    }))
    .sort((a, b) => b.importance - a.importance);

  const upcomingBirthdays = contacts
    .filter((c) => c.birthday)
    .map((c) => ({
      id: c.id,
      name: c.name,
      birthday: c.birthday,
      daysUntil: daysUntilBirthday(c.birthday!),
      category: c.category,
    }))
    .filter((c) => c.daysUntil <= 14)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const projectsDueSoon = projects
    .filter((p) => p.targetDate)
    .map((p) => ({
      id: p.id,
      name: p.name,
      targetDate: p.targetDate,
      progress: p.progress,
      status: p.status,
      daysLeft: differenceInDays(p.targetDate!, new Date()),
    }))
    .filter((p) => p.daysLeft <= 14)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const horizon = toDateString(new Date(Date.now() + 14 * 86400000));
  const [tasksDueSoon, opportunitiesDueSoon] = await Promise.all([
    prisma.taskItem.findMany({
      where: {
        completed: false,
        cancelled: false,
        dueDate: { not: null, lte: horizon },
      },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
    prisma.opportunity.findMany({
      where: {
        status: { in: ["Watching", "Active"] },
        deadline: { not: null, lte: horizon },
      },
      orderBy: { deadline: "asc" },
      take: 20,
    }),
  ]);

  const tasksMapped = tasksDueSoon
    .filter((t) => t.dueDate)
    .map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate,
      priority: t.priority,
      daysLeft: differenceInDays(new Date(`${t.dueDate}T12:00:00`), new Date(`${today}T12:00:00`)),
    }));

  const opportunitiesMapped = opportunitiesDueSoon
    .filter((o) => o.deadline)
    .map((o) => ({
      id: o.id,
      title: o.title,
      deadline: o.deadline,
      priority: o.priority,
      nextAction: o.nextAction,
      daysLeft: differenceInDays(new Date(`${o.deadline}T12:00:00`), new Date(`${today}T12:00:00`)),
    }));

  return NextResponse.json({
    overdueContacts,
    upcomingBirthdays,
    projectsDueSoon,
    tasksDueSoon: tasksMapped,
    opportunitiesDueSoon: opportunitiesMapped,
    counts: {
      overdue: overdueContacts.length,
      birthdays: upcomingBirthdays.length,
      projectsDue: projectsDueSoon.length,
      tasksDue: tasksMapped.length,
      opportunitiesDue: opportunitiesMapped.length,
    },
  });
}
