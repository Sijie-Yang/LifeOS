import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  RECIPE_SCENES,
  mapRecipe,
  normalizeDifficulty,
  normalizeRotationDay,
} from "@/lib/cooking";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const recipe = await prisma.recipe.findUnique({ where: { id } });
  if (!recipe) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(mapRecipe(recipe));
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await request.json();
  const existing = await prisma.recipe.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.scene !== undefined) {
    const scene = String(body.scene);
    if (!RECIPE_SCENES.includes(scene as (typeof RECIPE_SCENES)[number])) {
      return NextResponse.json({ error: "invalid scene" }, { status: 400 });
    }
  }

  const recipe = await prisma.recipe.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: String(body.title).trim() }),
      ...(body.scene !== undefined && { scene: String(body.scene) }),
      ...(body.durationMinutes !== undefined && {
        durationMinutes:
          body.durationMinutes === null || body.durationMinutes === ""
            ? null
            : Number(body.durationMinutes) || null,
      }),
      ...(body.servings !== undefined && {
        servings:
          body.servings === null || body.servings === ""
            ? null
            : Number(body.servings) || null,
      }),
      ...(body.difficulty !== undefined && {
        difficulty: normalizeDifficulty(body.difficulty),
      }),
      ...(body.ingredients !== undefined && { ingredients: String(body.ingredients) }),
      ...(body.steps !== undefined && { steps: String(body.steps) }),
      ...(body.review !== undefined && { review: String(body.review) }),
      ...(body.inRotation !== undefined && { inRotation: Boolean(body.inRotation) }),
      ...(body.rotationDay !== undefined && {
        rotationDay: normalizeRotationDay(body.rotationDay),
      }),
      ...(body.wantToLearn !== undefined && { wantToLearn: Boolean(body.wantToLearn) }),
      ...(body.pinned !== undefined && { pinned: Boolean(body.pinned) }),
      ...(body.sortOrder !== undefined && { sortOrder: Number(body.sortOrder) || 0 }),
    },
  });

  return NextResponse.json(mapRecipe(recipe));
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  await prisma.recipe.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
