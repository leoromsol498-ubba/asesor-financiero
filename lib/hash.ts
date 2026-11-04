import { createHash } from "node:crypto";
import { normalize } from "./text";

/** hash_unico = sha256(fecha | monto con 2 decimales | descripción normalizada) */
export function transactionHash(fecha: string, monto: number, descripcion: string): string {
  const base = `${fecha.slice(0, 10)}|${Math.abs(monto).toFixed(2)}|${normalize(descripcion)}`;
  return createHash("sha256").update(base).digest("hex");
}
