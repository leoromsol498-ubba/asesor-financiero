// Configuración general de la app. Todo sale de variables de entorno
// para que puedas cambiarlo sin tocar el código.

export const APP_CURRENCY = (process.env.NEXT_PUBLIC_APP_CURRENCY || "MXN").toUpperCase();
export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "America/Mexico_City";
export const APP_LOCALE = process.env.NEXT_PUBLIC_APP_LOCALE || "es-MX";

/** Correo único autorizado para entrar a la app (solo servidor). */
export function allowedEmail(): string {
  return (process.env.ALLOWED_EMAIL || "").trim().toLowerCase();
}

export function anthropicModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
}

export function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

/** Umbral de confianza: por debajo de esto un movimiento va a "Por revisar". */
export const CONFIANZA_MINIMA = 0.7;
