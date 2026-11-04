import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const configurado =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-8 px-6 py-12">
      <div className="flex flex-col gap-2">
        <div className="h-10 w-10 rounded-xl bg-neutral-950" />
        <h1 className="text-2xl font-semibold">Asesor Financiero</h1>
        <p className="text-sm text-muted-foreground">Entra con tu correo. No necesitas contraseña.</p>
      </div>

      {!configurado ? (
        <div className="rounded-xl border border-border p-4 text-sm">
          <p className="font-medium">Falta configurar Supabase</p>
          <p className="mt-1 text-muted-foreground">
            Agrega <code>NEXT_PUBLIC_SUPABASE_URL</code> y <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> en tu archivo
            <code> .env.local</code> (o en Vercel) y vuelve a cargar la página.
          </p>
        </div>
      ) : (
        <>
          {error === "no-autorizado" && (
            <p className="rounded-lg border border-excedido p-3 text-sm text-excedido">
              Esa cuenta no tiene acceso a esta app.
            </p>
          )}
          {error === "enlace" && (
            <p className="rounded-lg border border-border p-3 text-sm">
              El enlace venció o ya se usó. Pide uno nuevo o usa el código del correo.
            </p>
          )}
          <LoginForm />
        </>
      )}
    </main>
  );
}
