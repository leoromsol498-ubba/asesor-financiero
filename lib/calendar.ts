import { addDays, addMonths, daysInMonth, parseISO, toISO } from "./dates";
import type { Account, Frecuencia, ScheduledPayment, TipoMovimiento } from "./types";

export interface Evento {
  fecha: string;
  tipo: "corte" | "limite" | "pago" | "ingreso";
  nombre: string;
  monto: number | null;
  account_id: string | null;
  payment_id: string | null;
}

type Programado = Pick<ScheduledPayment, "id" | "nombre" | "monto" | "frecuencia" | "proximo_vencimiento" | "account_id"> & {
  tipo?: TipoMovimiento;
};

export const FRECUENCIAS: Record<Frecuencia, string> = {
  semanal: "Semanal",
  catorcenal: "Cada 14 días",
  quincenal: "Quincenal",
  mensual: "Mensual",
  anual: "Anual",
  unica: "Única vez",
};

/** Días de cobro de una quincena a partir del día base: 1→(1,16), 15→(15, fin de mes), 20→(5,20). */
function diasQuincena(base: number, y: number, m: number): number[] {
  const dim = daysInMonth(y, m);
  const a = base > 15 ? base - 15 : base;
  const b = a + 15 >= 30 ? dim : Math.min(a + 15, dim);
  return [Math.min(a, dim), b];
}

/**
 * Todas las fechas en que ocurre algo programado entre `desde` y `hasta`
 * (incluidas), sin contar fechas anteriores a su `proximo_vencimiento`.
 */
export function ocurrencias(
  p: Pick<ScheduledPayment, "frecuencia" | "proximo_vencimiento">,
  desde: string,
  hasta: string,
): string[] {
  const base = p.proximo_vencimiento;
  const b = parseISO(base);
  const inicio = desde > base ? desde : base;
  if (inicio > hasta) return [];
  const out: string[] = [];

  if (p.frecuencia === "unica") {
    if (base >= desde && base <= hasta) out.push(base);
    return out;
  }
  if (p.frecuencia === "semanal" || p.frecuencia === "catorcenal") {
    const paso = p.frecuencia === "semanal" ? 7 : 14;
    // Saltar directo cerca de `inicio`
    const { y, m, d } = parseISO(inicio);
    const diff = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(b.y, b.m - 1, b.d)) / 86_400_000);
    let f = addDays(base, Math.max(0, Math.floor(diff / paso)) * paso);
    for (let i = 0; f <= hasta && i < 400; i++, f = addDays(f, paso)) if (f >= inicio) out.push(f);
    return out;
  }

  // Mensual, anual y quincenal: recorrer meses
  let cur = inicio.slice(0, 7) + "-01";
  for (let i = 0; cur <= hasta && i < 600; i++, cur = addMonths(cur, 1)) {
    const { y, m } = parseISO(cur);
    let dias: number[] = [];
    if (p.frecuencia === "mensual") dias = [Math.min(b.d, daysInMonth(y, m))];
    else if (p.frecuencia === "anual") dias = m === b.m ? [Math.min(b.d, daysInMonth(y, m))] : [];
    else if (p.frecuencia === "quincenal") dias = diasQuincena(b.d, y, m);
    for (const d of dias) {
      const f = toISO(y, m, d);
      if (f >= inicio && f <= hasta) out.push(f);
    }
  }
  return out;
}

/** Todas las fechas importantes (cortes, límites de pago, pagos e ingresos programados) entre dos fechas. */
export function eventosEntre(
  cuentas: Pick<Account, "id" | "nombre" | "tipo" | "dia_corte" | "dia_limite_pago" | "saldo_actual">[],
  pagos: Programado[],
  desde: string,
  hasta: string,
): Evento[] {
  const eventos: Evento[] = [];

  for (const c of cuentas) {
    if (c.tipo !== "credito") continue;
    let cur = desde.slice(0, 7) + "-01";
    for (let i = 0; cur <= hasta && i < 600; i++, cur = addMonths(cur, 1)) {
      const { y, m } = parseISO(cur);
      const dim = daysInMonth(y, m);
      if (c.dia_corte) {
        eventos.push({ fecha: toISO(y, m, Math.min(c.dia_corte, dim)), tipo: "corte", nombre: `Corte ${c.nombre}`, monto: null, account_id: c.id, payment_id: null });
      }
      if (c.dia_limite_pago) {
        eventos.push({
          fecha: toISO(y, m, Math.min(c.dia_limite_pago, dim)),
          tipo: "limite",
          nombre: `Pago ${c.nombre}`,
          monto: Number(c.saldo_actual) < 0 ? -Number(c.saldo_actual) : null,
          account_id: c.id,
          payment_id: null,
        });
      }
    }
  }

  for (const p of pagos) {
    for (const fecha of ocurrencias(p, desde, hasta)) {
      eventos.push({
        fecha,
        tipo: p.tipo === "ingreso" ? "ingreso" : "pago",
        nombre: p.nombre,
        monto: Number(p.monto),
        account_id: p.account_id,
        payment_id: p.id,
      });
    }
  }

  return eventos.filter((e) => e.fecha >= desde && e.fecha <= hasta).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Siguiente fecha (>= desde) en que ocurre; null si ya no habrá más (pago único vencido). */
export function proximaOcurrencia(p: Pick<ScheduledPayment, "frecuencia" | "proximo_vencimiento">, desde: string): string | null {
  if (p.proximo_vencimiento >= desde) return p.proximo_vencimiento;
  if (p.frecuencia === "unica") return null;
  return ocurrencias(p, desde, addDays(desde, 400))[0] ?? null;
}

/** Si un pago recurrente ya pasó, calcula su siguiente vencimiento (null si no hay que moverlo). */
export function siguienteVencimiento(p: Pick<ScheduledPayment, "frecuencia" | "proximo_vencimiento">, hoy: string): string | null {
  if (p.proximo_vencimiento >= hoy) return null;
  return proximaOcurrencia(p, hoy);
}
