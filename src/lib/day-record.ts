/**
 * 记录段：做了的写「多做了什么」，没做的必须写原因，另外可以加计划外多做的事。
 * 存在 DailyLog.recordNotes / recordExtras（JSON 字符串）。
 */
export type RecordKind = "step" | "task" | "habit";

/** {"step:<id>": "…"} */
export type RecordNotes = Record<string, string>;

export type RecordExtra = { id: string; title: string };

export function recordKey(kind: RecordKind, id: string): string {
  return `${kind}:${id}`;
}

export function parseRecordNotes(value: unknown): RecordNotes {
  let raw = value;
  if (typeof value === "string") {
    try {
      raw = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: RecordNotes = {};
  for (const [k, v] of Object.entries(raw)) {
    if (/^(step|task|habit):.+/.test(k) && typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}

export function parseRecordExtras(value: unknown): RecordExtra[] {
  let raw = value;
  if (typeof value === "string") {
    try {
      raw = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((e) => (e && typeof e === "object" ? (e as Record<string, unknown>) : {}))
    .filter((e) => typeof e.id === "string" && typeof e.title === "string" && e.title.trim())
    .map((e) => ({ id: e.id as string, title: (e.title as string).trim() }));
}

/** 写一条批注；空字符串 = 删掉 */
export function setRecordNote(notes: RecordNotes, key: string, text: string): RecordNotes {
  const next = { ...notes };
  if (text.trim()) next[key] = text.trim();
  else delete next[key];
  return next;
}

export function parsePlanScore(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}
