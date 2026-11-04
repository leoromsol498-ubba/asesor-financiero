import { merchantKey, normalize } from "./text";

/** Palabras "limpias" de un texto (sin acentos, signos ni mayúsculas). */
export function tokens(s: string): Set<string> {
  return new Set(
    normalize(s)
      .replace(/[^a-z0-9ñ ]/g, " ")
      .split(" ")
      .filter(Boolean),
  );
}

/** Patrón que se guarda como regla al corregir una categoría. */
export function patronDesde(descripcion: string, comercio: string | null): string {
  return merchantKey(comercio || "") || merchantKey(descripcion) || normalize(descripcion).slice(0, 40);
}

/** Una regla coincide si todas las palabras del patrón aparecen en el movimiento. */
export function reglaCoincide(patron: string, descripcion: string, comercio: string | null): boolean {
  const t = tokens(`${descripcion} ${comercio ?? ""}`);
  const p = [...tokens(patron)];
  return p.length > 0 && p.every((w) => t.has(w));
}

/** Elige la regla más específica (más palabras) que coincida. */
export function buscarRegla<R extends { patron_texto: string }>(
  reglas: R[],
  descripcion: string,
  comercio: string | null,
): R | null {
  let mejor: R | null = null;
  let mejorLen = 0;
  for (const r of reglas) {
    if (reglaCoincide(r.patron_texto, descripcion, comercio)) {
      const len = tokens(r.patron_texto).size;
      if (len > mejorLen) {
        mejor = r;
        mejorLen = len;
      }
    }
  }
  return mejor;
}
