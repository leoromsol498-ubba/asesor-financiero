import { PageHeader } from "@/components/app/page-header";
import { requireUser } from "@/lib/supabase/server";
import { ReviewList } from "./review-list";

export default async function RevisarPage() {
  const { supabase } = await requireUser();
  const [{ data: txs }, { data: cats }] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, fecha, descripcion_original, comercio, monto, tipo, category_id, confianza, accounts(nombre)")
      .eq("requiere_revision", true)
      .order("fecha", { ascending: false })
      .limit(200),
    supabase.from("categories").select("id, nombre").order("nombre"),
  ]);

  const items = (txs ?? []).map((t) => {
    const acc = t.accounts as unknown as { nombre: string } | null;
    return { ...t, monto: Number(t.monto), confianza: t.confianza === null ? null : Number(t.confianza), cuenta: acc?.nombre ?? null };
  });

  return (
    <>
      <PageHeader
        titulo="Por revisar"
        descripcion="Toca la categoría correcta. La app aprende: la próxima vez ese comercio se categoriza solo."
      />
      <ReviewList items={items} categorias={cats ?? []} />
    </>
  );
}
