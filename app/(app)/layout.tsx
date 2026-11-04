import { BottomNav, Sidebar } from "@/components/app/nav";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/supabase/server";
import { cerrarSesion } from "../(auth)/login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUser();
  const { count } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("requiere_revision", true);
  const pendientes = count ?? 0;

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-3">
          <div className="h-6 w-6 rounded-md bg-neutral-950" />
          <span className="font-semibold">Asesor Financiero</span>
        </div>
        <Sidebar pendientes={pendientes} />
        <div className="mt-auto flex flex-col gap-2 px-3 text-xs text-muted-foreground">
          <span className="truncate">{user.email}</span>
          <form action={cerrarSesion}>
            <Button variant="outline" size="sm" className="w-full">Cerrar sesión</Button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
      <BottomNav pendientes={pendientes} />
    </div>
  );
}
