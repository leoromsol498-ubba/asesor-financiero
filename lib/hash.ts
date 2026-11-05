import { createHash } from "node:crypto";
import { normalize } from "./text";

/** hash_unico = sha256(fecha | monto con 2 decimales | descripción normalizada) */
export function transactionHash(fecha: string, monto: number, descripcion: string): string {
  const base = `${fecha.slice(0, 10)}|${Math.abs(monto).toFixed(2)}|${normalize(descripcion)}`;
  return createHash("sha256").update(base).digest("hex");
}

/** Hash de la n-ésima repetición intencional (n >= 2) del mismo movimiento. */
export function transactionHashRepetido(fecha: string, monto: number, descripcion: string, n: number): string {
  return n <= 1 ? transactionHash(fecha, monto, descripcion) : transactionHash(fecha, monto, `${descripcion}#${n}`);
}

/**
 * Asigna hash_unico a un lote. Si `forzar` es true (el usuario marcó a
 * propósito un "posible duplicado"), busca la siguiente variante libre
 * (#2, #3…) para que se guarde como movimiento aparte. Si es false, deja el
 * hash normal: si ya existe, la base lo ignora.
 */
export function asignarHashes(
  items: { fecha: string; monto: number; descripcion: string; forzar: boolean }[],
  existentes: Set<string>,
): string[] {
  const usados = new Set(existentes);
  return items.map((it) => {
    let n = 1;
    let h = transactionHashRepetido(it.fecha, it.monto, it.descripcion, n);
    if (it.forzar) {
      while (usados.has(h) && n < 1000) h = transactionHashRepetido(it.fecha, it.monto, it.descripcion, ++n);
    }
    usados.add(h);
    return h;
  });
}
