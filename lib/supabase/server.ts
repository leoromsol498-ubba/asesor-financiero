import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { allowedEmail } from "@/lib/config";
import { supabasePublicKey, supabaseUrl } from "./env";

/** Cliente de Supabase con la sesión del usuario (respeta RLS). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl(), supabasePublicKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Llamado desde un Server Component: el proxy se encarga de refrescar la sesión.
        }
      },
    },
  });
}

/** Devuelve el cliente y el usuario; si no hay sesión válida, manda a /login. */
export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const permitido = allowedEmail();
  if (!user || (permitido && user.email?.toLowerCase() !== permitido)) {
    redirect("/login");
  }
  return { supabase, user };
}
