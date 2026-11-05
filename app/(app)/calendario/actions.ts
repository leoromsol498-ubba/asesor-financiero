"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/components/app/action-form";
import { registrarProgramados } from "@/lib/jobs";
import { todayISO } from "@/lib/dates";
import { requireUser } from "@/lib/supabase/server";

const PagoSchema = z.object({
  nombre: z.string().trim().min(1, "Escribe un nombre").max(60),
  monto: z.preprocess((v) => Number(String(v ?? "").replace(/[$,\s]/g, "")), z.number().min(0)),
  frecuencia: z.enum(["semanal", "catorcenal", "quincenal", "mensual", "anual", "unica"]),
  proximo_vencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha"),
  account_id: z.preprocess((v) => (v ? v : null), z.string().uuid().nullable()),
  tipo: z.enum(["gasto", "ingreso"]).default("gasto"),
  category_id: z.preprocess((v) => (v ? v : null), z.string().uuid().nullable()),
  registrar_automatico: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

function leer(formData: FormData) {
  // Un checkbox desmarcado no se envía: lo agregamos como false
  return PagoSchema.safeParse({ registrar_automatico: false, ...Object.fromEntries(formData) });
}

/** Si quedó con registro automático y la fecha ya llegó, se registra al momento. */
async function registrarSiToca() {
  const { supabase, user } = await requireUser();
  await registrarProgramados(supabase, user.id, todayISO());
}

export async function crearPago(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const p = leer(formData);
  if (!p.success) return { error: p.error.issues[0].message };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("scheduled_payments").insert(p.data);
  if (error) return { error: error.message };
  await registrarSiToca();
  revalidatePath("/", "layout");
  return { ok: p.data.tipo === "ingreso" ? "Ingreso programado" : "Pago programado" };
}

export async function actualizarPago(id: string, _: ActionResult, formData: FormData): Promise<ActionResult> {
  const p = leer(formData);
  if (!p.success) return { error: p.error.issues[0].message };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("scheduled_payments").update(p.data).eq("id", id);
  if (error) return { error: error.message };
  await registrarSiToca();
  revalidatePath("/", "layout");
  return { ok: "Guardado" };
}

export async function borrarPago(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("scheduled_payments").delete().eq("id", id);
  revalidatePath("/calendario");
}
