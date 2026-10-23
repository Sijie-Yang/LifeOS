export type LifeStrategyPhaseStatus = "planned" | "active" | "completed" | "revised";

export const PHASE_STATUS_LABELS: Record<LifeStrategyPhaseStatus, string> = {
  planned: "计划中",
  active: "进行中",
  completed: "已完成",
  revised: "已调整",
};

export function parseJsonArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export function parseJsonRecord(raw: string): Record<string, number | string> {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

export type LifeStrategyPhaseDto = {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  timeSplit: Record<string, number | string>;
  priorities: string[];
  doList: string[];
  dontList: string[];
  content: string | null;
  sortOrder: number;
  entries?: LifeStrategyEntryDto[];
};

export type LifeStrategyEntryDto = {
  id: string;
  phaseId: string | null;
  date: string;
  title: string;
  content: string;
  source: string | null;
  tags: string[];
  sortOrder: number;
};

export type LifeStrategyPayload = {
  meta: {
    northStar: string | null;
    decisionFilter: string | null;
    operatingSystem: string | null;
    updatedAt: string;
  };
  phases: LifeStrategyPhaseDto[];
  entries: LifeStrategyEntryDto[];
};

export function serializePhaseBody(body: Record<string, unknown>) {
  return {
    ...(body.title !== undefined && { title: String(body.title) }),
    ...(body.summary !== undefined && { summary: body.summary ? String(body.summary) : null }),
    ...(body.status !== undefined && { status: String(body.status) }),
    ...(body.startDate !== undefined && { startDate: body.startDate ? String(body.startDate) : null }),
    ...(body.endDate !== undefined && { endDate: body.endDate ? String(body.endDate) : null }),
    ...(body.timeSplit !== undefined && {
      timeSplit: JSON.stringify(body.timeSplit ?? {}),
    }),
    ...(body.priorities !== undefined && {
      priorities: JSON.stringify(body.priorities ?? []),
    }),
    ...(body.doList !== undefined && { doList: JSON.stringify(body.doList ?? []) }),
    ...(body.dontList !== undefined && { dontList: JSON.stringify(body.dontList ?? []) }),
    ...(body.content !== undefined && { content: body.content ? String(body.content) : null }),
    ...(body.sortOrder !== undefined && { sortOrder: Number(body.sortOrder) }),
  };
}

export function mapPhase(row: {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  timeSplit: string;
  priorities: string;
  doList: string;
  dontList: string;
  content: string | null;
  sortOrder: number;
}): LifeStrategyPhaseDto {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    status: row.status,
    startDate: row.startDate,
    endDate: row.endDate,
    timeSplit: parseJsonRecord(row.timeSplit),
    priorities: parseJsonArray(row.priorities),
    doList: parseJsonArray(row.doList),
    dontList: parseJsonArray(row.dontList),
    content: row.content,
    sortOrder: row.sortOrder,
  };
}

export function mapEntry(row: {
  id: string;
  phaseId: string | null;
  date: string;
  title: string;
  content: string;
  source: string | null;
  tags: string;
  sortOrder: number;
}): LifeStrategyEntryDto {
  return {
    id: row.id,
    phaseId: row.phaseId,
    date: row.date,
    title: row.title,
    content: row.content,
    source: row.source,
    tags: parseJsonArray(row.tags),
    sortOrder: row.sortOrder,
  };
}
