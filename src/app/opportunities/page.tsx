"use client";

import { OpportunitiesBoard } from "@/components/opportunities/OpportunitiesBoard";
import { OPPORTUNITY_BOARD_PRESETS } from "@/components/opportunities/board-presets";
import { OpportunitySopPanel } from "@/components/contacts/ContactSopPanel";

export default function OpportunitiesPage() {
  return <OpportunitiesBoard lane="career" {...OPPORTUNITY_BOARD_PRESETS.career} sop={<OpportunitySopPanel />} />;
}
