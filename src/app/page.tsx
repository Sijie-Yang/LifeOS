import { redirect } from "next/navigation";

/** 仪表盘已并入时间线的「日」视图 */
export default function HomePage() {
  redirect("/timeline?scale=day");
}
