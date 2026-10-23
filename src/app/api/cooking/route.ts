import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  RECIPE_SCENES,
  mapRecipe,
  normalizeDifficulty,
  normalizeRotationDay,
} from "@/lib/cooking";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter"); // all | rotation | learn

  const where =
    filter === "rotation"
      ? { inRotation: true }
      : filter === "learn"
        ? { wantToLearn: true }
        : {};

  const recipes = await prisma.recipe.findMany({
    where,
    orderBy: [
      { pinned: "desc" },
      { inRotation: "desc" },
      { rotationDay: "asc" },
      { sortOrder: "asc" },
      { updatedAt: "desc" },
    ],
  });

  return NextResponse.json(recipes.map(mapRecipe));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const title = String(body.title || "").trim();
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const scene = String(body.scene || "weekday");
  if (!RECIPE_SCENES.includes(scene as (typeof RECIPE_SCENES)[number])) {
    return NextResponse.json({ error: "invalid scene" }, { status: 400 });
  }

  const maxSort = await prisma.recipe.aggregate({ _max: { sortOrder: true } });

  const recipe = await prisma.recipe.create({
    data: {
      title,
      scene,
      durationMinutes:
        body.durationMinutes === null || body.durationMinutes === ""
          ? null
          : Number(body.durationMinutes) || null,
      servings:
        body.servings === null || body.servings === ""
          ? null
          : Number(body.servings) || null,
      difficulty: normalizeDifficulty(body.difficulty),
      ingredients: String(body.ingredients || ""),
      steps: String(body.steps || ""),
      review: String(body.review || ""),
      inRotation: Boolean(body.inRotation),
      rotationDay: normalizeRotationDay(body.rotationDay),
      wantToLearn: Boolean(body.wantToLearn),
      pinned: Boolean(body.pinned),
      sortOrder: Number(body.sortOrder) || (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  return NextResponse.json(mapRecipe(recipe), { status: 201 });
}
