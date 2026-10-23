import { format, parseISO, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { parseRoomZones, type RoomZones } from "@/lib/room-plan";

/** 某天的房间分数：当天没打分就沿用 60 天内最近一次打分 */
export async function roomZonesFor(date: string): Promise<RoomZones> {
  const today = await prisma.dailyLog.findUnique({ where: { date }, select: { roomZones: true } });
  const zones = parseRoomZones(today?.roomZones);
  if (Object.keys(zones).length) return zones;
  const prev = await prisma.dailyLog.findFirst({
    where: { date: { lt: date, gte: format(subDays(parseISO(`${date}T12:00:00`), 60), "yyyy-MM-dd") }, NOT: { roomZones: "{}" } },
    orderBy: { date: "desc" },
    select: { roomZones: true },
  });
  return parseRoomZones(prev?.roomZones);
}
