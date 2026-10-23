import { parseChecklistRunItems } from "@/lib/checklists";
import { analyzeCrushContact, type CrushAnalysis } from "@/lib/crush-analysis";

type ContactForCrush = {
  name: string;
  notes: string | null;
  importance: number;
  responseLevel: number | null;
  lastContactAt: Date | string | null;
  contactFrequencyDays: number;
  logs: Array<{ type: string; content: string | null; contactedAt: Date | string }>;
  meetingAttendees?: Array<{
    meeting: { title: string; meetingDate: string; status: string };
  }>;
  checklistRuns?: Array<{
    title: string;
    status: string;
    items: string;
    template?: { category: string };
  }>;
};

export function crushAnalysisFromContact(contact: ContactForCrush): CrushAnalysis {
  const approachRuns = (contact.checklistRuns ?? [])
    .filter((run) => !run.template || run.template.category === "approach")
    .map((run) => ({
      title: run.title,
      status: run.status,
      items: parseChecklistRunItems(run.items).map((item) => ({
        text: item.text,
        done: item.done,
      })),
    }));

  return analyzeCrushContact({
    name: contact.name,
    notes: contact.notes,
    importance: contact.importance,
    responseLevel: contact.responseLevel,
    lastContactAt: contact.lastContactAt,
    contactFrequencyDays: contact.contactFrequencyDays,
    logs: contact.logs,
    meetings: (contact.meetingAttendees ?? []).map((row) => row.meeting),
    approachRuns,
  });
}
