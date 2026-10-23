/** 日历周视图优先级 — 示例默认值，服从 LifeOS 铁律（可按自己的情况改写） */

import { IRON_LAWS_ONE_LINER } from "./lifeos-iron-laws";

export const TIME_PRIORITY_SUMMARY = IRON_LAWS_ONE_LINER;

export const TIME_PRIORITY_PILLARS = [
  "身体优先：先保证睡眠与每天的运动时间",
  "深度工作：每天留一块不被打断的主线时间",
  "生活秩序：房间与日程保持基本整洁，减少摩擦",
  "主线有进度 → 才合法休息；休息压过杂务",
] as const;

export const TIME_PRIORITY_ORDER = [
  { rank: 0, label: "运动与作息" },
  { rank: 1, label: "深度工作" },
  { rank: 2, label: "整理与家务" },
  { rank: 3, label: "休息" },
  { rank: 4, label: "阅读学习" },
  { rank: 5, label: "副业 / 其它" },
] as const;
