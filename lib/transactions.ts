import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AIError, categorizarLote } from "./ai";
import { CONFIANZA_MINIMA } from "./config";
import { addMonths } from "./dates";
import { transactionHash } from "./hash";
import { detectarRecurrentes } from "./recurring";
import { buscarRegla } from "./rules";
import { maskSensitiveNumbers } from "./text";
import type { Category, DraftTransaction, Rule, TipoMovimiento } from "./types";

export interface FilaEntrada {
  fecha: string;
  descripcion: string;
  comercio?: string | null;
  monto: number;
  tipo: TipoMovimiento;
  account_id: string | null;
  category_id?: string | null; // si ya viene elegida (captura manual)
  /** Sugerencia previa (ej. captura rápida): se usa si ninguna regla coincide. */
  sugerencia?: { category_id: string | null; confianza: number } | null;
}

/**
 * Prepara la vista previa: enmascara datos sensibles, calcula hash_unico,
 * marca duplicados y categoriza (reglas → IA).
 */
export async function prepararMovimientos(
  supabase: SupabaseClient,
  filas: FilaEntrada[],
  opciones: { usarIA?: boolean } = {},
): Promise<{ drafts: DraftTransaction[]; aviso: string | null }> {
  const usarIA = opciones.usarIA ?? true;
  const [{ data: reglas }, { data: categorias }] = await Promise.all([
    supabase.from("categorization_rules").select("id, patron_texto, category_id, veces_aplicada"),
    supabase.from("categories").select("id, nombre, presupuesto_mensual, color_neutro, es_demo").order("nombre"),
  ]);
  const cats = (categorias ?? []) as Category[];

  const drafts: DraftTransaction[] = filas.map((f, i) => {
    const descripcion = maskSensitiveNumbers(f.descripcion.trim()).slice(0, 300);
    const monto = Math.round(Math.abs(Number(f.monto)) * 100) / 100;
    return {
      key: `${i}-${Math.random().toString(36).slice(2, 8)}`,
      fecha: f.fecha,
      descripcion_original: descripcion,
      comercio: f.comercio ? maskSensitiveNumbers(f.comercio).slice(0, 80) : null,
      monto,
      tipo: f.tipo,
      account_id: f.account_id,
      category_id: f.category_id ?? null,
      confianza: f.category_id ? 1 : null,
      origen_categoria: f.category_id ? "manual" : null,
      requiere_revision: false,
      hash_unico: transactionHash(f.fecha, monto, descripcion),
      duplicado: false,
      incluir: true,
    };
  });

  // Duplicados contra la base de datos y dentro del mismo archivo
  const hashes = [...new Set(drafts.map((d) => d.hash_unico))];
  const existentes = new Set<string>();
  for (let i = 0; i < hashes.length; i += 200) {
    const { data } = await supabase
      .from("transactions")
      .select("hash_unico")
      .in("hash_unico", hashes.slice(i, i + 200));
    data?.forEach((r) => existentes.add(r.hash_unico));
  }
  const vistos = new Set<string>();
  for (const d of drafts) {
    if (existentes.has(d.hash_unico) || vistos.has(d.hash_unico)) {
      d.duplicado = true;
      d.incluir = false;
    }
    vistos.add(d.hash_unico);
  }

  // 1) Reglas aprendidas
  for (const d of drafts) {
    if (d.category_id) continue;
    const regla = buscarRegla((reglas ?? []) as Rule[], d.descripcion_original, d.comercio);
    if (regla) {
      d.category_id = regla.category_id;
      d.confianza = 1;
      d.origen_categoria = "regla";
    }
  }

  // 1b) Sugerencias que ya venían (captura rápida interpretada por IA)
  drafts.forEach((d, i) => {
    const sug = filas[i].sugerencia;
    if (!d.category_id && sug && sug.category_id) {
      d.category_id = sug.category_id;
      d.confianza = Math.max(0, Math.min(1, sug.confianza));
      d.origen_categoria = "ia";
    }
  });

  // 2) IA para lo que no tuvo regla
  let aviso: string | null = null;
  const pendientes = drafts.filter((d) => !d.category_id && !d.duplicado);
  if (pendientes.length > 0 && !usarIA) {
    aviso = `IA apagada: ${pendientes.length} movimiento${pendientes.length === 1 ? "" : "s"} sin regla irá${pendientes.length === 1 ? "" : "n"} a “Por revisar”. También puedes elegir la categoría aquí mismo.`;
  }
  if (pendientes.length > 0 && usarIA && cats.length > 0) {
    try {
      const res = await categorizarLote(
        pendientes.map((d) => ({ id: d.key, descripcion: d.descripcion_original, monto: d.monto, tipo: d.tipo })),
        cats.map((c) => c.nombre),
      );
      const porNombre = new Map(cats.map((c) => [c.nombre.toLowerCase(), c.id]));
      const porKey = new Map(res.map((r) => [r.id, r]));
      for (const d of pendientes) {
        const r = porKey.get(d.key);
        if (!r) continue;
        d.category_id = r.categoria ? porNombre.get(r.categoria.toLowerCase()) ?? null : null;
        d.confianza = Math.max(0, Math.min(1, r.confianza));
        d.origen_categoria = "ia";
        if (!d.comercio && r.comercio) d.comercio = maskSensitiveNumbers(r.comercio).slice(0, 80);
      }
    } catch (e) {
      aviso = e instanceof AIError ? e.message : "No se pudo categorizar con IA; quedan para revisión.";
    }
  }

  // 3) Baja confianza o sin categoría → "Por revisar"
  for (const d of drafts) {
    d.requiere_revision = !d.category_id || (d.confianza ?? 0) < CONFIANZA_MINIMA;
  }

  return { drafts, aviso };
}

