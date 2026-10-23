/** Calendar-day calculations: contact cadence is a date, not an elapsed-hour timer. */
export type MaintainableContact = {
  lastContactAt: string | null;
  contactFrequencyDays: number;
  importance: number;
};

function dayNumber(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
}

export function contactDue(contact: MaintainableContact, now = new Date()) {
  const last = contact.lastContactAt ? new Date(contact.lastContactAt) : null;
  if (!last || !Number.isFinite(last.getTime())) {
    return { status: "never" as const, daysUntil: null, label: "尚未联系" };
  }
  const daysUntil = dayNumber(last) + Math.max(1, contact.contactFrequencyDays) - dayNumber(now);
  return {
    status: daysUntil <= 0 ? "due" as const : daysUntil <= 7 ? "soon" as const : "ok" as const,
    daysUntil,
    label: daysUntil < 0 ? `已逾期 ${-daysUntil} 天` : daysUntil === 0 ? "今天联系" : `${daysUntil} 天后联系`,
  };
}

export function compareContactPriority(a: MaintainableContact, b: MaintainableContact, now = new Date()) {
  const aa = contactDue(a, now);
  const bb = contactDue(b, now);
  const rank = { due: 0, never: 1, soon: 2, ok: 3 };
  return rank[aa.status] - rank[bb.status] || b.importance - a.importance ||
    (aa.daysUntil ?? 0) - (bb.daysUntil ?? 0);
}

export function validateCircle(input: unknown): { name: string; color: string } {
  if (!input || typeof input !== "object") throw new Error("请填写圈子名称");
  const body = input as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 60) throw new Error("圈子名称需为 1–60 个字符");
  const color = body.color ?? "#6366f1";
  if (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)) throw new Error("请选择有效的圈子颜色");
  return { name, color };
}
