// Utilidades de texto para comparar descripciones de movimientos.

/** minúsculas, sin acentos, sin espacios repetidos */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Clave del comercio: quita números, referencias y signos para que
 * "OXXO 1234 CDMX" y "OXXO 9876 GDL" se parezcan.
 */
export function merchantKey(s: string): string {
  const words = normalize(s)
    .replace(/[*#/\\|_.,:;()\[\]{}"'-]/g, " ")
    .replace(/\b\w*\d\w*\b/g, " ")
    .split(" ")
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
  return words.slice(0, 3).join(" ");
}

const STOPWORDS = new Set([
  "de", "la", "el", "los", "las", "del", "en", "y", "sa", "cv", "mx", "mex", "mexico",
  "cdmx", "com", "www", "pago", "compra", "cargo", "pos", "tdc", "tdd", "ref", "referencia",
]);

/**
 * Seguridad: enmascara números de tarjeta/cuenta (12 a 19 dígitos, con o sin
 * espacios/guiones) dejando solo los últimos 4. Ej. "4152 3134 5678 9012" → "****9012".
 */
export function maskSensitiveNumbers(s: string): string {
  return s.replace(/\b(?:\d[ -]?){11,18}\d\b/g, (match) => {
    const digits = match.replace(/\D/g, "");
    return `****${digits.slice(-4)}`;
  });
}

/** Devuelve los últimos 4 dígitos si el texto trae un número largo. */
export function lastFour(s: string | null | undefined): string | null {
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}
