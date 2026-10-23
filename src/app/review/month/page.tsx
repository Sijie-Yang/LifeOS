"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { PeriodReviewPanel } from "@/components/review/PeriodReviewPanel";

export default function MonthReviewPage() {
  return (
    <>
      <PageHeader title="月复盘" description="回顾本月执行，规划下月重点" />
      <PeriodReviewPanel periodType="month" />
    </>
  );
}
