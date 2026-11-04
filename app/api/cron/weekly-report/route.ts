import type { NextRequest } from "next/server";
import { ejecutarCron } from "@/lib/cron";
import { reporteSemanal } from "@/lib/jobs";

// Vercel lo llama los domingos a las 3:00 pm (hora de Ciudad de México). Ver vercel.json.
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export function GET(request: NextRequest) {
  return ejecutarCron(request, (db, userId, hoy) => reporteSemanal(db, userId, hoy));
}
