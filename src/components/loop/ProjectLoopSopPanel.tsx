"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  PROJECT_LOOP_SOP_SECTIONS,
  PROJECT_LOOP_SOP_SUMMARY,
} from "@/lib/project-loop";
import { RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProjectLoopSopPanel() {
  const [expanded, setExpanded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Card className="mb-6 border-amber-200 bg-amber-50/40">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <RefreshCw className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <p className="text-sm font-medium text-amber-950">项目闭环 SOP</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-amber-800"
                  onClick={() => setExpanded((v) => !v)}
                >
                  {expanded ? (
                    <>
                      收起 <ChevronUp className="h-3.5 w-3.5 ml-0.5" />
                    </>
                  ) : (
                    <>
                      展开要点 <ChevronDown className="h-3.5 w-3.5 ml-0.5" />
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-amber-800"
                  onClick={() => setModalOpen(true)}
                >
                  完整说明
                </Button>
              </div>
              <p className="text-sm text-amber-950/90 leading-relaxed">
                {PROJECT_LOOP_SOP_SUMMARY}
              </p>
              <div
                className={cn(
                  "grid transition-all",
                  expanded ? "mt-3 space-y-3 opacity-100" : "h-0 overflow-hidden opacity-0"
                )}
              >
                {PROJECT_LOOP_SOP_SECTIONS.map((section) => (
                  <div key={section.title}>
                    <p className="text-xs font-semibold text-amber-900 mb-1">{section.title}</p>
                    <ul className="text-xs text-amber-950/80 space-y-1 list-disc pl-4">
                      {section.lines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="项目闭环理论与 SOP" wide>
        <p className="text-sm text-zinc-700 leading-relaxed mb-4">{PROJECT_LOOP_SOP_SUMMARY}</p>
        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
          {PROJECT_LOOP_SOP_SECTIONS.map((section) => (
            <section key={section.title}>
              <h3 className="text-sm font-semibold text-zinc-900 mb-2">{section.title}</h3>
              <ul className="text-sm text-zinc-600 space-y-2 list-disc pl-5">
                {section.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="flex justify-end mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            关闭
          </Button>
        </div>
      </Modal>
    </>
  );
}
