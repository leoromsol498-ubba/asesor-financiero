import { merchantKey } from "./text";

export interface MovRecurrente {
  id: string;
  fecha: string;
  monto: number;
  descripcion_original: string;
  comercio: string | null;
}

/** Tolerancia de variación del monto para considerar "monto similar". */
export const TOLERANCIA_RECURRENTE = 0.15;

/**
 * Devuelve los ids de los cargos que se repiten con monto similar en al
 * menos 2 meses distintos (mismo comercio, ±15% respecto a la mediana).
 */
export function detectarRecurrentes(movs: MovRecurrente[]): Set<string> {
  const grupos = new Map<string, MovRecurrente[]>();
  for (const t of movs) {
    const key = merchantKey(t.comercio || t.descripcion_original);
    if (!key) continue;
    const arr = grupos.get(key) ?? [];
    arr.push(t);
    grupos.set(key, arr);
  }

  const ids = new Set<string>();
  for (const arr of grupos.values()) {
    if (arr.length < 2) continue;
    const meses = new Set(arr.map((t) => t.fecha.slice(0, 7)));
    if (meses.size < 2) continue;

    const montos = arr.map((t) => Number(t.monto)).sort((a, b) => a - b);
    const mediana = montos[Math.floor(montos.length / 2)];
    const similares = arr.filter(
      (t) => Math.abs(Number(t.monto) - mediana) <= mediana * TOLERANCIA_RECURRENTE,
    );
    // Debe haber como máximo ~2 cargos similares por mes (si no, es gasto frecuente, no recurrente)
    const mesesSimilares = new Set(similares.map((t) => t.fecha.slice(0, 7)));
    if (mesesSimilares.size >= 2 && similares.length <= mesesSimilares.size * 2) {
      similares.forEach((t) => ids.add(t.id));
    }
  }
  return ids;
}
