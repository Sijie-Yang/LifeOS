import { NextResponse } from "next/server";
import { differenceInCalendarDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { PARTNER_CATEGORY, parsePartnerProfile, partnerMust, partnerTotal } from "@/lib/partner-score";

/**
 * 约会看板：「约会对象」圈子里的人（或已经打过分的人），按阶段和契合度总分排序。
 * GET → { categoryId, items: [{ id, name, stage, scores, total, must, lastContactAt, daysSince, overdue, logs14 }] }
 */
export async function GET() {
  const category =
    (await prisma.contactCategory.findFirst({ where: { name: PARTNER_CATEGORY } })) ??
    (await prisma.contactCategory.create({ data: { name: PARTNER_CATEGORY, color: "#e11d48" } }));
  const since = new Date(Date.now() - 14 * 86400000);
  const contacts = await prisma.contact.findMany({
    where: { OR: [{ categoryId: category.id }, { partnerProfile: { not: null } }] },
    select: {
      id: true,
      name: true,
      city: true,
      institution: true,
      lastContactAt: true,
      contactFrequencyDays: true,
      partnerProfile: true,
      _count: { select: { logs: { where: { contactedAt: { gte: since } } } } },
    },
  });
  const now = new Date();
  const order = ["exclusive", "dating", "first_date", "chatting", "met", "closed"];
  const items = contacts
    .map((c) => {
      const profile = parsePartnerProfile(c.partnerProfile);
      const scores = profile?.scores ?? {};
      const daysSince = c.lastContactAt ? differenceInCalendarDays(now, c.lastContactAt) : null;
      return {
        id: c.id,
        name: c.name,
        city: c.city,
        institution: c.institution,
        stage: profile?.stage ?? "met",
        source: profile?.source ?? null,
        scores,
        total: partnerTotal(scores),
        must: partnerMust(scores),
        history: profile?.history ?? [],
        lastContactAt: c.lastContactAt?.toISOString() ?? null,
        daysSince,
        frequencyDays: c.contactFrequencyDays,
        /** 线上联系过期：超过联系周期没联系（不再推进的不算） */
        overdue: (profile?.stage ?? "met") !== "closed" && (daysSince == null || daysSince > c.contactFrequencyDays),
        logs14: c._count.logs,
      };
    })
    .sort((a, b) => order.indexOf(a.stage) - order.indexOf(b.stage) || (b.total ?? -1) - (a.total ?? -1));
  return NextResponse.json({ categoryId: category.id, items });
}
