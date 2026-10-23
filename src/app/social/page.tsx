"use client";

import { OpportunitiesBoard } from "@/components/opportunities/OpportunitiesBoard";
import { OPPORTUNITY_BOARD_PRESETS } from "@/components/opportunities/board-presets";
import { Card, CardContent } from "@/components/ui/Card";

function LifeNetworkingHint() {
  return (
    <Card className="mb-4 border-emerald-100 bg-emerald-50/40">
      <CardContent className="py-3 text-sm text-zinc-700 leading-relaxed">
        <p className="font-medium text-emerald-900 mb-1">业余 Networking</p>
        <ol className="text-sm text-emerald-950 space-y-0.5 list-decimal pl-4 font-medium">
          <li>为场域与能量，不为 KPI</li>
          <li>人先 · 局后</li>
          <li>约了就去 · 去了就续</li>
        </ol>
      </CardContent>
    </Card>
  );
}

export default function SocialNetworkingPage() {
  return (
    <OpportunitiesBoard lane="life" {...OPPORTUNITY_BOARD_PRESETS.life} sop={<LifeNetworkingHint />} />
  );
}
