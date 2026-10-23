import { redirect } from "next/navigation";

/** 周视图已去掉，旧链接落到今日视图 */
export default function CalendarWeekPage() {
  redirect("/timeline?scale=day");
}
