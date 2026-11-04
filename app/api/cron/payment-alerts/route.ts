import type { NextRequest } from "next/server";
import { ejecutarCron } from "@/lib/cron";
import { revisarPagos } from "@/lib/jobs";

// Vercel lo llama todos los días a las 8:00 am (hora de Ciudad de México). Ver vercel.json.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export function GET(request: NextRequest) {
  return ejecutarCron(request, (db, userId, hoy) => revisarPagos(db, userId, hoy));
}
