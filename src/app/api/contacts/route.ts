import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { contactInputError } from "@/lib/contact-validation";
import { stringifyTags, parseTags } from "@/lib/tags";
import { applyCrushToTagJson } from "@/lib/contact-crush";
import {
  coerceCityField,
  coerceInstitutionField,
  enrichContactPlaces,
} from "@/lib/contact-places";

function normalizeTagsBody(tags: unknown): string {
  if (typeof tags === "string") {
    const parsed = parseTags(tags);
    if (parsed.length) return stringifyTags(parsed);
    // comma input that isn't JSON
    try {
      JSON.parse(tags);
      return tags;
    } catch {
      return stringifyTags(
        tags
          .split(/[,，]/)
          .map((t) => t.trim())
          .filter(Boolean)
      );
    }
  }
  if (Array.isArray(tags)) return stringifyTags(tags.map(String));
  return stringifyTags([]);
}

export async function GET() {
  const categories = await prisma.contactCategory.findMany({ orderBy: { name: "asc" } });
  const contacts = await prisma.contact.findMany({
    include: { category: true, logs: { orderBy: { contactedAt: "desc" }, take: 3 } },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({
    categories,
    contacts: contacts.map(enrichContactPlaces),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const error = contactInputError(body, false);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (body.categoryId && !await prisma.contactCategory.findUnique({ where: { id: body.categoryId } })) {
    return NextResponse.json({ error: "圈子不存在，请重新选择" }, { status: 400 });
  }
  const institution = coerceInstitutionField(
    body.institution ?? body.institutions,
    body.company
  );
  const city = coerceCityField(body.city ?? body.cities);

  const contact = await prisma.contact.create({
    data: {
      name: body.name.trim(),
      email: body.email || null,
      phone: body.phone || null,
      company: null,
      position: body.position || null,
      categoryId: body.categoryId || null,
      lastContactAt: body.lastContactAt ? new Date(body.lastContactAt) : null,
      contactFrequencyDays: body.contactFrequencyDays ?? 30,
      birthday: body.birthday ? new Date(body.birthday) : null,
      notes: body.notes || null,
      tags: applyCrushToTagJson("[]", parseTags(normalizeTagsBody(body.tags)), body.crush),
      importance: body.importance ?? 3,
      institution,
      city,
      responseLevel: body.responseLevel ?? null,
    },
    include: { category: true },
  });
  return NextResponse.json(enrichContactPlaces(contact), { status: 201 });
}
