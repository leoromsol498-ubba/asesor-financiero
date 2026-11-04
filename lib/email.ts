import "server-only";
import { Resend } from "resend";
import { allowedEmail, appUrl } from "./config";

export function emailFrom(): string {
  // onboarding@resend.dev funciona sin dominio propio, pero solo envía al
  // correo con el que creaste tu cuenta de Resend.
  return process.env.ALERT_EMAIL_FROM || "Asesor Financiero <onboarding@resend.dev>";
}

export async function enviarCorreo(asunto: string, html: string, to: string = allowedEmail()) {
  if (!process.env.RESEND_API_KEY) throw new Error("Falta la variable RESEND_API_KEY");
  if (!to) throw new Error("Falta ALLOWED_EMAIL (destinatario)");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({ from: emailFrom(), to, subject: asunto, html });
  if (error) throw new Error(`Resend: ${error.message}`);
  return data?.id;
}

// ---------- Plantilla HTML sencilla (blanco, negro y grises) ----------
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function plantilla(titulo: string, cuerpo: string): string {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f5f5f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0a0a0a">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
  <div style="background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:24px">
    <p style="margin:0 0 4px;font-size:12px;color:#737373">Asesor Financiero</p>
    <h1 style="margin:0 0 16px;font-size:20px">${esc(titulo)}</h1>
    ${cuerpo}
    <p style="margin:24px 0 0"><a href="${appUrl()}" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px">Abrir la app</a></p>
  </div>
  <p style="font-size:11px;color:#a3a3a3;text-align:center;margin-top:12px">Este correo no contiene recomendaciones de inversión.</p>
</div></body></html>`;
}

export function tabla(filas: string[][], alinearUltima = true): string {
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">${filas
    .map(
      (f) =>
        `<tr>${f
          .map(
            (c, i) =>
              `<td style="padding:8px 4px;border-top:1px solid #eeeeee;${alinearUltima && i === f.length - 1 ? "text-align:right;white-space:nowrap" : ""}">${c}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("")}</table>`;
}

export const ROJO = "#dc2626";
