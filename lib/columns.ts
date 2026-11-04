// Detección automática de columnas y lectura de fechas/montos en CSV o Excel.
// Este archivo se usa en el navegador.

export type Celda = string | number | boolean | Date | null | undefined;

export interface Mapeo {
  filaEncabezado: number; // índice de la fila con los títulos (-1 = sin títulos)
  fecha: number;
  descripcion: number;
  monto: number; // -1 si se usan cargo/abono separados
  cargo: number; // columna de retiros/cargos (-1 si no aplica)
  abono: number; // columna de depósitos/abonos (-1 si no aplica)
  /** Cómo vienen los gastos cuando hay una sola columna de monto */
  signoGastos: "negativo" | "positivo";
  /** Orden de día y mes en fechas tipo 03/04/2026 */
  formatoFecha: "dmy" | "mdy";
}

const PALABRAS = {
  fecha: ["fecha", "date", "dia", "f. operacion", "fecha operacion", "fecha de operacion"],
  descripcion: ["descripcion", "concepto", "detalle", "description", "movimiento", "referencia", "comercio", "establecimiento"],
  monto: ["monto", "importe", "amount", "cantidad", "valor", "total"],
  cargo: ["cargo", "cargos", "retiro", "retiros", "debito", "debe", "egreso", "salida"],
  abono: ["abono", "abonos", "deposito", "depositos", "credito", "haber", "ingreso", "entrada"],
};

function norm(s: Celda): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function coincide(celda: Celda, palabras: string[]): boolean {
  const n = norm(celda);
  return n.length > 0 && palabras.some((p) => n === p || n.includes(p));
}

export function detectarMapeo(filas: Celda[][]): Mapeo {
  const mapeo: Mapeo = {
    filaEncabezado: -1, fecha: -1, descripcion: -1, monto: -1, cargo: -1, abono: -1,
    signoGastos: "negativo", formatoFecha: "dmy",
  };

  // 1) Buscar la fila de encabezados en las primeras 15 filas
  for (let i = 0; i < Math.min(filas.length, 15); i++) {
    const fila = filas[i] ?? [];
    const iFecha = fila.findIndex((c) => coincide(c, PALABRAS.fecha));
    const iDesc = fila.findIndex((c) => coincide(c, PALABRAS.descripcion));
    if (iFecha >= 0 && iDesc >= 0) {
      mapeo.filaEncabezado = i;
      mapeo.fecha = iFecha;
      mapeo.descripcion = iDesc;
      mapeo.cargo = fila.findIndex((c) => coincide(c, PALABRAS.cargo));
      mapeo.abono = fila.findIndex((c) => coincide(c, PALABRAS.abono));
      mapeo.monto = fila.findIndex((c) => coincide(c, PALABRAS.monto));
      if (mapeo.cargo >= 0 && mapeo.abono >= 0) mapeo.monto = -1;
      break;
    }
  }

  // 2) Si no hubo encabezados, adivinar por contenido
  const datos = filas.slice(mapeo.filaEncabezado + 1, mapeo.filaEncabezado + 30);
  const ncols = Math.max(0, ...datos.map((f) => f.length));
  const puntaje = (fn: (c: Celda) => boolean) =>
    Array.from({ length: ncols }, (_, j) => datos.filter((f) => fn(f[j])).length);

  if (mapeo.fecha < 0) mapeo.fecha = argmax(puntaje((c) => parseFecha(c, "dmy") !== null));
  if (mapeo.descripcion < 0) {
    const p = puntaje((c) => typeof c === "string" && parseMonto(c) === null && parseFecha(c, "dmy") === null && c.trim().length > 2);
    p[mapeo.fecha] = -1;
    mapeo.descripcion = argmax(p);
  }
  if (mapeo.monto < 0 && (mapeo.cargo < 0 || mapeo.abono < 0)) {
    const p = puntaje((c) => parseMonto(c) !== null && parseFecha(c, "dmy") === null);
    p[mapeo.fecha] = -1;
    p[mapeo.descripcion] = -1;
    mapeo.monto = argmax(p);
    mapeo.cargo = -1;
    mapeo.abono = -1;
  }

  // 3) ¿Los gastos vienen negativos? Si casi todo es positivo, asumimos que son gastos positivos.
  if (mapeo.monto >= 0) {
    const montos = datos.map((f) => parseMonto(f[mapeo.monto])).filter((n): n is number => n !== null);
    const negativos = montos.filter((n) => n < 0).length;
    mapeo.signoGastos = negativos > 0 ? "negativo" : "positivo";
  }

  // 4) Formato de fecha: si algún "día" es > 12 en la segunda posición, es mm/dd
  const textosFecha = datos.map((f) => f[mapeo.fecha]).filter((c): c is string => typeof c === "string");
  const esMDY = textosFecha.some((t) => {
    const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-]\d{2,4}/);
    return m ? Number(m[2]) > 12 && Number(m[1]) <= 12 : false;
  });
  mapeo.formatoFecha = esMDY ? "mdy" : "dmy";

  return mapeo;
}

