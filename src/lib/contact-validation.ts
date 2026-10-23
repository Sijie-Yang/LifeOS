/** Validate editable scalar fields before passing them to Prisma. */
export function contactInputError(body: unknown, partial = false): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "无效的联系人资料";
  const data = body as Record<string, unknown>;
  if ((!partial || data.name !== undefined) && (typeof data.name !== "string" || !data.name.trim() || data.name.trim().length > 120)) return "姓名需为 1–120 个字符";
  for (const key of ["importance", "responseLevel"] as const) {
    const value = data[key];
    if (key === "responseLevel" && value === null) continue;
    if (value !== undefined && (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5)) return "重要程度和回应积极度需为 1–5 的整数";
  }
  const frequency = data.contactFrequencyDays;
  if (frequency !== undefined && (typeof frequency !== "number" || !Number.isInteger(frequency) || frequency < 1 || frequency > 3650)) return "联系周期需为 1–3650 天";
  for (const key of ["birthday", "lastContactAt"] as const) {
    const value = data[key];
    if (value !== undefined && value !== null && value !== "" && (typeof value !== "string" || !Number.isFinite(new Date(value).getTime()))) return "请填写有效日期";
  }
  if (data.categoryId !== undefined && data.categoryId !== null && typeof data.categoryId !== "string") return "请选择有效圈子";
  return null;
}
