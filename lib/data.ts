import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resumenPresupuesto, type CategoriaMin, type MovimientoMin } from "./budget";
import { addMonths, lastMonths, monthEnd, monthStart } from "./dates";

/** Carga todo lo necesario para el estado del presupuesto del mes de `hoy`. */
export async function cargarPresupuesto(supabase: SupabaseClient, hoy: string, userId?: string) {
  const inicio6 = monthStart(addMonths(hoy, -5));
  let qCats = supabase.from("categories").select("id, nombre, presupuesto_mensual").order("nombre");
  let qTx = supabase
    .from("transactions")
    .select("id, fecha, descripcion_original, comercio, monto, tipo, category_id, es_recurrente")
    .gte("fecha", inicio6)
    .lte("fecha", monthEnd(hoy))
    .limit(20000);
  if (userId) {
    // Cliente admin (crons): filtrar SIEMPRE por usuario
    qCats = qCats.eq("user_id", userId);
    qTx = qTx.eq("user_id", userId);
  }
  const [{ data: cats }, { data: txs }] = await Promise.all([qCats, qTx]);

  const categorias = (cats ?? []).map((c) => ({ ...c, presupuesto_mensual: Number(c.presupuesto_mensual) })) as CategoriaMin[];
  const movs = (txs ?? []).map((t) => ({ ...t, monto: Number(t.monto) }));
  const mesActual = hoy.slice(0, 7);
  const gastosMes = movs.filter((t) => t.tipo === "gasto" && t.fecha.startsWith(mesActual)) as MovimientoMin[];
  const resumen = resumenPresupuesto(categorias, gastosMes, hoy);

  const meses = lastMonths(hoy, 6);
  const evolucion = meses.map((m) => ({
    mes: m,
    gastos: round(movs.filter((t) => t.tipo === "gasto" && t.fecha.startsWith(m)).reduce((s, t) => s + t.monto, 0)),
    ingresos: round(movs.filter((t) => t.tipo === "ingreso" && t.fecha.startsWith(m)).reduce((s, t) => s + t.monto, 0)),
  }));

  // Gasto promedio por categoría en los 3 meses anteriores (para la IA)
  const previos = meses.slice(2, 5);
  const promedio3m = new Map<string, number>();
  for (const c of categorias) {
    const total = movs
      .filter((t) => t.tipo === "gasto" && t.category_id === c.id && previos.includes(t.fecha.slice(0, 7)))
      .reduce((s, t) => s + t.monto, 0);
    promedio3m.set(c.id, round(total / 3));
  }

  const presupuestoTotal = categorias.reduce((s, c) => s + c.presupuesto_mensual, 0);
  const gastadoMes = round(gastosMes.reduce((s, t) => s + Number(t.monto), 0));
  const ingresosMes = evolucion[evolucion.length - 1].ingresos;
  const sinCategoria = round(gastosMes.filter((t) => !t.category_id).reduce((s, t) => s + Number(t.monto), 0));

  return { categorias, resumen, evolucion, promedio3m, presupuestoTotal, gastadoMes, ingresosMes, sinCategoria };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
