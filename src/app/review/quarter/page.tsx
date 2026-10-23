"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { PeriodReviewPanel } from "@/components/review/PeriodReviewPanel";

export default function QuarterReviewPage() {
  return (
    <>
      <PageHeader title="季复盘" description="回顾本季度执行，规划下季重点" />
      <PeriodReviewPanel periodType="quarter" />
    </>
  );
}
