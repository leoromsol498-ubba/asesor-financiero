"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AIError, extraerEstadoDeCuenta, interpretarCaptura } from "@/lib/ai";
import { todayISO } from "@/lib/dates";
import { requireUser } from "@/lib/supabase/server";
import { guardarMovimientos, prepararMovimientos, type FilaEntrada } from "@/lib/transactions";
import type { DraftTransaction } from "@/lib/types";

export type Preparado = { drafts?: DraftTransaction[]; aviso?: string | null; error?: string; importId?: string | null };

const FilaSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  descripcion: z.string().min(1).max(500),
  monto: z.number().finite(),
  tipo: z.enum(["gasto", "ingreso"]),
});

// ---------- CSV / Excel ----------
export async function prepararDesdeArchivo(
  nombreArchivo: string,
  filas: { fecha: string; descripcion: string; monto: number; tipo: "gasto" | "ingreso" }[],
  accountId: string | null,
): Promise<Preparado> {
  const parsed = z.array(FilaSchema).max(3000, "Máximo 3,000 movimientos por archivo").safeParse(filas);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase } = await requireUser();

  const { data: imp } = await supabase
    .from("imports")
    .insert({ nombre_archivo: nombreArchivo.slice(0, 200), estado: "procesado", movimientos_detectados: filas.length })
    .select("id")
    .single();

  const { drafts, aviso } = await prepararMovimientos(
    supabase,
    parsed.data.map((f) => ({ ...f, account_id: accountId })),
  );
  return { drafts, aviso, importId: imp?.id ?? null };
}

// ---------- PDF ----------
export async function registrarImportPDF(nombreArchivo: string): Promise<{ id?: string; ruta?: string; error?: string }> {
  const { supabase, user } = await requireUser();
  const id = crypto.randomUUID();
  const ruta = `${user.id}/${id}.pdf`;
  const { error } = await supabase
    .from("imports")
    .insert({ id, nombre_archivo: nombreArchivo.slice(0, 200), ruta_storage: ruta, estado: "pendiente" });
  if (error) return { error: error.message };
  return { id, ruta };
}

export async function procesarPDF(importId: string, accountId: string | null): Promise<Preparado> {
  const { supabase } = await requireUser();
  const { data: imp } = await supabase.from("imports").select("id, ruta_storage").eq("id", importId).single();
  if (!imp?.ruta_storage) return { error: "No se encontró el archivo." };

  const { data: blob, error: dlError } = await supabase.storage.from("statements").download(imp.ruta_storage);
  if (dlError || !blob) return { error: `No se pudo leer el PDF: ${dlError?.message ?? "desconocido"}` };

  try {
    const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
    const extraido = await extraerEstadoDeCuenta(base64, todayISO());

    // Si no se eligió cuenta, intenta encontrarla por los últimos 4 dígitos
    let cuenta = accountId;
    const ult4 = extraido.ultimos_4?.replace(/\D/g, "").slice(-4);
    if (!cuenta && ult4 && ult4.length === 4) {
      const { data: acc } = await supabase.from("accounts").select("id").eq("ultimos_4", ult4).limit(1).maybeSingle();
      cuenta = acc?.id ?? null;
    }

    const filas: FilaEntrada[] = extraido.movimientos
      .filter((m) => /^\d{4}-\d{2}-\d{2}$/.test(m.fecha) && Number.isFinite(m.monto) && m.monto !== 0)
      .map((m) => ({
        fecha: m.fecha,
        descripcion: m.descripcion,
        comercio: m.comercio,
        monto: Math.abs(m.monto),
        tipo: m.tipo,
        account_id: cuenta,
      }));

    await supabase.from("imports").update({ estado: "procesado", movimientos_detectados: filas.length }).eq("id", importId);
    const { drafts, aviso } = await prepararMovimientos(supabase, filas);
    return { drafts, aviso, importId };
  } catch (e) {
    await supabase.from("imports").update({ estado: "error" }).eq("id", importId);
    return { error: e instanceof AIError ? e.message : `Error al procesar el PDF: ${(e as Error).message}` };
  }
}

// ---------- Captura rápida ----------
export async function interpretarLinea(texto: string): Promise<Preparado> {
  const t = texto.trim();
  if (!t) return { error: "Escribe algo, por ejemplo: 350 súper con débito" };
  if (t.length > 300) return { error: "Texto demasiado largo." };
  const { supabase } = await requireUser();
  const [{ data: cuentas }, { data: cats }] = await Promise.all([
    supabase.from("accounts").select("id, nombre, tipo").order("created_at"),
    supabase.from("categories").select("id, nombre").order("nombre"),
  ]);

  try {
    const r = await interpretarCaptura(t, todayISO(), cuentas ?? [], (cats ?? []).map((c) => c.nombre));
    if (!r.monto) return { error: "No encontré el monto. Prueba: “350 súper con débito”." };
    const cuenta =
      (cuentas ?? []).find((c) => c.nombre.toLowerCase() === r.cuenta?.toLowerCase()) ??
      (cuentas ?? []).find((c) => c.tipo === "debito") ??
      (cuentas ?? [])[0];
    const cat = (cats ?? []).find((c) => c.nombre.toLowerCase() === r.categoria?.toLowerCase());
    const { drafts, aviso } = await prepararMovimientos(supabase, [
      {
        fecha: /^\d{4}-\d{2}-\d{2}$/.test(r.fecha) ? r.fecha : todayISO(),
        descripcion: r.descripcion || t,
        comercio: r.comercio,
        monto: Math.abs(r.monto),
        tipo: r.tipo,
        account_id: cuenta?.id ?? null,
        sugerencia: cat ? { category_id: cat.id, confianza: r.confianza } : null,
      },
    ]);
    return { drafts, aviso };
  } catch (e) {
    return { error: e instanceof AIError ? e.message : (e as Error).message };
  }
}

// ---------- Captura manual (sin IA si eliges categoría) ----------
export async function prepararManual(input: {
  fecha: string;
  descripcion: string;
  monto: number;
  tipo: "gasto" | "ingreso";
  account_id: string | null;
  category_id: string | null;
}): Promise<Preparado> {
  const p = FilaSchema.safeParse(input);
  if (!p.success || !(input.monto > 0)) return { error: "Revisa la fecha, la descripción y el monto." };
  const { supabase } = await requireUser();
  const { drafts, aviso } = await prepararMovimientos(supabase, [
    { ...p.data, account_id: input.account_id, category_id: input.category_id || null },
  ]);
  return { drafts, aviso };
}

// ---------- Guardar lo confirmado ----------
export async function guardarBorradores(drafts: DraftTransaction[], importId: string | null): Promise<{ guardados?: number; error?: string }> {
  const { supabase, user } = await requireUser();
  try {
    const guardados = await guardarMovimientos(supabase, user.id, drafts, importId);
    if (importId) await supabase.from("imports").update({ estado: "confirmado" }).eq("id", importId);
    revalidatePath("/", "layout");
    return { guardados };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
