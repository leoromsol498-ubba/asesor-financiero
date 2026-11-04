import "server-only";
import { createClient } from "@supabase/supabase-js";
import { allowedEmail } from "@/lib/config";
import { supabaseSecretKey, supabaseUrl } from "./env";

/**
 * Cliente con la llave secreta: se salta RLS. Solo se usa en los crons,
 * que no tienen sesión de navegador, y SIEMPRE filtrando por user_id.
 */
export function createAdminClient() {
  return createClient(supabaseUrl(), supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Busca al dueño de la app (ALLOWED_EMAIL) entre los usuarios de Supabase. */
export async function findOwner(admin: ReturnType<typeof createAdminClient>) {
  const email = allowedEmail();
  if (!email) throw new Error("Falta ALLOWED_EMAIL");
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === email);
    if (u) return u;
    if (data.users.length < 100) break;
  }
  return null;
}
