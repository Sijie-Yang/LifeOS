import { NextResponse } from "next/server";
import { listAchievements, scheduleAchievementSync } from "@/lib/achievements";

export async function GET() {
  scheduleAchievementSync();
  const achievements = await listAchievements();
  const unlocked = achievements.filter((a) => a.unlockedAt);
  return NextResponse.json({
    achievements,
    unlockedCount: unlocked.length,
    totalCount: achievements.length,
  });
}
