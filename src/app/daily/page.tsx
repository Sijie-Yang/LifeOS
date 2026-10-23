import { redirect } from "next/navigation";

/** 日计划已并入统一时间线的「日」视图。 */
export default async function DailyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const date = typeof params.date === "string" ? params.date : undefined;
  redirect(date ? `/timeline?scale=day&date=${encodeURIComponent(date)}` : "/timeline?scale=day");
}
