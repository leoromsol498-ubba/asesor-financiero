"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/components/app/action-form";
import { AIError, proponerAhorro, type PropuestaAhorro } from "@/lib/ai";
import { cargarPresupuesto } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { analizarMeta } from "@/lib/goals";
import { MENSAJE_IA_APAGADA, usarIA } from "@/lib/settings";
import { requireUser } from "@/lib/supabase/server";

const num = (v: unknown) => Number(String(v ?? "").replace(/[$,\s]/g, ""));

const MetaSchema = z.object({
  nombre: z.string().trim().min(1, "Escribe un nombre").max(60),
  monto_objetivo: z.preprocess(num, z.number().positive("El objetivo debe ser mayor a 0")),
  fecha_objetivo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige una fecha"),
  monto_inicial: z.preprocess((v) => (v === "" || v == null ? 0 : num(v)), z.number().min(0)),
});

export async function crearMeta(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const p = MetaSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0].message };
  const { supabase } = await requireUser();
  const { monto_inicial, ...meta } = p.data;
  const { data, error } = await supabase.from("savings_goals").insert(meta).select("id").single();
  if (error) return { error: error.message };
  if (monto_inicial > 0) {
    await supabase.from("goal_contributions").insert({ goal_id: data.id, monto: monto_inicial, fecha: todayISO(), nota: "Saldo inicial" });
  }
  revalidatePath("/metas");
  return { ok: "Meta creada" };
}

const AporteSchema = z.object({
  monto: z.preprocess(num, z.number().refine((n) => n !== 0, "Escribe un monto (negativo si retiraste)")),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function registrarAporte(goalId: string, _: ActionResult, formData: FormData): Promise<ActionResult> {
  const p = AporteSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0].message };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("goal_contributions").insert({ goal_id: goalId, ...p.data });
  if (error) return { error: error.message };
  revalidatePath("/metas");
  return { ok: "Aportación registrada" };
}

export async function borrarMeta(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("savings_goals").delete().eq("id", id);
  revalidatePath("/metas");
}

export async function sugerirAhorro(goalId: string): Promise<{ propuesta?: PropuestaAhorro; error?: string }> {
  const { supabase } = await requireUser();
  if (!(await usarIA(supabase))) return { error: MENSAJE_IA_APAGADA };
  const hoy = todayISO();
  const [{ data: meta }, { data: aportes }] = await Promise.all([
    supabase.from("savings_goals").select("*").eq("id", goalId).single(),
    supabase.from("goal_contributions").select("fecha, monto").eq("goal_id", goalId),
  ]);
  if (!meta) return { error: "Meta no encontrada" };
  const a = analizarMeta(meta, (aportes ?? []).map((x) => ({ ...x, monto: Number(x.monto) })), hoy);
  const p = await cargarPresupuesto(supabase, hoy);

  const contexto = {
    meta: {
      nombre: meta.nombre,
      falta: a.falta,
      fecha_objetivo: meta.fecha_objetivo,
      ahorro_necesario_por_mes: a.porMes,
      ahorro_real_promedio_ultimos_3_meses: a.ritmoMensual,
      diferencia_mensual_a_cubrir: Math.max(a.porMes - a.ritmoMensual, 0),
    },
    categorias: p.resumen
      .filter((r) => r.gastado > 0 || r.presupuesto > 0)
      .map((r) => ({
        categoria: r.categoria.nombre,
        presupuesto_mensual: r.presupuesto,
        gastado_mes_actual: r.gastado,
        proyeccion_cierre_mes: r.proyeccion,
        promedio_mensual_3_meses_previos: p.promedio3m.get(r.categoria.id) ?? 0,
        estado: r.estado,
      })),
    ingresos_mes_actual: p.ingresosMes,
  };

  try {
    return { propuesta: await proponerAhorro(contexto) };
  } catch (e) {
    return { error: e instanceof AIError ? e.message : (e as Error).message };
  }
}
