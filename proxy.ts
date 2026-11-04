import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Se ejecuta antes de cada página: refresca la sesión y protege las rutas.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Sin configuración todavía: mostramos la pantalla de ayuda en /login
    if (request.nextUrl.pathname !== "/login") return NextResponse.redirect(new URL("/login", request.url));
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const path = request.nextUrl.pathname;
  const esPublica = path.startsWith("/login") || path.startsWith("/auth");

  const permitido = (process.env.ALLOWED_EMAIL || "").trim().toLowerCase();
  const autorizado = !!user && (!permitido || user.email?.toLowerCase() === permitido);

  if (!autorizado && !esPublica) {
    const dest = new URL("/login", request.url);
    if (user) dest.searchParams.set("error", "no-autorizado");
    return NextResponse.redirect(dest);
  }
  if (autorizado && path === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}

export const config = {
  // Excluye archivos estáticos y las rutas de cron (que usan CRON_SECRET)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|manifest|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
