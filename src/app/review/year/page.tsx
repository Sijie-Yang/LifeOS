"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { PeriodReviewPanel } from "@/components/review/PeriodReviewPanel";

export default function YearReviewPage() {
  return (
    <>
      <PageHeader title="年复盘" description="回顾本年度执行，规划明年重点" />
      <PeriodReviewPanel periodType="year" />
    </>
  );
}
