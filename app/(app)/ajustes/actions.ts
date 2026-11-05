"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/components/app/action-form";
import { todayISO } from "@/lib/dates";
import { enviarCorreo, plantilla } from "@/lib/email";
import { reporteSemanal, revisarPagos } from "@/lib/jobs";
import { requireUser } from "@/lib/supabase/server";

export async function cambiarIA(encender: boolean): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, usar_ia: encender, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { error: `No se pudo guardar: ${error.message}. ¿Ejecutaste el archivo supabase/setup.sql actualizado?` };
  revalidatePath("/", "layout");
  return { ok: encender ? "IA encendida." : "IA apagada. Ya no se gastarán tokens." };
}

export async function cargarDemo(): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("cargar_datos_demo");
  if (error) return { error: `No se pudieron cargar: ${error.message}. ¿Ejecutaste las migraciones en Supabase?` };
  revalidatePath("/", "layout");
  return { ok: "Datos de ejemplo cargados. Ve a Inicio para verlos." };
}

export async function borrarDemo(): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("borrar_datos_demo");
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: "Datos de ejemplo borrados. Tus datos reales siguen intactos." };
}

export async function correoPrueba(): Promise<ActionResult> {
  await requireUser();
  try {
    await enviarCorreo("Correo de prueba", plantilla("¡Funciona!", "<p>Si lees esto, las alertas por correo están bien configuradas.</p>"));
    return { ok: "Correo enviado. Revisa tu bandeja (y la carpeta de spam)." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function probarAlertas(): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  try {
    const r = await revisarPagos(supabase, user.id, todayISO(), { forzar: true });
    return { ok: r.enviados ? `Se envió un correo con ${r.enviados} pago(s) próximos.` : "No hay pagos en los próximos 7 días, así que no se envió correo." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function probarReporte(): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  try {
    await reporteSemanal(supabase, user.id, todayISO());
    return { ok: "Reporte semanal enviado a tu correo." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
