import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasCrushTag } from "@/lib/contact-crush";
import { crushAnalysisFromContact } from "@/lib/crush-analysis-from-contact";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      logs: { orderBy: { contactedAt: "desc" } },
      meetingAttendees: {
        include: {
          meeting: { select: { title: true, meetingDate: true, status: true } },
        },
      },
      checklistRuns: {
        include: { template: { select: { category: true } } },
        orderBy: { createdAt: "desc" },
        take: 8,
      },
    },
  });
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!hasCrushTag(contact.tags)) {
    return NextResponse.json({ error: "未标记心动", crush: false }, { status: 409 });
  }

  return NextResponse.json({
    contactId: contact.id,
    name: contact.name,
    crush: true,
    analysis: crushAnalysisFromContact(contact),
  });
}