function argmax(arr: number[]): number {
  let best = -1;
  let bestVal = 0;
  arr.forEach((v, i) => {
    if (v > bestVal) {
      best = i;
      bestVal = v;
    }
  });
  return best;
}

const MESES: Record<string, number> = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7,
  ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12,
};

function iso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Convierte una celda en fecha "YYYY-MM-DD" o null si no lo es. */
export function parseFecha(c: Celda, formato: "dmy" | "mdy" = "dmy"): string | null {
  if (c === null || c === undefined || c === "") return null;
  if (c instanceof Date && !isNaN(c.getTime())) {
    return iso(c.getUTCFullYear(), c.getUTCMonth() + 1, c.getUTCDate());
  }
  if (typeof c === "number") {
    // Número de serie de Excel (días desde 1899-12-30)
    if (c > 30000 && c < 80000) {
      const dt = new Date(Date.UTC(1899, 11, 30) + c * 86_400_000);
      return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    }
    return null;
  }
  const s = String(c).trim();
  let m = s.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) return formato === "mdy" ? iso(+m[3], +m[1], +m[2]) : iso(+m[3], +m[2], +m[1]);
  m = norm(s).match(/^(\d{1,2})[\s/.-]*([a-z]{3})[a-z]*\.?[\s/.-]*(\d{2,4})/);
  if (m && MESES[m[2]]) return iso(+m[3], MESES[m[2]], +m[1]);
  return null;
}

/** Convierte "$1,234.56", "-350", "(350.00)", "1.234,56" en número, o null. */
export function parseMonto(c: Celda): number | null {
  if (c === null || c === undefined || c === "") return null;
  if (typeof c === "number") return Number.isFinite(c) ? c : null;
  if (typeof c !== "string") return null;
  let s = c.trim();
  if (!/\d/.test(s)) return null;
  if (/[a-df-z]/i.test(s.replace(/mxn|usd|mn/gi, ""))) return null; // tiene letras: no es monto
  let negativo = false;
  if (/^\(.*\)$/.test(s)) {
    negativo = true;
    s = s.slice(1, -1);
  }
  if (s.includes("-")) negativo = true;
  s = s.replace(/[^\d.,]/g, "");
  // Formato europeo 1.234,56
  if (/,\d{1,2}$/.test(s) && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

export interface FilaInterpretada {
  fecha: string;
  descripcion: string;
  monto: number; // positivo
  tipo: "gasto" | "ingreso";
}

export function aplicarMapeo(filas: Celda[][], mapeo: Mapeo): { ok: FilaInterpretada[]; omitidas: number } {
  const ok: FilaInterpretada[] = [];
  let omitidas = 0;
  for (const fila of filas.slice(mapeo.filaEncabezado + 1)) {
    if (!fila || fila.every((c) => c === null || c === undefined || String(c).trim() === "")) continue;
    const fecha = parseFecha(fila[mapeo.fecha], mapeo.formatoFecha);
    const descripcion = String(fila[mapeo.descripcion] ?? "").trim();
    let monto: number | null = null;
    let tipo: "gasto" | "ingreso" = "gasto";

    if (mapeo.monto >= 0) {
      const v = parseMonto(fila[mapeo.monto]);
      if (v !== null) {
        const esGasto = mapeo.signoGastos === "negativo" ? v < 0 : v > 0;
        tipo = esGasto ? "gasto" : "ingreso";
        monto = Math.abs(v);
      }
    } else {
      const cargo = mapeo.cargo >= 0 ? parseMonto(fila[mapeo.cargo]) : null;
      const abono = mapeo.abono >= 0 ? parseMonto(fila[mapeo.abono]) : null;
      if (cargo && Math.abs(cargo) > 0) {
        monto = Math.abs(cargo);
        tipo = "gasto";
      } else if (abono && Math.abs(abono) > 0) {
        monto = Math.abs(abono);
        tipo = "ingreso";
      }
    }

    if (!fecha || !descripcion || monto === null || monto === 0) {
      omitidas++;
      continue;
    }
    ok.push({ fecha, descripcion, monto: Math.round(monto * 100) / 100, tipo });
  }
  return { ok, omitidas };
}
