import { addMonths, daysInMonth, parseISO, toISO } from "./dates";
import type { Account, ScheduledPayment } from "./types";

export interface Evento {
  fecha: string;
  tipo: "corte" | "limite" | "pago";
  nombre: string;
  monto: number | null;
  account_id: string | null;
  payment_id: string | null;
}

function mesesEntre(desde: string, hasta: string): { y: number; m: number }[] {
  const out: { y: number; m: number }[] = [];
  let cur = desde.slice(0, 7) + "-01";
  while (cur <= hasta) {
    const { y, m } = parseISO(cur);
    out.push({ y, m });
    cur = addMonths(cur, 1);
  }
  return out;
}

/** Todas las fechas importantes (cortes, límites de pago y pagos programados) entre dos fechas. */
export function eventosEntre(
  cuentas: Pick<Account, "id" | "nombre" | "tipo" | "dia_corte" | "dia_limite_pago" | "saldo_actual">[],
  pagos: Pick<ScheduledPayment, "id" | "nombre" | "monto" | "frecuencia" | "proximo_vencimiento" | "account_id">[],
  desde: string,
  hasta: string,
): Evento[] {
  const eventos: Evento[] = [];
  const meses = mesesEntre(desde, hasta);

  for (const c of cuentas) {
    if (c.tipo !== "credito") continue;
    for (const { y, m } of meses) {
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
    const base = parseISO(p.proximo_vencimiento);
    for (const { y, m } of meses) {
      let fecha: string | null = null;
      if (p.frecuencia === "unica") {
        if (base.y === y && base.m === m) fecha = p.proximo_vencimiento;
      } else if (p.frecuencia === "mensual") {
        fecha = toISO(y, m, Math.min(base.d, daysInMonth(y, m)));
      } else if (p.frecuencia === "anual" && base.m === m) {
        fecha = toISO(y, m, Math.min(base.d, daysInMonth(y, m)));
      }
      if (fecha && fecha >= p.proximo_vencimiento) {
        eventos.push({ fecha, tipo: "pago", nombre: p.nombre, monto: Number(p.monto), account_id: p.account_id, payment_id: p.id });
      }
    }
  }

  return eventos.filter((e) => e.fecha >= desde && e.fecha <= hasta).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Si un pago recurrente ya pasó, calcula su siguiente vencimiento. */
export function siguienteVencimiento(p: Pick<ScheduledPayment, "frecuencia" | "proximo_vencimiento">, hoy: string): string | null {
  if (p.proximo_vencimiento >= hoy) return null;
  if (p.frecuencia === "unica") return null;
  const paso = p.frecuencia === "mensual" ? 1 : 12;
  let f = p.proximo_vencimiento;
  let i = 0;
  while (f < hoy && i < 600) {
    i++;
    f = addMonths(p.proximo_vencimiento, paso * i);
  }
  return f;
}
