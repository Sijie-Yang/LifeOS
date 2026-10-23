import { redirect } from "next/navigation";

/** 周时间表已并入周日历 */
export default function SchedulePage() {
  redirect("/calendar/week");
}
