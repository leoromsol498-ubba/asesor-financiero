import { daysInMonth, parseISO } from "./dates";

export type EstadoPresupuesto = "excedido" | "en_riesgo" | "en_orden" | "sin_presupuesto";

export interface MovimientoMin {
  id: string;
  fecha: string;
  descripcion_original: string;
  comercio: string | null;
  monto: number;
  category_id: string | null;
  es_recurrente?: boolean;
}

export interface CategoriaMin {
  id: string;
  nombre: string;
  presupuesto_mensual: number;
}

export interface ResumenCategoria {
  categoria: CategoriaMin;
  gastado: number;
  presupuesto: number;
  diferencia: number; // presupuesto − gastado (negativo = excedido)
  pctGastado: number; // gastado / presupuesto × 100
  pctMes: number; // % del mes transcurrido
  ritmo: number; // pctGastado − pctMes (puntos)
  proyeccion: number; // gasto estimado al cierre del mes (fijos + variable al ritmo actual)
  estado: EstadoPresupuesto;
  top: MovimientoMin[];
}

/** Puntos por encima del ritmo del mes a partir de los cuales se marca "en riesgo". */
export const UMBRAL_RIESGO = 20;

export function pctMesTranscurrido(today: string): number {
  const { y, m, d } = parseISO(today);
  return (d / daysInMonth(y, m)) * 100;
}

export function resumenPresupuesto(
  categorias: CategoriaMin[],
  gastosDelMes: MovimientoMin[],
  today: string,
): ResumenCategoria[] {
  const { y, m, d } = parseISO(today);
  const diasMes = daysInMonth(y, m);
  const pctMes = (d / diasMes) * 100;

  const porCategoria = new Map<string, MovimientoMin[]>();
  for (const t of gastosDelMes) {
    if (!t.category_id) continue;
    const arr = porCategoria.get(t.category_id) ?? [];
    arr.push(t);
    porCategoria.set(t.category_id, arr);
  }

  const out: ResumenCategoria[] = [];
  for (const c of categorias) {
    const movs = porCategoria.get(c.id) ?? [];
    const presupuesto = Number(c.presupuesto_mensual) || 0;
    const gastado = round2(movs.reduce((s, t) => s + Number(t.monto), 0));
    if (presupuesto <= 0 && gastado <= 0) continue; // categorías sin uso (ej. Ingresos)

    const pctGastado = presupuesto > 0 ? (gastado / presupuesto) * 100 : gastado > 0 ? Infinity : 0;
    const ritmo = pctGastado - pctMes;
    // Los cargos recurrentes (Netflix, renta…) se cuentan una sola vez; solo el gasto variable se proyecta al ritmo actual.
    const fijo = movs.filter((t) => t.es_recurrente).reduce((s, t) => s + Number(t.monto), 0);
    const variable = gastado - fijo;
    const proyeccion = round2(fijo + (d > 0 ? (variable / d) * diasMes : variable));

    let estado: EstadoPresupuesto;
    if (presupuesto <= 0) estado = "sin_presupuesto";
    else if (gastado > presupuesto) estado = "excedido";
    else if (ritmo > UMBRAL_RIESGO) estado = "en_riesgo";
    else estado = "en_orden";

    out.push({
      categoria: c,
      gastado,
      presupuesto,
      diferencia: round2(presupuesto - gastado),
      pctGastado,
      pctMes,
      ritmo,
      proyeccion,
      estado,
      top: [...movs].sort((a, b) => Number(b.monto) - Number(a.monto)).slice(0, 3),
    });
  }

  // De mayor a menor exceso (gastado − presupuesto)
  return out.sort((a, b) => b.gastado - b.presupuesto - (a.gastado - a.presupuesto));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
