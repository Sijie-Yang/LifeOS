"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { ReviewTrendsPanel } from "@/components/review/ReviewTrendsPanel";

export default function ReviewTrendsPage() {
  return (
    <>
      <PageHeader
        title="数据趋势"
        description="查看周 / 月 / 季 / 年的历史数据变化，与复盘记录分开浏览"
      />
      <ReviewTrendsPanel />
    </>
  );
}
