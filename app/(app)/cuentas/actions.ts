"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/components/app/action-form";
import { requireUser } from "@/lib/supabase/server";

const dia = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(1).max(31).nullable());

const CuentaSchema = z.object({
  nombre: z.string().trim().min(1, "Escribe un nombre").max(60),
  tipo: z.enum(["debito", "credito", "efectivo", "ahorro"]),
  dia_corte: dia,
  dia_limite_pago: dia,
  saldo_actual: z.preprocess((v) => Number(String(v || "0").replace(/[$,\s]/g, "")), z.number()),
  ultimos_4: z.preprocess(
    (v) => (v ? String(v).replace(/\D/g, "") : null),
    z.string().regex(/^\d{4}$/, "Solo los últimos 4 dígitos").nullable(),
  ),
});

function leer(formData: FormData) {
  return CuentaSchema.safeParse(Object.fromEntries(formData));
}

export async function crearCuenta(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const p = leer(formData);
  if (!p.success) return { error: p.error.issues[0].message };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("accounts").insert(p.data);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: "Cuenta creada" };
}

export async function actualizarCuenta(id: string, _: ActionResult, formData: FormData): Promise<ActionResult> {
  const p = leer(formData);
  if (!p.success) return { error: p.error.issues[0].message };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("accounts").update(p.data).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: "Guardado" };
}

export async function borrarCuenta(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("accounts").delete().eq("id", id);
  revalidatePath("/", "layout");
}