/** Guarda los movimientos confirmados e identifica recurrentes. */
export async function guardarMovimientos(
  supabase: SupabaseClient,
  userId: string,
  drafts: DraftTransaction[],
  importId: string | null = null,
): Promise<number> {
  const filas = drafts
    .filter((d) => d.incluir)
    .map((d) => ({
      user_id: userId,
      account_id: d.account_id || null,
      fecha: d.fecha,
      descripcion_original: maskSensitiveNumbers(d.descripcion_original).slice(0, 300),
      comercio: d.comercio ? maskSensitiveNumbers(d.comercio).slice(0, 80) : null,
      monto: Math.abs(Number(d.monto)),
      tipo: d.tipo,
      category_id: d.category_id || null,
      requiere_revision: d.requiere_revision,
      confianza: d.confianza,
      // Si el usuario cambió fecha/monto/descripción en la vista previa, recalculamos el hash
      hash_unico: transactionHash(d.fecha, Number(d.monto), maskSensitiveNumbers(d.descripcion_original).slice(0, 300)),
      import_id: importId,
    }));
  if (filas.length === 0) return 0;

  let guardados = 0;
  for (let i = 0; i < filas.length; i += 500) {
    const { data, error } = await supabase
      .from("transactions")
      .upsert(filas.slice(i, i + 500), { onConflict: "user_id,hash_unico", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(error.message);
    guardados += data?.length ?? 0;
  }

  await marcarRecurrentes(supabase);
  return guardados;
}

/** Revisa los gastos de los últimos 6 meses y marca los recurrentes. */
export async function marcarRecurrentes(supabase: SupabaseClient): Promise<void> {
  const desde = addMonths(new Date().toISOString().slice(0, 10), -6);
  const { data } = await supabase
    .from("transactions")
    .select("id, fecha, monto, descripcion_original, comercio, es_recurrente")
    .eq("tipo", "gasto")
    .gte("fecha", desde);
  if (!data) return;
  const ids = detectarRecurrentes(data);
  const nuevos = data.filter((t) => ids.has(t.id) && !t.es_recurrente).map((t) => t.id);
  for (let i = 0; i < nuevos.length; i += 200) {
    await supabase.from("transactions").update({ es_recurrente: true }).in("id", nuevos.slice(i, i + 200));
  }
}
