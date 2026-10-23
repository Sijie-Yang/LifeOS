import { prisma } from "@/lib/prisma";

export const PROJECT_CATEGORY_COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
];

export function pickCategoryColor(index: number) {
  return PROJECT_CATEGORY_COLORS[index % PROJECT_CATEGORY_COLORS.length];
}

export async function getOrCreateProjectCategory(name: string | null | undefined) {
  const trimmed = name?.trim();
  if (!trimmed) return null;

  const existing = await prisma.projectCategory.findUnique({ where: { name: trimmed } });
  if (existing) return existing;

  const count = await prisma.projectCategory.count();
  return prisma.projectCategory.create({
    data: { name: trimmed, color: pickCategoryColor(count) },
  });
}
