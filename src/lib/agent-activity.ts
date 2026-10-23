export type AgentSource = "cursor" | "codex" | "claude";
export type AgentStatus = "running" | "done";

export type AgentRun = {
  id: string;
  source: AgentSource;
  title: string;
  project: string;
  startedAt: string;
  endedAt: string;
  status: AgentStatus;
  /** Real activity instants. The squares use these instead of a flat start–end span. */
  marks?: string[];
};

/** A transcript still being written counts as running. */
export const AGENT_RUNNING_MS = 2 * 60 * 1000;
/** How often the agent list and the agent squares ask for a fresh read. */
export const AGENT_POLL_MS = 5_000;
/**
 * A Cursor turn updates the chat header before the transcript file.
 * While the header is ahead of the file, the chat is still in progress.
 */
export const AGENT_OPEN_TURN_MS = 20 * 60 * 1000;
/** Fill the half-hours between two activity marks when they are this close. */
export const AGENT_GAP_MS = 45 * 60 * 1000;
/** One session paints at most this much of the day. */
export const AGENT_SPAN_MS = 6 * 60 * 60 * 1000;

/** GitHub contribution greens. Index 0 is an empty cell. */
export const AGENT_GREENS = ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"] as const;

export function agentGreen(count: number): string {
  if (count <= 0) return AGENT_GREENS[0];
  if (count >= 4) return AGENT_GREENS[4];
  return AGENT_GREENS[count];
}

export function agentStatus(endedAtMs: number, nowMs: number): AgentStatus {
  return nowMs - endedAtMs <= AGENT_RUNNING_MS ? "running" : "done";
}

/** Running when the file was just written, or a Cursor turn has started and not flushed yet. */
export function agentIsRunning(fileMs: number, headerMs: number | null, nowMs: number): boolean {
  const latest = Math.max(fileMs, headerMs ?? 0);
  if (nowMs - latest <= AGENT_RUNNING_MS) return true;
  if (headerMs != null && headerMs > fileMs + 15_000 && nowMs - headerMs <= AGENT_OPEN_TURN_MS) return true;
  return false;
}

/** Half-hours that contain activity. Nearby marks are joined; long gaps stay empty. */
export function expandActivity(times: number[], day: string): string[] {
  const points = [...new Set(times.filter((time) => Number.isFinite(time)))].sort((a, b) => a - b);
  const slots = new Set<string>();
  const mark = (time: number) => {
    const at = new Date(time);
    if (localDateKey(at) === day) slots.add(halfHourLabel(at));
  };
  for (let i = 0; i < points.length; i++) {
    mark(points[i]);
    const next = points[i + 1];
    if (next == null || next - points[i] > AGENT_GAP_MS) continue;
    const cursor = new Date(points[i]);
    cursor.setSeconds(0, 0);
    cursor.setMinutes(cursor.getMinutes() < 30 ? 0 : 30);
    for (let time = cursor.getTime(); time <= next; time += 30 * 60 * 1000) mark(time);
  }
  return [...slots];
}

export function sortAgents<T extends { status: AgentStatus; endedAt: string }>(agents: T[]): T[] {
  return [...agents].sort((a, b) => {
    if (a.status !== b.status) return a.status === "running" ? -1 : 1;
    return a.endedAt < b.endedAt ? 1 : a.endedAt > b.endedAt ? -1 : 0;
  });
}

export function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function halfHourLabel(date: Date): string {
  const minute = date.getMinutes() < 30 ? 0 : 30;
  return `${String(date.getHours()).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** How many agents overlap each half-hour on this local day. */
export function agentSlotCounts(
  agents: Array<{ startedAt: string; endedAt: string; marks?: string[] }>,
  day: string
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const agent of agents) {
    const marked = agent.marks?.map((mark) => Date.parse(mark)).filter((time) => Number.isFinite(time));
    const slots = marked && marked.length ? expandActivity(marked, day) : rangeSlots(agent, day);
    for (const slot of slots) counts[slot] = (counts[slot] ?? 0) + 1;
  }
  return counts;
}

function rangeSlots(agent: { startedAt: string; endedAt: string }, day: string): string[] {
  const start = Date.parse(agent.startedAt);
  const end = Date.parse(agent.endedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  return expandActivity([Math.max(start, end - AGENT_SPAN_MS), end], day);
}

export function agentTitle(custom: string | null | undefined, fallback: string): string {
  const name = custom?.replace(/\s+/g, " ").trim();
  if (name) return name.slice(0, 80);
  return fallback;
}

export function cursorProjectName(folder: string): string {
  const stripped = folder.replace(/^Users-[^-]+-/, "").replace(/^Documents-/, "");
  return stripped || folder;
}

export function cursorTitleFromHead(head: string): string | null {
  const match = head.match(/<user_query>\s*([\s\S]*?)\s*<\/user_query>/);
  if (!match) return null;
  const text = match[1]
    .replace(/\\n/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  return text.slice(0, 80);
}

const CODEX_SKIP =
  /AGENTS\.md|base_instructions|<permissions|Codex agent history|developer instructions/i;

export function codexTitleFromHead(head: string, fallback: string): string {
  for (const line of head.split("\n")) {
    if (!line.includes('"role":"user"') && !line.includes('"type":"user"')) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    const text = extractText(parsed).replace(/\s+/g, " ").trim();
    if (!text || text.length < 4 || text.startsWith("<") || CODEX_SKIP.test(text)) continue;
    return text.slice(0, 80);
  }
  return fallback;
}

function extractText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const obj = value as Record<string, unknown>;
  const payload =
    obj.payload && typeof obj.payload === "object" ? (obj.payload as Record<string, unknown>) : obj;
  const message =
    payload.message && typeof payload.message === "object"
      ? (payload.message as Record<string, unknown>)
      : payload;
  const content = message.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
        return (part as { text: string }).text;
      }
      return "";
    })
    .join(" ");
}

/** `rollout-2026-10-06T08-31-37-<thread id>.jsonl` */
export function codexThreadId(fileName: string): string | null {
  const match = fileName.match(/^rollout-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-(.+)\.jsonl$/);
  return match?.[1] ?? null;
}

export function codexStartedMs(fileName: string): number | null {
  const match = fileName.match(/rollout-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, date, hour, minute, second] = match;
  const parsed = new Date(`${date}T${hour}:${minute}:${second}`).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

/** Sessions that began before today, or ran longer than the cap, only mark their latest half-hour. */
export function activityStartMs(startedMs: number, endedMs: number, dayStartMs: number): number {
  if (!Number.isFinite(startedMs) || startedMs < dayStartMs || endedMs - startedMs > AGENT_SPAN_MS) {
    return endedMs;
  }
  return startedMs;
}
