import { NextRequest, NextResponse } from "next/server";
import { toDateString } from "@/lib/utils";
import { nextPartnerProfile, parsePartnerProfile, type PartnerProfile } from "@/lib/partner-score";
import { prisma } from "@/lib/prisma";
import { contactInputError } from "@/lib/contact-validation";
import { parseTags, stringifyTags } from "@/lib/tags";
import { applyCrushToTagJson } from "@/lib/contact-crush";
import {
  coerceCityField,
  coerceInstitutionField,
  enrichContactPlaces,
} from "@/lib/contact-places";

type Params = { params: Promise<{ id: string }> };

function normalizeTagsBody(tags: unknown): string {
  if (typeof tags === "string") {
    const parsed = parseTags(tags);
    if (parsed.length) return stringifyTags(parsed);
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

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      category: true,
      logs: { orderBy: { contactedAt: "desc" } },
      projects: { include: { project: { select: { id: true, name: true, status: true } } } },
      opportunities: {
        include: {
          opportunity: {
            select: { id: true, title: true, status: true, deadline: true, nextAction: true },
          },
        },
      },
      goals: {
        include: {
          goal: { select: { id: true, title: true, status: true, area: true } },
        },
      },
      meetingAttendees: {
        include: {
          meeting: {
            select: { id: true, title: true, meetingDate: true, status: true },
          },
        },
        take: 20,
      },
    },
  });
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(enrichContactPlaces(contact));
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const error = contactInputError(body, true);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (body.categoryId && !await prisma.contactCategory.findUnique({ where: { id: body.categoryId } })) {
    return NextResponse.json({ error: "圈子不存在，请重新选择" }, { status: 400 });
  }

  const placesPatch: {
    institution?: string | null;
    city?: string | null;
    company?: string | null;
  } = {};

  if (
    body.institution !== undefined ||
    body.institutions !== undefined ||
    body.company !== undefined
  ) {
    placesPatch.institution = coerceInstitutionField(
      body.institution ?? body.institutions,
      body.company
    );
    placesPatch.company = null;
  }
  if (body.city !== undefined || body.cities !== undefined) {
    placesPatch.city = coerceCityField(body.city ?? body.cities);
  }

  // 关系契合度：只传要改的部分（stage / scores / source），和已有的合并
  let partnerProfile: string | undefined;
  if (body.partnerProfile !== undefined) {
    const current = await prisma.contact.findUnique({ where: { id }, select: { partnerProfile: true } });
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const prev = parsePartnerProfile(current.partnerProfile);
    const patch = (body.partnerProfile ?? {}) as Partial<PartnerProfile>;
    partnerProfile = JSON.stringify(
      nextPartnerProfile(prev, { ...patch, scores: { ...(prev?.scores ?? {}), ...(patch.scores ?? {}) } }, toDateString())
    );
  }

  const existing =
    body.crush !== undefined || body.tags !== undefined
      ? await prisma.contact.findUnique({ where: { id }, select: { tags: true } })
      : null;
  if ((body.crush !== undefined || body.tags !== undefined) && !existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const nextTags =
    body.crush !== undefined || body.tags !== undefined
      ? applyCrushToTagJson(
          existing!.tags,
          body.tags !== undefined ? parseTags(normalizeTagsBody(body.tags)) : undefined,
          body.crush
        )
      : undefined;

  const contact = await prisma.contact.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.email !== undefined && { email: body.email || null }),
      ...(body.phone !== undefined && { phone: body.phone || null }),
      ...(body.position !== undefined && { position: body.position || null }),
      ...(body.categoryId !== undefined && { categoryId: body.categoryId || null }),
      ...(body.lastContactAt !== undefined && {
        lastContactAt: body.lastContactAt ? new Date(body.lastContactAt) : null,
      }),
      ...(body.contactFrequencyDays !== undefined && {
        contactFrequencyDays: body.contactFrequencyDays,
      }),
      ...(body.birthday !== undefined && {
        birthday: body.birthday ? new Date(body.birthday) : null,
      }),
      ...(body.notes !== undefined && { notes: body.notes || null }),
      ...(nextTags !== undefined && { tags: nextTags }),
      ...(body.importance !== undefined && { importance: body.importance }),
      ...(body.responseLevel !== undefined && { responseLevel: body.responseLevel ?? null }),
      ...(partnerProfile !== undefined && { partnerProfile }),
      ...placesPatch,
    },
    include: { category: true },
  });
  return NextResponse.json(enrichContactPlaces(contact));
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.contact.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
