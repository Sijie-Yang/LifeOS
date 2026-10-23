/**
 * Grounded crush analysis from LifeOS records.
 * Common relationship-coaching frames (relation type, initiative, availability, stop-loss),
 * but only what contact logs / notes / meetings can support.
 * Does not diagnose attachment or answer "do they like me".
 */

export type CrushRelationKind =
  | "insufficient"
  | "one_sided"
  | "friend_boundary"
  | "cooling"
  | "closed";

export type CrushEvidenceLevel = "thin" | "moderate" | "enough";

export type CrushFinding = {
  title: string;
  detail: string;
  evidence: string | null;
};

export type CrushAnalysisInput = {
  name: string;
  notes: string | null;
  importance: number;
  responseLevel: number | null;
  lastContactAt: Date | string | null;
  contactFrequencyDays: number;
  now?: Date;
  logs: Array<{
    type: string;
    content: string | null;
    contactedAt: Date | string;
  }>;
  meetings: Array<{
    title: string;
    meetingDate: string;
    status: string;
  }>;
  approachRuns?: Array<{
    title: string;
    status: string;
    items: Array<{ text: string; done: boolean }>;
  }>;
};

export type CrushAnalysis = {
  relationKind: CrushRelationKind;
  relationLabel: string;
  evidenceLevel: CrushEvidenceLevel;
  initiative: {
    logCount: number;
    lastDaysAgo: number | null;
    recent30: number;
    prev30: number;
    trend: "up" | "flat" | "down" | "none";
  };
  availability: "closed" | "low" | "unknown";
  findings: CrushFinding[];
  nextMoves: string[];
  caveats: string[];
};

const CLOSED_RE =
  /没有实质|没有意思|不感兴趣|只当朋友|当朋友|拒绝|冷淡|不喜欢我|没有感觉|不爱我|没感觉/;
const SELF_CRUSH_RE = /暗恋|单恋|心动|走神|心不在焉/;
const FRIEND_RE = /朋友边界|当普通朋友|同事|同学/;

const KIND_LABEL: Record<CrushRelationKind, string> = {
  insufficient: "证据不足 · 先别下诊断",
  one_sided: "单方面投入",
  friend_boundary: "朋友 / 公事边界",
  cooling: "往来在降温",
  closed: "你已判断：没有实质性意思",
};

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86400000);
}

function countInWindow(
  logs: CrushAnalysisInput["logs"],
  now: Date,
  fromDaysAgo: number,
  toDaysAgo: number
) {
  return logs.filter((log) => {
    const at = asDate(log.contactedAt);
    if (!at) return false;
    const ago = daysBetween(at, now);
    return ago >= toDaysAgo && ago < fromDaysAgo;
  }).length;
}

function noteSnippet(notes: string, re: RegExp): string | null {
  const line = notes
    .split(/\n/)
    .map((l) => l.trim())
    .find((l) => re.test(l));
  return line ? line.slice(0, 120) : null;
}

