import { redirect } from "next/navigation";

/** 月历和周视图都已并入统一时间线；旧的 tab=week 落到今日视图 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tab = typeof params.tab === "string" ? params.tab : undefined;
  redirect(tab === "week" ? "/timeline?scale=day" : "/timeline");
}
