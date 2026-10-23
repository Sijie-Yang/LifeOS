import { NextRequest, NextResponse } from "next/server";
import { addDays, format, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { toDateString, getWeekStart, CLOSED_PROJECT_STATUSES } from "@/lib/utils";
import { parseClockTime, parseWellnessScore } from "@/lib/wellness-scores";
import { sleepDurationHours } from "@/lib/sleep-window";
import { parseTimeFills } from "@/lib/time-fills";
import { parsePlanScore, parseRecordExtras, parseRecordNotes, setRecordNote } from "@/lib/day-record";
import { ROOM_ZONES, markZoneCleaned, parseRoomDone, parseRoomZones, roomLastDone, setRoomZone, toggleRoomDone } from "@/lib/room-plan";
import { URGE_TRANSFER_CATEGORY, eventLabel, isTransfer, keptStreak, transferDates } from "@/lib/urge-transfer";
import { isHabitScheduledOnDateForHabit } from "@/lib/reminders";
import { roomZonesFor } from "@/lib/room-store";
import { normalizeMustDo, parseMustDo, type MustDoItem } from "@/lib/accountability";
import { parsePriorities } from "@/lib/weekly-plan";
import {
  mapStepsToDates,
  type MappedPlanStep,
  type ProjectPlanFields,
  type ProjectPlanStepDto,
} from "@/lib/project-plan";
import {
  computeLifePowers,
  mergeMustDoItems,
  pickUrgentMustDos,
  type MustDoResolved,
} from "@/lib/life-powers";
import { UI_COPY } from "@/lib/ui-copy";

type EnrichedPlanStep = MappedPlanStep & {
  /** 所属项目选入的九力 */
  projectPower: string | null;
};

function resolveMustDo(
  items: MustDoItem[],
  habits: Array<{ id: string; name: string; color: string; checked: boolean }>,
  tasks: Array<{ id: string; title: string; completed: boolean }>,
  priorities: Array<{ id: string; title: string; completed: boolean }>
): MustDoResolved[] {
  const habitMap = new Map(habits.map((h) => [h.id, h]));
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const priorityMap = new Map(priorities.map((p) => [p.id, p]));
  return items
    .map((item) => {
      if (item.type === "habit") {
        const h = habitMap.get(item.id);
        if (!h) return null;
        return { type: "habit" as const, id: h.id, label: h.name, done: h.checked };
      }
      if (item.type === "task") {
        const t = taskMap.get(item.id);
        if (!t) return null;
        return { type: "task" as const, id: t.id, label: t.title, done: t.completed };
      }
      if (item.type === "priority") {
        const p = priorityMap.get(item.id);
        return {
          type: "priority" as const,
          id: item.id,
          label: item.title || p?.title || "本周优先级",
          done: item.done ?? p?.completed ?? false,
        };
      }
      return null;
    })
    .filter(Boolean) as MustDoResolved[];
}

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") || toDateString();
  const today = toDateString();
  const weekStart = getWeekStart(new Date(`${date}T12:00:00`));
  const lookbackStart = format(subDays(parseISOSafe(date), 45), "yyyy-MM-dd");

  const [
    log,
    allHabits,
    todayCheckIns,
    tasks,
    meetings,
    weeklyPlan,
    projects,
    contactLogsRecent,
    contactLogsToday,
    lastCompletedMeeting,
    stepHistory,
    habitHistory,
    openOpportunities,
    recentOpportunity,
    selectedProjects,
  ] = await Promise.all([
    prisma.dailyLog.findUnique({ where: { date } }),
    prisma.habit.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.habitCheckIn.findMany({ where: { date } }),
    prisma.taskItem.findMany({
      where: {
        cancelled: false,
        AND: [
          { OR: [{ dueDate: date }, { scheduledDate: date }] },
          { OR: [{ projectId: null }, { meetingId: { not: null } }] },
        ],
      },
      include: { project: { select: { power: true } } },
      orderBy: [{ completed: "asc" }, { priority: "desc" }],
    }),
    prisma.meeting.findMany({
      where: { OR: [{ meetingDate: date }, { status: "NeedsReview" }] },
      include: {
        project: { select: { id: true, name: true } },
        attendees: { include: { contact: { select: { id: true, name: true } } } },
      },
      orderBy: { meetingTime: "asc" },
    }),
    prisma.weeklyPlan.findUnique({ where: { weekStart } }),
    prisma.project.findMany({
      where: { planActive: true, status: { notIn: CLOSED_PROJECT_STATUSES }, archiveDate: null },
      include: {
        category: { select: { color: true, name: true } },
        goal: { select: { area: true } },
        planSteps: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.contactLog.findFirst({
      where: { contactedAt: { lte: new Date(`${date}T23:59:59`) } },
      orderBy: { contactedAt: "desc" },
      select: { contactedAt: true },
    }),
    prisma.contactLog.count({
      where: {
        contactedAt: {
          gte: new Date(`${date}T00:00:00`),
          lte: new Date(`${date}T23:59:59`),
        },
      },
    }),
    prisma.meeting.findFirst({
      where: { status: "Completed", meetingDate: { lte: date } },
      orderBy: { meetingDate: "desc" },
      select: { meetingDate: true },
    }),
    // 九力：选入项目里近期完成的步骤
    prisma.projectPlanStep.findMany({
      where: {
        done: true,
        doneDate: { not: null, gte: lookbackStart, lte: date },
        project: { power: { not: null } },
      },
      select: { title: true, detail: true, doneDate: true, project: { select: { power: true } } },
    }),
    prisma.habitCheckIn.findMany({
      where: {
        completed: true,
        date: { gte: lookbackStart, lte: date },
        level: { not: "skip" },
      },
      select: { habitId: true, date: true, level: true },
    }),
    prisma.opportunity.findMany({
      where: {
        OR: [
          { status: { in: ["Watching", "Active"] } },
          {
            status: "Won",
            updatedAt: {
              gte: new Date(`${date}T00:00:00`),
              lte: new Date(`${date}T23:59:59`),
            },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        deadline: true,
        createdAt: true,
        updatedAt: true,
        pushedDate: true,
      },
      orderBy: [{ deadline: "asc" }, { updatedAt: "desc" }],
      take: 40,
    }),
    prisma.opportunity.findFirst({
      // 今天取消过推进的不算最近一次推进
      where: { updatedAt: { lte: new Date(`${date}T23:59:59`) }, NOT: { pushedDate: `undo:${date}` } },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true, createdAt: true },
    }),
    prisma.project.findMany({
      where: { power: { not: null }, status: { notIn: CLOSED_PROJECT_STATUSES }, archiveDate: null },
      select: { id: true, name: true, power: true, planSteps: { select: { done: true } } },
    }),
  ]);

  const checkedIds = new Set(todayCheckIns.filter((c) => c.completed).map((c) => c.habitId));
  const checkInMap = new Map(todayCheckIns.map((c) => [c.habitId, c]));
  const habits = allHabits.filter((h) => isHabitScheduledOnDateForHabit(h, date));
  const mustDo = parseMustDo(log?.mustDo);
  const weeklyPriorities = parsePriorities(weeklyPlan?.priorities);

  const planSteps: EnrichedPlanStep[] = [];

  for (const project of projects) {
    const planProject: ProjectPlanFields = {
      id: project.id,
      name: project.name,
      planActive: project.planActive,
      planWorkdays: project.planWorkdays,
      planAnchorDate: project.planAnchorDate,
      planSkipDates: project.planSkipDates,
      planExtraDates: project.planExtraDates,
      startDate: project.startDate,
      category: project.category,
    };
    const steps: ProjectPlanStepDto[] = project.planSteps.map((s) => ({
      id: s.id,
      projectId: s.projectId,
      sortOrder: s.sortOrder,
      title: s.title,
      detail: s.detail,
      estMinutes: s.estMinutes,
      milestoneId: s.milestoneId,
      isMilestone: s.isMilestone,
      done: s.done,
      doneDate: s.doneDate,
      scheduledDate: s.scheduledDate,
    }));
    const { byDate } = mapStepsToDates(planProject, steps, today);
    for (const step of byDate[date] ?? []) {
      planSteps.push({ ...step, projectPower: project.power });
    }
  }

  const todayMeetings = meetings.filter((m) => m.meetingDate === date && m.status !== "NeedsReview");
  const reviewMeetings = meetings.filter((m) => m.status === "NeedsReview");
  const promotion: never[] = [];

  const lastContactDate = contactLogsRecent
    ? format(contactLogsRecent.contactedAt, "yyyy-MM-dd")
    : null;
  const lastMeetingDate = lastCompletedMeeting?.meetingDate ?? null;
  const lastSocialDate =
    !lastContactDate && !lastMeetingDate
      ? null
      : !lastContactDate
        ? lastMeetingDate
        : !lastMeetingDate
          ? lastContactDate
          : lastContactDate > lastMeetingDate
            ? lastContactDate
            : lastMeetingDate;

  const opportunityPayload = openOpportunities.map((o) => {
    const created = format(o.createdAt, "yyyy-MM-dd");
    const updated = format(o.updatedAt, "yyyy-MM-dd");
    return {
      id: o.id,
      title: o.title,
      status: o.status,
      deadline: o.deadline,
      activityDate: updated > created ? updated : created,
      pushedDate: o.pushedDate,
    };
  });
  const lastLinkDate = recentOpportunity
    ? format(recentOpportunity.updatedAt, "yyyy-MM-dd")
    : null;

  const habitPayload = habits.map((h) => {
    const ci = checkInMap.get(h.id);
    return {
      id: h.id,
      name: h.name,
      color: h.color,
      cue: h.cue,
      minimumVersion: h.minimumVersion,
      startTime: h.startTime,
      checked: checkedIds.has(h.id),
      level: ci?.level ?? null,
      power: h.power,
    };
  });

  // 冲动 · 转化（冲动管理里的私密分类）
  const urge = await loadUrgeTransfer(date, log?.urgeMorning ?? null);
  const room = await loadRoom(date, log?.roomZones ?? null, log?.roomDone ?? null, lookbackStart);

  const lifePowers = computeLifePowers({
    date,
    habits: habits.map((h) => ({
      id: h.id,
      name: h.name,
      checked: checkedIds.has(h.id),
      level: checkInMap.get(h.id)?.level ?? null,
      power: h.power,
    })),
    lockedHabits: allHabits.map((h) => ({ id: h.id, power: h.power })),
    habitHistory: habitHistory.map((h) => ({
      habitId: h.habitId,
      date: h.date,
      level: h.level,
    })),
    planStepsToday: planSteps.map((s) => ({
      id: s.id,
      title: s.title,
      detail: s.detail,
      done: s.done,
      projectName: s.projectName,
      projectPower: s.projectPower,
    })),
    stepHistory: stepHistory
      .filter((s) => s.doneDate && s.project.power)
      .map((s) => ({ power: s.project.power!, title: s.title, detail: s.detail, doneDate: s.doneDate! })),
    projects: selectedProjects.map((p) => ({
      id: p.id,
      name: p.name,
      power: p.power!,
      done: p.planSteps.filter((st) => st.done).length,
      total: p.planSteps.length,
    })),
    meetings: todayMeetings.map((m) => ({
      id: m.id,
      title: m.title,
      status: m.status,
    })),
    lastSocialDate,
    contactLogsToday,
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      completed: t.completed,
      projectPower: t.project?.power ?? null,
    })),
    opportunities: opportunityPayload,
    lastLinkDate,
    urgeTransferDates: urge.transferDates,
    urgeTransfersToday: urge.brokeToday
      ? []
      : urge.today
          .filter((e) => isTransfer(e))
          .map((e) => ({ type: "urge" as const, id: e.id, label: `${UI_COPY.urgeTransferLabel} · ${e.label}`, done: true })),
    roomCleanDates: room.cleanDates,
    roomDoneToday: room.done.map((k) => ({
      type: "room" as const,
      id: k,
      label: `房间 · ${ROOM_ZONES.find((z) => z.key === k)?.name ?? k}`,
      done: true,
    })),
    roomZoneLastDone: room.lastDone,
    roomZoneNames: Object.fromEntries(ROOM_ZONES.map((z) => [z.key, z.name])),
  });

  // 体重：当天没称时，界面从最近一次开始选
  const lastWeight = await prisma.dailyLog.findFirst({
    where: { date: { lte: date }, weightKg: { not: null } },
    orderBy: { date: "desc" },
    select: { weightKg: true, date: true },
  });

  const yesterday = format(subDays(parseISOSafe(date), 1), "yyyy-MM-dd");
  const previousNight = await prisma.dailyLog.findUnique({
    where: { date: yesterday },
    select: { sleepTime: true, plannedSleepTime: true },
  });
  const previousBedtime = previousNight?.sleepTime || null;

  const storedMustDo = resolveMustDo(
    mustDo,
    habitPayload,
    tasks.map((t) => ({ id: t.id, title: t.title, completed: t.completed })),
    weeklyPriorities
  );
  const urgentMustDo = pickUrgentMustDos(lifePowers);
  const mustDoItems = mergeMustDoItems(urgentMustDo, storedMustDo, 3);

  return NextResponse.json({
    date,
    weekStart,
    weeklyPlan: weeklyPlan
      ? {
          intention: weeklyPlan.intention,
          priorities: weeklyPriorities,
        }
      : null,
    log: log
      ? {
          content: log.content,
          mustDo,
          closedAt: log.closedAt?.toISOString() ?? null,
          closeNote: log.closeNote,
          energy: log.energy,
          mood: log.mood,
          sleepHours: log.sleepHours,
          energyMorning: log.energyMorning,
          drainMorning: log.drainMorning,
          sleepScore: log.sleepScore,
          wakeTime: log.wakeTime,
          plannedSleepTime: log.plannedSleepTime,
          sleepTime: log.sleepTime,
          timeFills: parseTimeFills(log.timeFills),
          energyEvening: log.energyEvening,
          drainEvening: log.drainEvening,
          reflection: log.reflection,
          recordNotes: parseRecordNotes(log.recordNotes),
          recordExtras: parseRecordExtras(log.recordExtras),
          planScore: log.planScore,
          planScoreNote: log.planScoreNote,
          weightKg: log.weightKg,
          urgeMorning: log.urgeMorning,
          exerciseStartTime: log.exerciseStartTime,
          exerciseMinutes: log.exerciseMinutes,
          exerciseCalories: log.exerciseCalories,
          waistCm: log.waistCm,
          bodyNote: log.bodyNote,
          roomZones: parseRoomZones(log.roomZones),
        }
      : null,
    // 房间：今天没打分就沿用最近一次的分数（roomCarriedFrom = 那一天）
    room: { zones: room.zones, carriedFrom: room.carriedFrom, done: room.done },
    previousBedtime,
    lastWeight: lastWeight ? { kg: lastWeight.weightKg!, date: lastWeight.date } : null,
    urge: {
      categoryId: urge.categoryId,
      morning: log?.urgeMorning ?? null,
      today: urge.today,
      streak: urge.streak,
      brokeToday: urge.brokeToday,
    },
    mustDoItems,
    lifePowers,
    habits: habitPayload,
    tasks,
    meetings: todayMeetings.map((m) => ({
      id: m.id,
      title: m.title,
      meetingDate: m.meetingDate,
      meetingTime: m.meetingTime,
      status: m.status,
      purpose: m.purpose,
      category: m.category,
      projectId: m.projectId,
      projectName: m.project?.name ?? null,
      attendees: m.attendees.map((a) => ({
        id: a.contact.id,
        name: a.contact.name,
      })),
    })),
    reviewMeetings: reviewMeetings.map((m) => ({
      id: m.id,
      title: m.title,
      meetingDate: m.meetingDate,
      meetingTime: m.meetingTime,
      status: m.status,
      projectId: m.projectId,
      projectName: m.project?.name ?? null,
    })),
    planSteps,
    promotion,
  });
}

/** 冲动 · 转化：分类（没有就建一个私密的）、今天的冲动、连续守住天数、计入定力的日期 */
/** 当天的分区分数；还没打过分就沿用最近一次打分的那天（60 天内） */
/** 房间：分数（含沿用）、今天打勾的分区、清过的日期（计入清洁力）、每个分区最近一次清理 */
async function loadRoom(date: string, zonesRaw: string | null, doneRaw: string | null, since: string) {
  let zones = parseRoomZones(zonesRaw);
  let carriedFrom: string | null = null;
  if (Object.keys(zones).length === 0) {
    const prev = await prisma.dailyLog.findFirst({
      where: { date: { lt: date, gte: format(subDays(parseISOSafe(date), 60), "yyyy-MM-dd") }, NOT: { roomZones: "{}" } },
      orderBy: { date: "desc" },
      select: { date: true, roomZones: true },
    });
    if (prev) {
      zones = parseRoomZones(prev.roomZones);
      carriedFrom = prev.date;
    }
  }
  const history = await prisma.dailyLog.findMany({
    where: { date: { gte: since, lte: date }, NOT: { roomDone: "[]" } },
    orderBy: { date: "asc" },
    select: { date: true, roomDone: true },
  });
  return {
    zones,
    carriedFrom,
    done: parseRoomDone(doneRaw),
    cleanDates: history.filter((h) => parseRoomDone(h.roomDone).length > 0).map((h) => h.date),
    lastDone: roomLastDone(history),
  };
}

async function loadUrgeTransfer(date: string, morning: number | null) {
  const category =
    (await prisma.urgeCategory.findFirst({ where: { name: URGE_TRANSFER_CATEGORY } })) ??
    (await prisma.urgeCategory.create({
      data: { name: URGE_TRANSFER_CATEGORY, color: "#ec4899", goal: "减少", isPrivate: true },
    }));
  const since = format(subDays(parseISOSafe(date), 400), "yyyy-MM-dd");
  const [events, scored, oldHabit] = await Promise.all([
    prisma.urgeEvent.findMany({
      where: { categoryId: category.id, date: { gte: since, lte: date } },
      orderBy: { occurredAt: "asc" },
      select: { id: true, date: true, outcome: true, redirect: true, intensity: true, trigger: true, occurredAt: true },
    }),
    prisma.dailyLog.findMany({
      where: { date: { gte: since, lte: date }, urgeMorning: { not: null } },
      select: { date: true },
    }),
    // 同名习惯（「冲动转化」）的打卡也算守住的记录
    prisma.habitCheckIn.findMany({
      where: { date: { gte: since, lte: date }, completed: true, habit: { name: URGE_TRANSFER_CATEGORY } },
      select: { date: true },
    }),
  ]);
  const today = events
    .filter((e) => e.date === date)
    .map((e) => ({
      id: e.id,
      time: format(e.occurredAt, "HH:mm"),
      outcome: e.outcome,
      redirect: e.redirect,
      intensity: e.intensity,
      trigger: e.trigger,
      label: eventLabel(e),
    }));
  return {
    categoryId: category.id,
    today,
    brokeToday: today.some((e) => e.outcome === "gave_in"),
    transferDates: transferDates(events),
    streak: keptStreak({
      today: date,
      events,
      recordedDates: [...scored.map((d) => d.date), ...oldHabit.map((d) => d.date), ...(morning != null ? [date] : [])],
    }),
  };
}

/** 非负整数，超过上限或不是数字时为空 */
function parseCount(value: unknown, max: number): number | null {
  if (value == null || value === "") return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}

function parseISOSafe(date: string): Date {
  return new Date(`${date}T12:00:00`);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const date = body.date || toDateString();

  const update: {
    content?: string | null;
    noteId?: string | null;
    mustDo?: string;
    closedAt?: Date;
    closeNote?: string | null;
    energy?: number | null;
    mood?: number | null;
    sleepHours?: number | null;
    energyMorning?: number | null;
    drainMorning?: number | null;
    sleepScore?: number | null;
    wakeTime?: string | null;
    plannedSleepTime?: string | null;
    sleepTime?: string | null;
    timeFills?: string;
    energyEvening?: number | null;
    drainEvening?: number | null;
    urgeMorning?: number | null;
    reflection?: string | null;
    recordNotes?: string;
    recordExtras?: string;
    planScore?: number | null;
    planScoreNote?: string | null;
    weightKg?: number | null;
    exerciseStartTime?: string | null;
    exerciseMinutes?: number | null;
    exerciseCalories?: number | null;
    waistCm?: number | null;
    bodyNote?: string | null;
    roomZones?: string;
    roomDone?: string;
  } = {};

  if (body.content !== undefined) update.content = body.content || null;
  if (body.noteId !== undefined) update.noteId = body.noteId || null;
  if (body.mustDo !== undefined) {
    update.mustDo = JSON.stringify(normalizeMustDo(body.mustDo as MustDoItem[]));
  }
  if (body.energy !== undefined) update.energy = body.energy == null ? null : Number(body.energy);
  if (body.mood !== undefined) update.mood = body.mood == null ? null : Number(body.mood);
  if (body.sleepHours !== undefined) {
    update.sleepHours = body.sleepHours == null ? null : Number(body.sleepHours);
  }
  if (body.energyMorning !== undefined) update.energyMorning = parseWellnessScore(body.energyMorning);
  if (body.drainMorning !== undefined) update.drainMorning = parseWellnessScore(body.drainMorning);
  if (body.sleepScore !== undefined) update.sleepScore = parseWellnessScore(body.sleepScore);
  if (body.wakeTime !== undefined) update.wakeTime = parseClockTime(body.wakeTime);
  if (body.plannedSleepTime !== undefined) update.plannedSleepTime = parseClockTime(body.plannedSleepTime);
  if (body.sleepTime !== undefined) update.sleepTime = parseClockTime(body.sleepTime);
  if (body.timeFills !== undefined) update.timeFills = JSON.stringify(parseTimeFills(body.timeFills));
  if (body.energyEvening !== undefined) update.energyEvening = parseWellnessScore(body.energyEvening);
  if (body.drainEvening !== undefined) update.drainEvening = parseWellnessScore(body.drainEvening);
  if (body.urgeMorning !== undefined) update.urgeMorning = parseWellnessScore(body.urgeMorning);
  if (body.reflection !== undefined) update.reflection = body.reflection?.trim() || null;
  // 记录段：一次改一条批注（{ key, text }），多做的事整体替换
  let recordNotes: string | undefined;
  if (body.recordNote && typeof body.recordNote.key === "string") {
    const existing = await prisma.dailyLog.findUnique({ where: { date }, select: { recordNotes: true } });
    recordNotes = JSON.stringify(
      setRecordNote(parseRecordNotes(existing?.recordNotes), body.recordNote.key, String(body.recordNote.text ?? ""))
    );
    update.recordNotes = recordNotes;
  }
  if (body.recordExtras !== undefined) update.recordExtras = JSON.stringify(parseRecordExtras(body.recordExtras));
  if (body.planScore !== undefined) update.planScore = parsePlanScore(body.planScore);
  if (body.planScoreNote !== undefined) update.planScoreNote = body.planScoreNote?.trim() || null;
  if (body.weightKg !== undefined) update.weightKg = body.weightKg == null ? null : Number(body.weightKg);
  if (body.exerciseStartTime !== undefined) update.exerciseStartTime = parseClockTime(body.exerciseStartTime);
  if (body.exerciseMinutes !== undefined) update.exerciseMinutes = parseCount(body.exerciseMinutes, 24 * 60);
  if (body.exerciseCalories !== undefined) update.exerciseCalories = parseCount(body.exerciseCalories, 10000);
  if (body.waistCm !== undefined) update.waistCm = body.waistCm == null ? null : Number(body.waistCm);
  if (body.bodyNote !== undefined) update.bodyNote = body.bodyNote?.trim() || null;
  // 房间分区打分：一次改一个分区（{ key, score }，score 为 null 则清掉），或整体替换
  let roomZones: string | undefined;
  let roomDone: string | undefined;
  if (body.roomZone && typeof body.roomZone.key === "string") {
    const base = await roomZonesFor(date);
    roomZones = JSON.stringify(setRoomZone(base, body.roomZone.key, body.roomZone.score));
    update.roomZones = roomZones;
  } else if (body.roomTask && typeof body.roomTask.key === "string") {
    // 清洁策略打勾：记进 roomDone；做完的分区按「良」算
    const existing = await prisma.dailyLog.findUnique({ where: { date }, select: { roomDone: true } });
    const on = body.roomTask.done !== false;
    roomDone = JSON.stringify(toggleRoomDone(parseRoomDone(existing?.roomDone), body.roomTask.key, on));
    update.roomDone = roomDone;
    if (on && ROOM_ZONES.some((z) => z.key === body.roomTask.key)) {
      roomZones = JSON.stringify(markZoneCleaned(await roomZonesFor(date), body.roomTask.key));
      update.roomZones = roomZones;
    }
  } else if (body.roomZones !== undefined) {
    roomZones = JSON.stringify(parseRoomZones(body.roomZones));
    update.roomZones = roomZones;
  }
  if (body.close === true) {
    update.closedAt = new Date();
    if (body.closeNote !== undefined) update.closeNote = body.closeNote?.trim() || null;
  }
  if (body.sleepHours === undefined && update.wakeTime !== undefined) {
    const yesterday = format(subDays(parseISOSafe(date), 1), "yyyy-MM-dd");
    const previousNight = await prisma.dailyLog.findUnique({
      where: { date: yesterday },
      select: { sleepTime: true },
    });
    const hours = sleepDurationHours(previousNight?.sleepTime ?? null, update.wakeTime);
    if (hours != null) update.sleepHours = hours;
  }

  const log = await prisma.dailyLog.upsert({
    where: { date },
    create: {
      date,
      content: body.content || null,
      noteId: body.noteId || null,
      mustDo: body.mustDo ? JSON.stringify(normalizeMustDo(body.mustDo)) : "[]",
      energy: body.energy != null ? Number(body.energy) : null,
      mood: body.mood != null ? Number(body.mood) : null,
      sleepHours:
        update.sleepHours !== undefined
          ? update.sleepHours
          : body.sleepHours != null
            ? Number(body.sleepHours)
            : null,
      energyMorning: parseWellnessScore(body.energyMorning),
      drainMorning: parseWellnessScore(body.drainMorning),
      sleepScore: parseWellnessScore(body.sleepScore),
      wakeTime: parseClockTime(body.wakeTime),
      plannedSleepTime: parseClockTime(body.plannedSleepTime),
      sleepTime: parseClockTime(body.sleepTime),
      timeFills: JSON.stringify(parseTimeFills(body.timeFills)),
      energyEvening: parseWellnessScore(body.energyEvening),
      drainEvening: parseWellnessScore(body.drainEvening),
      urgeMorning: parseWellnessScore(body.urgeMorning),
      reflection: body.reflection?.trim() || null,
      weightKg: body.weightKg != null ? Number(body.weightKg) : null,
      exerciseStartTime: update.exerciseStartTime ?? null,
      exerciseMinutes: update.exerciseMinutes ?? null,
      exerciseCalories: update.exerciseCalories ?? null,
      waistCm: body.waistCm != null ? Number(body.waistCm) : null,
      bodyNote: body.bodyNote?.trim() || null,
      ...(recordNotes !== undefined ? { recordNotes } : {}),
      ...(update.recordExtras !== undefined ? { recordExtras: update.recordExtras } : {}),
      ...(roomZones !== undefined ? { roomZones } : {}),
      ...(roomDone !== undefined ? { roomDone } : {}),
      planScore: update.planScore ?? null,
      planScoreNote: update.planScoreNote ?? null,
      ...(body.close === true
        ? { closedAt: new Date(), closeNote: body.closeNote?.trim() || null }
        : {}),
    },
    update,
  });

  if (update.sleepTime) {
    const nextDate = format(addDays(parseISOSafe(date), 1), "yyyy-MM-dd");
    const nextMorning = await prisma.dailyLog.findUnique({
      where: { date: nextDate },
      select: { wakeTime: true },
    });
    const hours = sleepDurationHours(update.sleepTime, nextMorning?.wakeTime ?? null);
    if (hours != null && nextMorning) {
      await prisma.dailyLog.update({
        where: { date: nextDate },
        data: { sleepHours: hours },
      });
    }
  }

  return NextResponse.json({
    ...log,
    mustDo: parseMustDo(log.mustDo),
  });
}
