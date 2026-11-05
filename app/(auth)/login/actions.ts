"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { allowedEmail } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string; enviado?: boolean; email?: string };

export async function enviarEnlace(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const permitido = allowedEmail();
  if (!email) return { error: "Escribe tu correo." };
  if (!permitido) return { error: "Falta configurar ALLOWED_EMAIL en las variables de entorno." };
  if (email !== permitido) return { error: "Este correo no tiene acceso a la app." };

  const h = await headers();
  const origin = h.get("origin") || `https://${h.get("host")}`;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm`, shouldCreateUser: true },
  });
  if (error) {
    console.error("[login] Supabase rechazó el envío del correo:", error.status, error.code, error.message);
    return { error: `No se pudo enviar el correo: ${traducirError(error.message)}`, email };
  }
  console.info("[login] Supabase aceptó el envío del enlace de acceso");
  return { enviado: true, email };
}

function traducirError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("rate limit") || m.includes("security purposes"))
    return "pediste demasiados correos seguidos. Espera unos minutos e intenta de nuevo.";
  if (m.includes("sending") || m.includes("smtp"))
    return "Supabase no pudo entregar el correo. Revisa la configuración SMTP (Paso 2 del README) y el registro de envíos en Resend.";
  if (m.includes("not authorized"))
    return "Supabase solo envía a correos autorizados. Configura el SMTP de Resend (Paso 2 del README).";
  return msg;
}

export async function verificarCodigo(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const token = String(formData.get("token") || "").replace(/\s/g, "");
  if (email !== allowedEmail()) return { error: "Este correo no tiene acceso a la app.", enviado: true, email };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { error: "Código incorrecto o vencido. Pide uno nuevo.", enviado: true, email };
  redirect("/");
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
