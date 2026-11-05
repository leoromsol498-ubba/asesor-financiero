"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/components/app/action-form";
import { todayISO } from "@/lib/dates";
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
  const { error } = await supabase.from("accounts").insert({ ...p.data, saldo_fecha: todayISO() });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: "Cuenta creada" };
}

export async function actualizarCuenta(id: string, _: ActionResult, formData: FormData): Promise<ActionResult> {
  const p = leer(formData);
  if (!p.success) return { error: p.error.issues[0].message };
  const { supabase } = await requireUser();
  // Si cambiaste el saldo a mano, hoy es el nuevo punto de partida
  const { data: actual } = await supabase.from("accounts").select("saldo_actual").eq("id", id).single();
  const cambioSaldo = !actual || Number(actual.saldo_actual) !== p.data.saldo_actual;
  const { error } = await supabase
    .from("accounts")
    .update(cambioSaldo ? { ...p.data, saldo_fecha: todayISO() } : p.data)
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: "Guardado" };
}

export async function borrarCuenta(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("accounts").delete().eq("id", id);
  revalidatePath("/", "layout");
}
