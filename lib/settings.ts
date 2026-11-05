import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ¿La IA está encendida? Por defecto sí. Si la tabla aún no existe
 * (migración no ejecutada) también se considera encendida.
 * `userId` solo se pasa desde los crons (cliente administrador).
 */
export async function usarIA(db: SupabaseClient, userId?: string): Promise<boolean> {
  let q = db.from("user_settings").select("usar_ia");
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q.maybeSingle();
  if (error || !data) return true;
  return data.usar_ia;
}

export const MENSAJE_IA_APAGADA = "La IA está apagada. Puedes encenderla en Más → Ajustes.";
