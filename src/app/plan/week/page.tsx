import { redirect } from "next/navigation";

/** 本周计划页已并入周复盘 */
export default function WeeklyPlanRedirectPage() {
  redirect("/review");
}
