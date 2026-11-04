"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/components/app/action-form";
import { requireUser } from "@/lib/supabase/server";

const PagoSchema = z.object({
  nombre: z.string().trim().min(1, "Escribe un nombre").max(60),
  monto: z.preprocess((v) => Number(String(v ?? "").replace(/[$,\s]/g, "")), z.number().min(0)),
  frecuencia: z.enum(["mensual", "anual", "unica"]),
  proximo_vencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha"),
  account_id: z.preprocess((v) => (v ? v : null), z.string().uuid().nullable()),
});

export async function crearPago(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const p = PagoSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0].message };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("scheduled_payments").insert(p.data);
  if (error) return { error: error.message };
  revalidatePath("/calendario");
  return { ok: "Pago programado" };
}

export async function actualizarPago(id: string, _: ActionResult, formData: FormData): Promise<ActionResult> {
  const p = PagoSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0].message };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("scheduled_payments").update(p.data).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/calendario");
  return { ok: "Guardado" };
}

export async function borrarPago(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("scheduled_payments").delete().eq("id", id);
  revalidatePath("/calendario");
}
