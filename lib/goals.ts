import { addMonths, monthsBetween } from "./dates";
import { round2 } from "./budget";

export interface AnalisisMeta {
  actual: number;
  objetivo: number;
  falta: number;
  avancePct: number;
  mesesRestantes: number;
  porMes: number;
  porQuincena: number;
  ritmoMensual: number; // promedio de aportaciones de los últimos 3 meses
  /** true = llega a tiempo; false = se atrasa; null = sin aportaciones recientes */
  aTiempo: boolean | null;
  mesesRetraso: number; // 0 si llega a tiempo
  fechaEstimada: string | null;
  completada: boolean;
  vencida: boolean;
}

export function analizarMeta(
  meta: { monto_objetivo: number; monto_actual: number; fecha_objetivo: string },
  aportaciones: { fecha: string; monto: number }[],
  today: string,
): AnalisisMeta {
  const objetivo = Number(meta.monto_objetivo);
  const actual = Number(meta.monto_actual);
  const falta = round2(Math.max(objetivo - actual, 0));
  const avancePct = objetivo > 0 ? Math.min((actual / objetivo) * 100, 100) : 0;
  const completada = falta <= 0;

  const mesesRestantes = Math.max(monthsBetween(today, meta.fecha_objetivo), 0);
  const vencida = meta.fecha_objetivo < today && !completada;
  const divisor = Math.max(mesesRestantes, 1);
  const porMes = completada ? 0 : round2(falta / divisor);
  const porQuincena = round2(porMes / 2);

  const hace3m = addMonths(today, -3);
  const ultimas = aportaciones.filter((a) => a.fecha > hace3m && a.fecha <= today);
  const ritmoMensual = round2(ultimas.reduce((s, a) => s + Number(a.monto), 0) / 3);

  let aTiempo: boolean | null = null;
  let mesesRetraso = 0;
  let fechaEstimada: string | null = null;

  if (completada) {
    aTiempo = true;
  } else if (ritmoMensual > 0) {
    const mesesNecesarios = falta / ritmoMensual;
    fechaEstimada = addMonths(today, Math.ceil(mesesNecesarios));
    mesesRetraso = Math.max(Math.ceil(mesesNecesarios - mesesRestantes), 0);
    aTiempo = mesesRetraso === 0;
  }

  return {
    actual, objetivo, falta, avancePct, mesesRestantes, porMes, porQuincena,
    ritmoMensual, aTiempo, mesesRetraso, fechaEstimada, completada, vencida,
  };
}