export function analyzeCrushContact(input: CrushAnalysisInput): CrushAnalysis {
  const now = input.now ?? new Date();
  const notes = input.notes?.trim() || "";
  const last = asDate(input.lastContactAt);
  const lastDaysAgo = last ? daysBetween(last, now) : null;
  const recent30 = countInWindow(input.logs, now, 30, 0);
  const prev30 = countInWindow(input.logs, now, 60, 30);
  const logCount = input.logs.length;
  const meetingCount = input.meetings.length;

  let trend: CrushAnalysis["initiative"]["trend"] = "none";
  if (recent30 === 0 && prev30 === 0) trend = "none";
  else if (recent30 > prev30 + 1) trend = "up";
  else if (recent30 + 1 < prev30) trend = "down";
  else trend = "flat";

  const closedNote = notes && CLOSED_RE.test(notes);
  const selfCrushNote = notes && SELF_CRUSH_RE.test(notes);
  const friendNote = notes && FRIEND_RE.test(notes);
  const approachClosed = (input.approachRuns ?? []).some((run) =>
    run.items.some((item) => item.done && /拒绝|24h|不反复/.test(item.text))
  );

  let relationKind: CrushRelationKind = "insufficient";
  if (closedNote || approachClosed) relationKind = "closed";
  else if (friendNote && !selfCrushNote) relationKind = "friend_boundary";
  else if (logCount >= 3 && lastDaysAgo != null && lastDaysAgo > input.contactFrequencyDays * 2) {
    relationKind = "cooling";
  } else if (logCount >= 2 || selfCrushNote || input.importance >= 5) {
    relationKind = "one_sided";
  }

  let evidenceLevel: CrushEvidenceLevel = "thin";
  const signalCount = [closedNote, selfCrushNote, logCount >= 2, meetingCount > 0, approachClosed].filter(
    Boolean
  ).length;
  if (signalCount >= 3) evidenceLevel = "enough";
  else if (signalCount >= 1) evidenceLevel = "moderate";

  let availability: CrushAnalysis["availability"] = "unknown";
  if (closedNote || approachClosed) availability = "closed";
  else if (input.responseLevel != null && input.responseLevel <= 2) availability = "low";
  else if (relationKind === "one_sided" || relationKind === "cooling") availability = "low";

  const findings: CrushFinding[] = [];

  findings.push({
    title: "主动权（你这边的记录）",
    detail:
      logCount === 0
        ? "还没有往来记录。LifeOS 的 log 默认是你发出的，记了也只能证明你在投入。"
        : `共 ${logCount} 条联系记录；近 30 天 ${recent30} 次，再往前 30 天 ${prev30} 次。趋势：${
            trend === "up" ? "你更常找" : trend === "down" ? "你找得少了" : trend === "flat" ? "你侧节奏平稳" : "几乎没有"
          }。`,
    evidence:
      lastDaysAgo == null
        ? "从未记下联系"
        : `上次联系 ${lastDaysAgo} 天前（周期 ${input.contactFrequencyDays} 天）`,
  });

  if (closedNote) {
    findings.push({
      title: "你已经写下边界",
      detail: "备注里已有「没有实质性意思 / 拒绝 / 冷淡」一类判断。分析到此为止，不要再找反向证据。",
      evidence: noteSnippet(notes, CLOSED_RE),
    });
  } else if (selfCrushNote) {
    findings.push({
      title: "心动写在你这边",
      detail: "档案里的心动/暗恋是你的状态，不是对方的投入。",
      evidence: noteSnippet(notes, SELF_CRUSH_RE),
    });
  }

  if (input.responseLevel != null) {
    findings.push({
      title: "回应积极度",
      detail:
        input.responseLevel <= 2
          ? `你标了 ${input.responseLevel}/5。低回应 + 你持续续温，更像单方面投入。`
          : `你标了 ${input.responseLevel}/5。这是你的印象，不是聊天原文。`,
      evidence: `responseLevel=${input.responseLevel}`,
    });
  }

  if (meetingCount > 0) {
    const latest = [...input.meetings].sort((a, b) => b.meetingDate.localeCompare(a.meetingDate))[0];
    findings.push({
      title: "见面 / 会议",
      detail: `有 ${meetingCount} 条关联会议。见面不等于感情对等。`,
      evidence: latest ? `最近：${latest.meetingDate} · ${latest.title}` : null,
    });
  }

  if (input.importance >= 5 && relationKind !== "closed") {
    findings.push({
      title: "重要度偏高",
      detail: "重要度 5 却没有对等往来证据时，容易把注意力绑在一个人身上。先降预期，再决定要不要降重要度。",
      evidence: `importance=${input.importance}`,
    });
  }

  const nextMoves: string[] = [];
  if (relationKind === "closed" || availability === "closed") {
    nextMoves.push("档案只留边界，少打开这张卡，不重读聊天");
    nextMoves.push("走神时用「冲动来了」记一笔，再回到手头的事");
    nextMoves.push("24 小时内不反复联系；公事需要再发，不夹私货");
  } else if (relationKind === "one_sided" || relationKind === "cooling") {
    nextMoves.push("先写清你已经看见的事实，再决定要不要一次体面收口");
    nextMoves.push("在写清之前，不增加续温频率");
    nextMoves.push("走神记冲动，不让日计划围着 TA 转");
  } else {
    nextMoves.push("证据不够：补一条事实备注（TA 做过 / 说过什么），不要补想象");
    nextMoves.push("工作走神仍走冲动管理，分析页不是用来反复刷新的");
  }

  const caveats = [
    "没有双方聊天原文，不能判断依恋类型，也不能回答「TA 喜不喜欢我」。",
    "联系记录默认是你发出的，主动次数不等于对等互动。",
  ];

  return {
    relationKind,
    relationLabel: KIND_LABEL[relationKind],
    evidenceLevel,
    initiative: {
      logCount,
      lastDaysAgo,
      recent30,
      prev30,
      trend,
    },
    availability,
    findings,
    nextMoves,
    caveats,
  };
}
