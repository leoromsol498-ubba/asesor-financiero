import { APP_CURRENCY, APP_LOCALE } from "./config";

const moneyFmt = new Intl.NumberFormat(APP_LOCALE, {
  style: "currency",
  currency: APP_CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const moneyFmtShort = new Intl.NumberFormat(APP_LOCALE, {
  style: "currency",
  currency: APP_CURRENCY,
  maximumFractionDigits: 0,
});

/** $12,345.67 */
export function money(n: number | string | null | undefined): string {
  return moneyFmt.format(Number(n ?? 0));
}

/** $12,346 (sin centavos, para gráficas y tarjetas) */
export function moneyShort(n: number | string | null | undefined): string {
  return moneyFmtShort.format(Number(n ?? 0));
}

export function pct(n: number, decimals = 0): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(decimals)}%`;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-11-04" → "4 nov 2026" */
export function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES[m - 1]} ${y}`;
}

/** "2026-11" → "nov 26" */
export function mesCorto(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MESES[m - 1]} ${String(y).slice(2)}`;
}

export function mesLargo(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MESES_LARGOS[m - 1]} ${y}`;
}
