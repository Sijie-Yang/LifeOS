import { NextRequest, NextResponse } from "next/server";
import { addDays, format, parseISO, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { isOverdue, toDateString, CLOSED_PROJECT_STATUSES } from "@/lib/utils";
import { habitScheduleLabel, isHabitScheduledOnDateForHabit } from "@/lib/reminders";
import {
  daysBetween,
  isLearningStep,
  isLifePowerKey,
  recentDateStrings,
  type LifePowerDetail,
} from "@/lib/life-powers";

type Params = { params: Promise<{ key: string }> };

const OPEN_OPPORTUNITY = ["Watching", "Active"];

/**
 * 某一力当前关联的全部东西。归属全部显式：
 * 习惯看 Habit.power，项目看 Project.power（任务 / 会议 / 机会跟随项目）；
 * 会议另全部归链接力，机会另全部归机会力。
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { key } = await params;
  if (!isLifePowerKey(key)) {
    return NextResponse.json({ error: "未知的力" }, { status: 404 });
  }
  const date = request.nextUrl.searchParams.get("date") || toDateString();
  const day = parseISO(`${date}T12:00:00`);
  const weekDates = recentDateStrings(date, 7);
  const recentStart = format(subDays(day, 13), "yyyy-MM-dd");
  const historyStart = format(subDays(day, 60), "yyyy-MM-dd");
  const meetingStart = format(subDays(day, 14), "yyyy-MM-dd");
  const meetingEnd = format(addDays(day, 30), "yyyy-MM-dd");

  const [habits, projects, tasks, meetings, opportunities, contacts, contactLogs] = await Promise.all([
    prisma.habit.findMany({
      where: { isActive: true, power: key },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        frequency: true,
        scheduleMode: true,
        daysOfWeek: true,
        monthDays: true,
        checkIns: {
          where: { completed: true, level: { not: "skip" }, date: { gte: historyStart, lte: date } },
          select: { date: true },
        },
      },
    }),
    prisma.project.findMany({
      where: { status: { notIn: CLOSED_PROJECT_STATUSES }, archiveDate: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        power: true,
        category: { select: { name: true } },
        planSteps: {
          orderBy: { sortOrder: "asc" },
          select: { title: true, done: true, doneDate: true },
        },
      },
    }),
    prisma.taskItem.findMany({
      where: { completed: false, cancelled: false, project: { power: key } },
      select: { id: true, title: true, dueDate: true, scheduledDate: true, project: { select: { name: true } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 50,
    }),
    prisma.meeting.findMany({
      where: {
        meetingDate: { gte: meetingStart, lte: meetingEnd },
        status: { not: "Cancelled" },
        ...(key === "social" ? {} : { project: { power: key } }),
      },
      select: { id: true, title: true, meetingDate: true, meetingTime: true, status: true },
      orderBy: [{ meetingDate: "asc" }, { meetingTime: "asc" }],
    }),
    prisma.opportunity.findMany({
      where: {
        AND: [
          {
            OR: [
              { status: { in: OPEN_OPPORTUNITY } },
              { updatedAt: { gte: new Date(`${recentStart}T00:00:00`) } },
            ],
          },
          key === "link" ? {} : { project: { power: key } },
        ],
      },
      select: { id: true, title: true, status: true, deadline: true, nextAction: true, updatedAt: true },
      orderBy: [{ deadline: "asc" }, { updatedAt: "desc" }],
    }),
    key === "social"
      ? prisma.contact.findMany({
          select: { id: true, name: true, lastContactAt: true, contactFrequencyDays: true },
          orderBy: { importance: "desc" },
        })
      : Promise.resolve([]),
    key === "social"
      ? prisma.contactLog.findMany({
          where: { contactedAt: { gte: new Date(`${recentStart}T00:00:00`) } },
          select: { contactedAt: true, type: true, contact: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const recent: LifePowerDetail["recent"] = [];

  const habitRows: LifePowerDetail["habits"] = habits.map((h) => {
    const dates = new Set(h.checkIns.map((c) => c.date));
    const sorted = [...dates].sort();
    for (const d of sorted) if (d >= recentStart) recent.push({ date: d, label: h.name, kind: "habit" });
    return {
      id: h.id,
      name: h.name,
      schedule: habitScheduleLabel(h),
      scheduledToday: isHabitScheduledOnDateForHabit(h, date),
      checkedToday: dates.has(date),
      week: weekDates.map((d) =>
        dates.has(d) ? "done" : isHabitScheduledOnDateForHabit(h, d) ? "missed" : "rest"
      ),
      lastDate: sorted.at(-1) ?? null,
    };
  });

  // 选入该力的项目；学习力另列其他力项目里的学习步骤（学习绑定具体项目）
  const projectRows: LifePowerDetail["projects"] = [];
  for (const p of projects) {
    const selected = p.power === key;
    const steps = selected
      ? p.planSteps
      : key === "learning" && p.power
        ? p.planSteps.filter((st) => isLearningStep(st.title))
        : [];
    if (!selected && steps.length === 0) continue;
    const doneDates = steps.map((st) => st.doneDate).filter((d): d is string => Boolean(d)).sort();
    projectRows.push({
      id: p.id,
      name: p.name,
      category: p.category?.name ?? null,
      done: steps.filter((st) => st.done).length,
      total: steps.length,
      nextStep: steps.find((st) => !st.done)?.title ?? null,
      lastDoneDate: doneDates.at(-1) ?? null,
      selected,
    });
    for (const st of steps) {
      if (st.done && st.doneDate && st.doneDate >= recentStart && st.doneDate <= date) {
        recent.push({ date: st.doneDate, label: `${st.title} → ${p.name}`, kind: "step" });
      }
    }
  }
  projectRows.sort((a, b) => Number(b.selected) - Number(a.selected));

  for (const m of meetings) {
    if (m.status === "Completed" && m.meetingDate >= recentStart && m.meetingDate <= date) {
      recent.push({ date: m.meetingDate, label: m.title, kind: "meeting" });
    }
  }

  const opportunityRows: LifePowerDetail["opportunities"] = [];
  for (const o of opportunities) {
    if (OPEN_OPPORTUNITY.includes(o.status)) {
      opportunityRows.push({
        id: o.id,
        title: o.title,
        status: o.status,
        deadline: o.deadline,
        nextAction: o.nextAction,
      });
    }
    const touched = format(o.updatedAt, "yyyy-MM-dd");
    if (touched >= recentStart && touched <= date) {
      recent.push({ date: touched, label: `${o.status} · ${o.title}`, kind: "opportunity" });
    }
  }

  const contactRows: LifePowerDetail["contacts"] = contacts
    .filter((c) => isOverdue(c.lastContactAt, c.contactFrequencyDays))
    .slice(0, 20)
    .map((c) => ({
      id: c.id,
      name: c.name,
      daysSince: c.lastContactAt ? daysBetween(format(c.lastContactAt, "yyyy-MM-dd"), date) : null,
      frequencyDays: c.contactFrequencyDays,
    }));
  for (const l of contactLogs) {
    recent.push({ date: format(l.contactedAt, "yyyy-MM-dd"), label: `${l.contact.name} · ${l.type}`, kind: "contact" });
  }

  const detail: LifePowerDetail = {
    key,
    habits: habitRows,
    projects: projectRows,
    projectOptions: projects.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category?.name ?? null,
      power: p.power,
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      due: t.dueDate ?? t.scheduledDate,
      projectName: t.project?.name ?? null,
    })),
    meetings: meetings.map((m) => ({
      id: m.id,
      title: m.title,
      date: m.meetingDate,
      time: m.meetingTime,
      status: m.status,
    })),
    opportunities: opportunityRows,
    contacts: contactRows,
    recent: recent.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30),
  };
  return NextResponse.json(detail);
}
