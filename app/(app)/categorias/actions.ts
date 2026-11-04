"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/components/app/action-form";
import { requireUser } from "@/lib/supabase/server";

const CategoriaSchema = z.object({
  nombre: z.string().trim().min(1, "Escribe un nombre").max(40),
  presupuesto_mensual: z.preprocess((v) => Number(String(v || "0").replace(/[$,\s]/g, "")), z.number().min(0, "El presupuesto no puede ser negativo")),
  color_neutro: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#525252"),
});

export async function crearCategoria(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const p = CategoriaSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0].message };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("categories").insert(p.data);
  if (error) return { error: error.code === "23505" ? "Ya existe una categoría con ese nombre" : error.message };
  revalidatePath("/", "layout");
  return { ok: "Categoría creada" };
}

export async function actualizarCategoria(id: string, _: ActionResult, formData: FormData): Promise<ActionResult> {
  const p = CategoriaSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0].message };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("categories").update(p.data).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: "Guardado" };
}

export async function borrarCategoria(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("categories").delete().eq("id", id);
  revalidatePath("/", "layout");
}

export async function borrarRegla(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("categorization_rules").delete().eq("id", id);
  revalidatePath("/categorias");
}

const BASICAS = [
  ["Supermercado", 5000], ["Restaurantes", 2000], ["Transporte", 1500], ["Servicios", 1500],
  ["Suscripciones", 500], ["Salud", 1000], ["Entretenimiento", 1000], ["Ropa", 800],
  ["Hogar", 800], ["Otros", 1000], ["Ingresos", 0],
] as const;

export async function crearCategoriasBasicas() {
  const { supabase } = await requireUser();
  const grises = ["#171717", "#262626", "#404040", "#525252", "#737373", "#a3a3a3"];
  await supabase.from("categories").upsert(
    BASICAS.map(([nombre, presupuesto_mensual], i) => ({ nombre, presupuesto_mensual, color_neutro: grises[i % grises.length] })),
    { onConflict: "user_id,nombre", ignoreDuplicates: true },
  );
  revalidatePath("/", "layout");
}
