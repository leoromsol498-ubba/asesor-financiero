import { PageHeader } from "@/components/app/page-header";
import { Empty } from "@/components/ui/empty";
import { todayISO } from "@/lib/dates";
import { usarIA } from "@/lib/settings";
import { requireUser } from "@/lib/supabase/server";
import { FileImport } from "./file-import";
import { PdfImport } from "./pdf-import";
import { QuickCapture } from "./quick-capture";
import { Tabs } from "./tabs";

// Leer un PDF con IA puede tardar: damos hasta 5 minutos a esta página.
export const maxDuration = 300;

export default async function ImportarPage() {
  const { supabase } = await requireUser();
  const [{ data: cuentas }, { data: categorias }, ia] = await Promise.all([
    supabase.from("accounts").select("id, nombre, saldo_fecha").order("created_at"),
    supabase.from("categories").select("id, nombre").order("nombre"),
    usarIA(supabase),
  ]);
  const c = cuentas ?? [];
  const k = categorias ?? [];

  return (
    <>
      <PageHeader titulo="Agregar movimientos" descripcion="Captura uno rápido o importa varios desde tu banco." />
      {k.length === 0 && (
        <div className="mb-4">
          <Empty
            titulo="Primero crea tus categorías"
            texto="La app necesita categorías (Supermercado, Transporte…) para clasificar tus gastos."
            href="/categorias"
            accion="Ir a categorías"
          />
        </div>
      )}
      <Tabs
        tabs={[
          { id: "rapida", label: ia ? "Rápida" : "Manual", content: <QuickCapture cuentas={c} categorias={k} hoy={todayISO()} usarIA={ia} /> },
          { id: "archivo", label: "CSV / Excel", content: <FileImport cuentas={c} categorias={k} usarIA={ia} /> },
          ...(ia ? [{ id: "pdf", label: "PDF", content: <PdfImport cuentas={c} categorias={k} /> }] : []),
        ]}
      />
    </>
  );
}
