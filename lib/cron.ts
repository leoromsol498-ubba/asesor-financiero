import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, findOwner } from "./supabase/admin";
import { todayISO } from "./dates";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Valida CRON_SECRET y ejecuta el trabajo para el dueño de la app. */
export async function ejecutarCron(
  request: NextRequest,
  trabajo: (db: SupabaseClient, userId: string, hoy: string) => Promise<unknown>,
) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const db = createAdminClient();
    const owner = await findOwner(db);
    if (!owner) return NextResponse.json({ error: "Aún no existe el usuario de ALLOWED_EMAIL. Inicia sesión una vez en la app." }, { status: 404 });
    const resultado = await trabajo(db, owner.id, todayISO());
    return NextResponse.json({ ok: true, resultado });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
