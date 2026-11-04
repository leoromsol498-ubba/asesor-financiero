import { APP_TIMEZONE } from "./config";

// Todas las fechas de negocio se manejan como texto "YYYY-MM-DD" en la zona
// horaria de la app, para evitar errores por diferencias de huso horario.

export function todayISO(tz: string = APP_TIMEZONE, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function parseISO(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { y, m, d };
}

export function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addDays(iso: string, n: number): string {
  const { y, m, d } = parseISO(iso);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** Suma meses respetando el fin de mes (31 ene + 1 mes = 28/29 feb). */
export function addMonths(iso: string, n: number): string {
  const { y, m, d } = parseISO(iso);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return toISO(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

export function diffDays(fromISO: string, toISO_: string): number {
  const a = parseISO(fromISO);
  const b = parseISO(toISO_);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthStart(iso: string): string {
  return iso.slice(0, 7) + "-01";
}

export function monthEnd(iso: string): string {
  const { y, m } = parseISO(iso);
  return toISO(y, m, daysInMonth(y, m));
}

/** Lista de claves "YYYY-MM" de los últimos n meses, terminando en el mes de `iso`. */
export function lastMonths(iso: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(monthKey(addMonths(monthStart(iso), -i)));
  return out;
}

/** Meses completos (con fracción) entre dos fechas. */
export function monthsBetween(fromISO: string, toISO_: string): number {
  const a = parseISO(fromISO);
  const b = parseISO(toISO_);
  return (b.y - a.y) * 12 + (b.m - a.m) + (b.d - a.d) / 30.4375;
}

/** Próxima fecha (>= hoy) que cae en el día `dia` del mes. */
export function nextDayOfMonth(today: string, dia: number): string {
  const { y, m } = parseISO(today);
  const thisMonth = toISO(y, m, Math.min(dia, daysInMonth(y, m)));
  if (thisMonth >= today) return thisMonth;
  const next = addMonths(toISO(y, m, 1), 1);
  const n = parseISO(next);
  return toISO(n.y, n.m, Math.min(dia, daysInMonth(n.y, n.m)));
}
