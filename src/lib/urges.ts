export type UrgeOutcome = "surfed" | "gave_in" | "redirected";

/** 记录冲动时的触发因素（精简版，旧记录里的历史文案仍保留） */
export const URGE_TRIGGERS = [
  "躺在床上",
  "看到诱因（推送 / 广告 / 内容）",
  "任务太难/不清晰",
  "累或压力",
  "无聊",
  "工作刚有进度想再做一点",
  "其他",
] as const;

export const URGE_OUTCOMES: Array<{ value: UrgeOutcome; label: string }> = [
  { value: "surfed", label: "冲浪成功（忍住了）" },
  { value: "redirected", label: "转移了（做了别的）" },
  { value: "gave_in", label: "满足了冲动" },
];

export const DEFAULT_URGE_CATEGORIES = [
  { name: "刷手机", color: "#6366f1", goal: "减少", isPrivate: false },
  { name: "冲动消费", color: "#f59e0b", goal: "减少", isPrivate: false },
  { name: "拖延", color: "#84cc16", goal: "减少", isPrivate: false },
];

/** 冲动记录变更后派发，供 /urges 页刷新列表 */
export const URGES_UPDATED_EVENT = "lifeos:urges-updated";

export function computeSurfStreak(events: Array<{ outcome: string; occurredAt: Date | string }>): number {
  const sorted = [...events].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );
  let streak = 0;
  for (const e of sorted) {
    if (e.outcome === "surfed" || e.outcome === "redirected") streak += 1;
    else break;
  }
  return streak;
}

export function daysSinceLastEvent(events: Array<{ occurredAt: Date | string }>): number | null {
  if (events.length === 0) return null;
  const latest = events.reduce((max, e) =>
    new Date(e.occurredAt) > new Date(max.occurredAt) ? e : max
  );
  return Math.floor((Date.now() - new Date(latest.occurredAt).getTime()) / 86400000);
}
