import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { anthropicModel, APP_CURRENCY } from "./config";

// ---------------------------------------------------------------------
// Instrucciones base que acompañan a TODAS las llamadas a la IA.
// ---------------------------------------------------------------------
const SYSTEM_BASE = `Eres el asistente de una app personal de finanzas llamada "Asesor Financiero". Respondes en español de México y la moneda es ${APP_CURRENCY}.

Reglas obligatorias:
- No des recomendaciones de inversión ni sugieras comprar, vender o mantener acciones, fondos, criptomonedas, bonos u otros instrumentos financieros. Si algo lo requiere, limítate a presupuesto, gasto y ahorro.
- Nunca repitas números completos de tarjeta, cuenta, CLABE, contraseñas, NIP o claves bancarias. Si aparecen, usa solo los últimos 4 dígitos (ej. ****1234).
- Si un dato no está claro, no lo inventes: usa null o una confianza baja.`;

export class AIError extends Error {}

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AIError("Falta configurar la variable ANTHROPIC_API_KEY; los movimientos quedan para revisión.");
  }
  _client ??= new Anthropic();
  return _client;
}


/** Llama al modelo pidiendo una salida JSON que cumpla el esquema `schema`. */
async function pedirJSON<T extends z.ZodType>(opts: {
  schema: T;
  system: string;
  content: Anthropic.ContentBlockParam[] | string;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}): Promise<z.infer<T>> {
  try {
    const response = await client().messages.parse({
      model: anthropicModel(),
      max_tokens: opts.maxTokens ?? 16000,
      system: `${SYSTEM_BASE}\n\n${opts.system}`,
      messages: [{ role: "user", content: opts.content }],
      output_config: {
        format: zodOutputFormat(opts.schema),
        ...(opts.effort ? { effort: opts.effort } : {}),
      },
    });

    if (response.stop_reason === "refusal") {
      throw new AIError("La IA no pudo procesar esta solicitud. Intenta con otro archivo o texto.");
    }
    if (response.stop_reason === "max_tokens") {
      throw new AIError("El documento es demasiado largo para procesarlo de una vez. Intenta dividirlo.");
    }
    if (!response.parsed_output) {
      throw new AIError("La IA respondió en un formato inesperado. Intenta de nuevo.");
    }
    return response.parsed_output as z.infer<T>;
  } catch (e) {
    if (e instanceof AIError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new AIError("La llave ANTHROPIC_API_KEY no es válida.");
    if (e instanceof Anthropic.RateLimitError) throw new AIError("Límite de uso de la IA alcanzado. Espera un minuto.");
    if (e instanceof Anthropic.NotFoundError) throw new AIError(`El modelo "${anthropicModel()}" no existe. Revisa ANTHROPIC_MODEL.`);
    if (e instanceof Anthropic.BadRequestError) throw new AIError(`Solicitud rechazada por la IA: ${e.message}`);
    if (e instanceof Anthropic.APIError) throw new AIError(`Error de la IA (${e.status}). Intenta más tarde.`);
    throw e;
  }
}

// ---------------------------------------------------------------------
// 1. Estado de cuenta en PDF → movimientos
// ---------------------------------------------------------------------
const MovimientoPDF = z.object({
  fecha: z.string().describe("Fecha en formato YYYY-MM-DD"),
  descripcion: z.string().describe("Descripción tal como aparece, con números de tarjeta enmascarados"),
  comercio: z.string().nullable().describe("Nombre corto y limpio del comercio, ej. 'Walmart'"),
  monto: z.number().describe("Monto positivo, sin signo"),
  tipo: z.enum(["gasto", "ingreso"]),
});

const EstadoCuentaSchema = z.object({
  banco: z.string().nullable(),
  ultimos_4: z.string().nullable().describe("Solo los últimos 4 dígitos de la tarjeta o cuenta"),
  periodo: z.string().nullable(),
  movimientos: z.array(MovimientoPDF),
});
export type EstadoCuentaExtraido = z.infer<typeof EstadoCuentaSchema>;

export async function extraerEstadoDeCuenta(pdfBase64: string, hoy: string): Promise<EstadoCuentaExtraido> {
  return pedirJSON({
    schema: EstadoCuentaSchema,
    system: `Extrae todos los movimientos de un estado de cuenta bancario. Hoy es ${hoy}.
- Incluye cada cargo, compra, retiro, comisión, pago y depósito del periodo. Omite saldos, totales, resúmenes, promociones y textos legales.
- "gasto" = dinero que sale (compras, cargos, comisiones, retiros). "ingreso" = dinero que entra (depósitos, abonos, devoluciones). En tarjetas de crédito, el pago a la tarjeta es "ingreso" para esa tarjeta.
- Si la fecha no trae año, deduce el año por el periodo del estado de cuenta.
- Enmascara cualquier número de tarjeta o cuenta dejando solo los últimos 4 dígitos.`,
    content: [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
      { type: "text", text: "Extrae los movimientos de este estado de cuenta." },
    ],
    maxTokens: 32000,
  });
}

// ---------------------------------------------------------------------
// 2. Captura rápida: "350 súper con débito"
// ---------------------------------------------------------------------
const CapturaSchema = z.object({
  monto: z.number().nullable(),
  tipo: z.enum(["gasto", "ingreso"]),
  descripcion: z.string(),
  comercio: z.string().nullable(),
  fecha: z.string().describe("YYYY-MM-DD"),
  cuenta: z.string().nullable().describe("Nombre exacto de una de las cuentas listadas, o null"),
  categoria: z.string().nullable().describe("Nombre exacto de una de las categorías listadas, o null"),
  confianza: z.number().describe("0 a 1: qué tan seguro estás de la categoría"),
});
export type CapturaInterpretada = z.infer<typeof CapturaSchema>;

export async function interpretarCaptura(
  texto: string,
  hoy: string,
  cuentas: { nombre: string; tipo: string }[],
  categorias: string[],
): Promise<CapturaInterpretada> {
  return pedirJSON({
    schema: CapturaSchema,
    effort: "low",
    maxTokens: 2000,
    system: `Interpreta un movimiento escrito en una línea por el usuario. Hoy es ${hoy}.
Cuentas disponibles: ${cuentas.map((c) => `"${c.nombre}" (${c.tipo})`).join(", ") || "ninguna"}.
Categorías disponibles: ${categorias.map((c) => `"${c}"`).join(", ") || "ninguna"}.
- "con débito", "con tarjeta", "en efectivo" indican la cuenta: elige la que mejor coincida por nombre o tipo.
- "ayer", "el lunes", etc. son relativos a hoy. Sin fecha = hoy.
- Si no se menciona ingreso, cobro o depósito, es un gasto.
- La descripción debe ser breve y clara, ej. "Supermercado".`,
    content: texto,
  });
}

// ---------------------------------------------------------------------
// 3. Categorización en lote
// ---------------------------------------------------------------------
const CategorizacionSchema = z.object({
  resultados: z.array(
    z.object({
      id: z.string(),
      categoria: z.string().nullable().describe("Nombre exacto de una categoría de la lista, o null"),
      comercio: z.string().nullable().describe("Nombre corto y limpio del comercio"),
      confianza: z.number().describe("0 a 1"),
    }),
  ),
});

export async function categorizarLote(
  movimientos: { id: string; descripcion: string; monto: number; tipo: string }[],
  categorias: string[],
): Promise<z.infer<typeof CategorizacionSchema>["resultados"]> {
  if (movimientos.length === 0 || categorias.length === 0) return [];
  const out: z.infer<typeof CategorizacionSchema>["resultados"] = [];
  // Lotes de 80 para mantener respuestas rápidas
  for (let i = 0; i < movimientos.length; i += 80) {
    const lote = movimientos.slice(i, i + 80);
    const r = await pedirJSON({
      schema: CategorizacionSchema,
      effort: "low",
      system: `Asigna a cada movimiento bancario la categoría más adecuada de esta lista exacta:
${categorias.map((c) => `- ${c}`).join("\n")}
- Usa confianza >= 0.85 solo si el comercio es inequívoco (ej. "WALMART" → Supermercado).
- Usa confianza < 0.7 si la descripción es ambigua (transferencias, Mercado Pago, Amazon, PayPal, OXXO, etc.).
- Si ninguna categoría aplica, usa null con confianza 0.
- Devuelve un resultado por cada id recibido.`,
      content: JSON.stringify(lote),
    });
    out.push(...r.resultados);
  }
  return out;
}

// ---------------------------------------------------------------------
// 4. "¿De dónde saco la diferencia?"
// ---------------------------------------------------------------------
const PropuestaSchema = z.object({
  resumen: z.string().describe("2 o 3 frases claras"),
  recortes: z.array(
    z.object({
      categoria: z.string(),
      monto_mensual: z.number().describe("Cuánto recortar al mes en esta categoría"),
      como: z.string().describe("Acción concreta y realista"),
    }),
  ),
  total_mensual: z.number(),
  alcanza: z.boolean().describe("true si los recortes cubren lo que falta ahorrar por mes"),
});
export type PropuestaAhorro = z.infer<typeof PropuestaSchema>;

export async function proponerAhorro(contexto: unknown): Promise<PropuestaAhorro> {
  return pedirJSON({
    schema: PropuestaSchema,
    effort: "medium",
    maxTokens: 4000,
    system: `Ayuda al usuario a encontrar de dónde sacar el dinero que le falta para su meta de ahorro.
- Básate SOLO en sus categorías de gasto, empezando por las más excedidas o con mayor gasto variable.
- Da montos mensuales concretos por categoría y acciones específicas (ej. "cocinar en casa 2 noches más por semana").
- No propongas recortar más del 40% de una categoría ni tocar gastos esenciales como renta o salud por debajo de lo razonable.
- Recuerda: nada de recomendaciones de inversión.`,
    content: JSON.stringify(contexto),
  });
}

// ---------------------------------------------------------------------
// 5. Acción recomendada para el reporte semanal
// ---------------------------------------------------------------------
const AccionSchema = z.object({ accion: z.string().describe("Una sola acción concreta para esta semana, máximo 2 frases") });

export async function accionSemanal(contexto: unknown): Promise<string> {
  const r = await pedirJSON({
    schema: AccionSchema,
    effort: "low",
    maxTokens: 1500,
    system: `Con base en el resumen financiero, sugiere UNA acción concreta y alcanzable para la próxima semana (presupuesto, gasto o ahorro). Sé específico con montos.`,
    content: JSON.stringify(contexto),
  });
  return r.accion;
}
