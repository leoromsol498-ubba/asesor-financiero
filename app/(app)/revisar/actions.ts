"use server";

import { revalidatePath } from "next/cache";
import { patronDesde, reglaCoincide } from "@/lib/rules";
import { requireUser } from "@/lib/supabase/server";

/**
 * Corrige (o confirma) la categoría de un movimiento, crea/actualiza una regla
 * y aplica esa regla a los demás movimientos parecidos que siguen por revisar.
 */
export async function corregirCategoria(txId: string, categoryId: string): Promise<{ similares: number }> {
  const { supabase } = await requireUser();
  const { data: tx } = await supabase
    .from("transactions")
    .select("id, descripcion_original, comercio")
    .eq("id", txId)
    .single();
  if (!tx) return { similares: 0 };

  await supabase
    .from("transactions")
    .update({ category_id: categoryId, requiere_revision: false, confianza: 1 })
    .eq("id", txId);

  const patron = patronDesde(tx.descripcion_original, tx.comercio);
  let similares = 0;
  if (patron) {
    await supabase
      .from("categorization_rules")
      .upsert({ patron_texto: patron, category_id: categoryId }, { onConflict: "user_id,patron_texto" });

    const { data: pendientes } = await supabase
      .from("transactions")
      .select("id, descripcion_original, comercio")
      .eq("requiere_revision", true)
      .neq("id", txId);
    const ids = (pendientes ?? [])
      .filter((p) => reglaCoincide(patron, p.descripcion_original, p.comercio))
      .map((p) => p.id);
    if (ids.length) {
      await supabase
        .from("transactions")
        .update({ category_id: categoryId, requiere_revision: false, confianza: 1 })
        .in("id", ids);
      similares = ids.length;
    }
  }
  revalidatePath("/", "layout");
  return { similares };
}

/** Confirma varios movimientos tal como están (sin crear reglas). */
export async function confirmarTodos(ids: string[]) {
  const { supabase } = await requireUser();
  await supabase.from("transactions").update({ requiere_revision: false }).in("id", ids).not("category_id", "is", null);
  revalidatePath("/", "layout");
}

export async function borrarMovimiento(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("transactions").delete().eq("id", id);
  revalidatePath("/", "layout");
}
