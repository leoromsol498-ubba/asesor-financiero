// Acepta tanto los nombres nuevos de llaves de Supabase (publishable/secret)
// como los anteriores (anon/service_role).

export function supabaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!v) throw new Error("Falta la variable de entorno NEXT_PUBLIC_SUPABASE_URL");
  return v;
}

export function supabasePublicKey(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!v) throw new Error("Falta la variable NEXT_PUBLIC_SUPABASE_ANON_KEY (o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)");
  return v;
}

export function supabaseSecretKey(): string {
  const v = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!v) throw new Error("Falta la variable SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEY)");
  return v;
}
