/**
 * Contact cadence buckets — how often you should touch base.
 * Values map to Contact.contactFrequencyDays.
 */

export type FrequencyBucket = {
  id: string;
  /** Canonical days stored on contact */
  days: number;
  label: string;
  short: string;
  hint: string;
  /** Badge styles */
  className: string;
  /** Accept nearby day values into this bucket for display/filter */
  match: (days: number) => boolean;
};

export const FREQUENCY_BUCKETS: FrequencyBucket[] = [
  {
    id: "weekly",
    days: 7,
    label: "每周",
    short: "周",
    hint: "家人 / 同住圈 · 生活续温",
    className: "bg-rose-100 text-rose-800",
    match: (d) => d > 0 && d <= 7,
  },
  {
    id: "biweekly",
    days: 14,
    label: "双周",
    short: "双周",
    hint: "核心密友 / 同门热圈 · 主动续温",
    className: "bg-amber-100 text-amber-900",
    match: (d) => d > 7 && d <= 14,
  },
  {
    id: "triweekly",
    days: 21,
    label: "三周",
    short: "三周",
    hint: "PI / 关键合作 / 高杠杆推进中",
    className: "bg-orange-100 text-orange-900",
    match: (d) => d > 14 && d <= 21,
  },
  {
    id: "monthly",
    days: 30,
    label: "每月",
    short: "月",
    hint: "活跃同行 · 默认维护档",
    className: "bg-indigo-100 text-indigo-800",
    match: (d) => d > 21 && d <= 35,
  },
  {
    id: "bimonthly",
    days: 60,
    label: "两月",
    short: "两月",
    hint: "暖网 / 访客 / 媒体 · 有事再加频",
    className: "bg-sky-100 text-sky-800",
    match: (d) => d > 35 && d <= 60,
  },
  {
    id: "quarterly",
    days: 90,
    label: "每季",
    short: "季",
    hint: "远距教授 / 备选岗位 · 低频可见",
    className: "bg-emerald-100 text-emerald-800",
    match: (d) => d > 60 && d <= 120,
  },
  {
    id: "yearly",
    days: 365,
    label: "每年",
    short: "年",
    hint: "弱关系 / 名人 · 几乎不维护",
    className: "bg-zinc-100 text-zinc-600",
    match: (d) => d > 120,
  },
];

export const FREQUENCY_PRESETS = FREQUENCY_BUCKETS.map((b) => ({
  value: b.days,
  label: `${b.label}（${b.days} 天）`,
}));

export function getFrequencyBucket(days: number): FrequencyBucket {
  return FREQUENCY_BUCKETS.find((b) => b.match(days)) ?? FREQUENCY_BUCKETS[3]!;
}

export function formatFrequencyLabel(days: number): string {
  const b = getFrequencyBucket(days);
  return b.days === days ? b.label : `${b.label}·${days}天`;
}
