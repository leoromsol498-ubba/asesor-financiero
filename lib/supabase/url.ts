/**
 * Limpia la dirección de Supabase por si se copió con algo extra:
 * espacios, comillas, "/" al final o rutas como "/rest/v1/" o "/auth/v1".
 * "https://abc.supabase.co/rest/v1/" → "https://abc.supabase.co"
 * Se usa en el servidor, en el navegador y en el proxy.
 */
export function limpiarUrlSupabase(valor: string | undefined): string | undefined {
  if (!valor) return valor;
  let v = valor.trim().replace(/^["']|["']$/g, "");
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  try {
    const u = new URL(v);
    // Para proyectos de supabase.co la ruta siempre debe ir vacía.
    // En instalaciones propias se quitan solo las rutas de API conocidas.
    let path = u.pathname.replace(/\/+$/, "");
    if (/\.supabase\.(co|in)$/i.test(u.hostname)) path = "";
    else path = path.replace(/\/(rest|auth|storage|realtime|functions)\/v1.*$/i, "");
    return `${u.protocol}//${u.host}${path}`;
  } catch {
    return v.replace(/\/+$/, "");
  }
}
