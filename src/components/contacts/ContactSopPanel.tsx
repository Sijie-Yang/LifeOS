"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  CONTACT_SOP_PILLARS,
  CONTACT_SOP_SECTIONS,
  CONTACT_SOP_SUMMARY,
  OPPORTUNITY_SOP_PILLARS,
  OPPORTUNITY_SOP_SECTIONS,
  OPPORTUNITY_SOP_SUMMARY,
} from "@/lib/contact-sop";
import { BookOpen } from "lucide-react";

type SopSection = { title: string; lines: readonly string[] };

function SopBanner({
  title,
  modalTitle,
  summary,
  pillars,
  sections,
}: {
  title: string;
  modalTitle: string;
  summary: string;
  pillars: readonly string[];
  sections: readonly SopSection[];
}) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Card className="mb-6 border-indigo-200 bg-indigo-50/40">
        <CardContent className="py-3">
          <div className="flex items-start gap-3">
            <BookOpen className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <p className="text-sm font-medium text-indigo-950">{title}</p>
                <span className="text-xs text-indigo-700/80">{summary}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-indigo-700 ml-auto"
                  onClick={() => setModalOpen(true)}
                >
                  细节
                </Button>
              </div>
              <ol className="text-sm text-indigo-950 space-y-0.5 list-decimal pl-4 font-medium tracking-tight">
                {pillars.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={modalTitle} wide>
        <ol className="text-sm text-zinc-800 space-y-1 list-decimal pl-5 mb-4 font-medium">
          {pillars.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
          {sections.map((section) => (
            <section key={section.title}>
              <h3 className="text-xs font-semibold text-zinc-500 mb-1.5 uppercase tracking-wide">
                {section.title}
              </h3>
              <ul className="text-sm text-zinc-600 space-y-1 list-disc pl-5">
                {section.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="flex justify-end mt-5">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            关闭
          </Button>
        </div>
      </Modal>
    </>
  );
}

export function ContactSopPanel() {
  return (
    <SopBanner
      title="关系"
      modalTitle="关系原则"
      summary={CONTACT_SOP_SUMMARY}
      pillars={CONTACT_SOP_PILLARS}
      sections={CONTACT_SOP_SECTIONS}
    />
  );
}

export function OpportunitySopPanel() {
  return (
    <SopBanner
      title="机会"
      modalTitle="机会原则"
      summary={OPPORTUNITY_SOP_SUMMARY}
      pillars={OPPORTUNITY_SOP_PILLARS}
      sections={OPPORTUNITY_SOP_SECTIONS}
    />
  );
}
