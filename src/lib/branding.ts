/**
 * 内容 / 个人品牌项目的名称（仪表盘「待发内容」、复盘与成就统计按它找项目）。
 * 服务端可用 LIFEOS_BRANDING_PROJECT 改成你自己的项目名。
 */
export const PERSONAL_BRANDING_NAME = process.env.LIFEOS_BRANDING_PROJECT?.trim() || "Personal Branding";

export const brandingProjectFilter = {
  name: PERSONAL_BRANDING_NAME,
} as const;
