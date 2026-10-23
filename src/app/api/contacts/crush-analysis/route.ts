import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CRUSH_TAG, hasCrushTag } from "@/lib/contact-crush";
import { crushAnalysisFromContact } from "@/lib/crush-analysis-from-contact";

export async function GET() {
  const contacts = await prisma.contact.findMany({
    where: { tags: { contains: CRUSH_TAG } },
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
    orderBy: { updatedAt: "desc" },
  });

  const items = contacts.filter((c) => hasCrushTag(c.tags)).map((contact) => ({
    contactId: contact.id,
    name: contact.name,
    crush: true,
    analysis: crushAnalysisFromContact(contact),
  }));

  return NextResponse.json({ items });
}
