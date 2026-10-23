export const RECIPE_SCENES = [
  "weekday",
  "weekend",
  "mealprep",
  "guest",
  "other",
] as const;

export type RecipeScene = (typeof RECIPE_SCENES)[number];

export const RECIPE_SCENE_LABELS: Record<RecipeScene, string> = {
  weekday: "工作日快手",
  weekend: "周末",
  mealprep: "带饭",
  guest: "待客",
  other: "其他",
};

export const RECIPE_SCENE_COLORS: Record<RecipeScene, string> = {
  weekday: "bg-sky-100 text-sky-800",
  weekend: "bg-violet-100 text-violet-800",
  mealprep: "bg-amber-100 text-amber-900",
  guest: "bg-rose-100 text-rose-800",
  other: "bg-zinc-100 text-zinc-600",
};

export const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"] as const;

export type RecipeDto = {
  id: string;
  title: string;
  scene: string;
  durationMinutes: number | null;
  servings: number | null;
  difficulty: number;
  ingredients: string;
  steps: string;
  review: string;
  inRotation: boolean;
  rotationDay: number | null;
  wantToLearn: boolean;
  pinned: boolean;
  sortOrder: number;
  updatedAt: string;
};

export function mapRecipe(row: {
  id: string;
  title: string;
  scene: string;
  durationMinutes: number | null;
  servings: number | null;
  difficulty: number;
  ingredients: string;
  steps: string;
  review: string;
  inRotation: boolean;
  rotationDay: number | null;
  wantToLearn: boolean;
  pinned: boolean;
  sortOrder: number;
  updatedAt: Date;
}): RecipeDto {
  return {
    id: row.id,
    title: row.title,
    scene: row.scene,
    durationMinutes: row.durationMinutes,
    servings: row.servings,
    difficulty: row.difficulty,
    ingredients: row.ingredients,
    steps: row.steps,
    review: row.review,
    inRotation: row.inRotation,
    rotationDay: row.rotationDay,
    wantToLearn: row.wantToLearn,
    pinned: row.pinned,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function normalizeDifficulty(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 1;
  return Math.min(3, Math.max(1, Math.round(v)));
}

export function normalizeRotationDay(n: unknown): number | null {
  if (n === null || n === undefined || n === "") return null;
  const v = Number(n);
  if (!Number.isFinite(v) || v < 1 || v > 7) return null;
  return Math.round(v);
}
