import { describe, expect, it } from "vitest";
import { resumenPresupuesto } from "@/lib/budget";
import { analizarMeta } from "@/lib/goals";
import { detectarRecurrentes } from "@/lib/recurring";
import { aplicarMapeo, detectarMapeo, parseFecha, parseMonto } from "@/lib/columns";
import { maskSensitiveNumbers, merchantKey } from "@/lib/text";
import { transactionHash } from "@/lib/hash";
import { addMonths, nextDayOfMonth, todayISO } from "@/lib/dates";
import { limpiarUrlSupabase } from "@/lib/supabase/url";

const cat = (id: string, presupuesto: number) => ({ id, nombre: id, presupuesto_mensual: presupuesto });
const mov = (id: string, category_id: string, monto: number, fecha = "2026-11-05") => ({
  id, category_id, monto, fecha, descripcion_original: id, comercio: null,
});

describe("presupuesto", () => {
  it("marca excedido, en riesgo y en orden", () => {
    // 10 de noviembre → 33.3% del mes
    const r = resumenPresupuesto(
      [cat("a", 1000), cat("b", 1000), cat("c", 1000)],
      [mov("1", "a", 1200), mov("2", "b", 600), mov("3", "c", 300)],
      "2026-11-10",
    );
    const byId = Object.fromEntries(r.map((x) => [x.categoria.id, x]));
    expect(byId.a.estado).toBe("excedido");
    expect(byId.b.estado).toBe("en_riesgo"); // 60% vs 33% → +26.7 pts
    expect(byId.c.estado).toBe("en_orden");
    expect(byId.b.proyeccion).toBe(1800); // 600 / 10 × 30
    expect(r[0].categoria.id).toBe("a"); // ordenado por exceso
  });

  it("no multiplica los cargos recurrentes en la proyección", () => {
    const r = resumenPresupuesto(
      [cat("s", 1000)],
      [{ ...mov("n", "s", 300), es_recurrente: true }, mov("x", "s", 100)],
      "2026-11-10",
    );
    expect(r[0].proyeccion).toBe(600); // 300 fijo + 100/10×30
  });

  it("devuelve los 3 movimientos más grandes", () => {
    const r = resumenPresupuesto(
      [cat("a", 5000)],
      [mov("1", "a", 10), mov("2", "a", 500), mov("3", "a", 300), mov("4", "a", 900)],
      "2026-11-10",
    );
    expect(r[0].top.map((t) => t.id)).toEqual(["4", "2", "3"]);
  });
});

describe("metas", () => {
  it("calcula ahorro mensual, quincenal y retraso", () => {
    const a = analizarMeta(
      { monto_objetivo: 12000, monto_actual: 6000, fecha_objetivo: "2027-05-04" },
      [
        { fecha: "2026-09-01", monto: 500 },
        { fecha: "2026-10-01", monto: 500 },
        { fecha: "2026-11-01", monto: 500 },
      ],
      "2026-11-04",
    );
    expect(a.falta).toBe(6000);
    expect(a.porMes).toBeCloseTo(1000, -1); // ~6 meses
    expect(a.porQuincena).toBeCloseTo(a.porMes / 2, 1);
    expect(a.ritmoMensual).toBe(500);
    expect(a.aTiempo).toBe(false);
    expect(a.mesesRetraso).toBe(6); // necesita 12 meses, quedan ~6
  });
});

describe("recurrentes", () => {
  it("detecta cargos mensuales con monto similar", () => {
    const ids = detectarRecurrentes([
      { id: "1", fecha: "2026-09-03", monto: 299, descripcion_original: "NETFLIX.COM 1234", comercio: null },
      { id: "2", fecha: "2026-10-03", monto: 299, descripcion_original: "NETFLIX.COM 5678", comercio: null },
      { id: "3", fecha: "2026-10-09", monto: 85, descripcion_original: "OXXO 1", comercio: null },
      { id: "4", fecha: "2026-10-09", monto: 500, descripcion_original: "AMAZON", comercio: null },
    ]);
    expect([...ids].sort()).toEqual(["1", "2"]);
  });
});

describe("texto y seguridad", () => {
  it("enmascara números de tarjeta", () => {
    expect(maskSensitiveNumbers("Pago tarjeta 4152 3134 5678 9012 ok")).toBe("Pago tarjeta ****9012 ok");
    expect(maskSensitiveNumbers("Ref 12345")).toBe("Ref 12345");
  });
  it("normaliza comercios", () => {
    expect(merchantKey("OXXO 1234 CDMX")).toBe(merchantKey("OXXO 9876 cdmx"));
  });
  it("hash estable", () => {
    expect(transactionHash("2026-11-01", 350, "Súper  WALMART")).toBe(transactionHash("2026-11-01", -350.0, "super walmart"));
  });
});

describe("CSV", () => {
  it("lee fechas y montos mexicanos", () => {
    expect(parseFecha("03/11/2026")).toBe("2026-11-03");
    expect(parseFecha("3-nov-2026")).toBe("2026-11-03");
    expect(parseMonto("$1,234.56")).toBe(1234.56);
    expect(parseMonto("(350.00)")).toBe(-350);
    expect(parseMonto("WALMART")).toBeNull();
  });
  it("detecta columnas con cargo/abono", () => {
    const filas = [
      ["Fecha", "Concepto", "Cargo", "Abono", "Saldo"],
      ["01/11/2026", "WALMART", "350.00", "", "1000"],
      ["02/11/2026", "NOMINA", "", "15,000.00", "16000"],
    ];
    const m = detectarMapeo(filas);
    expect(m.fecha).toBe(0);
    expect(m.descripcion).toBe(1);
    expect(m.cargo).toBe(2);
    expect(m.abono).toBe(3);
    const { ok } = aplicarMapeo(filas, m);
    expect(ok).toEqual([
      { fecha: "2026-11-01", descripcion: "WALMART", monto: 350, tipo: "gasto" },
      { fecha: "2026-11-02", descripcion: "NOMINA", monto: 15000, tipo: "ingreso" },
    ]);
  });
  it("detecta columna única con negativos", () => {
    const filas = [
      ["Date", "Description", "Amount"],
      ["2026-11-01", "Uber", "-120.50"],
      ["2026-11-02", "Transfer in", "500"],
    ];
    const { ok } = aplicarMapeo(filas, detectarMapeo(filas));
    expect(ok[0]).toMatchObject({ monto: 120.5, tipo: "gasto" });
    expect(ok[1]).toMatchObject({ monto: 500, tipo: "ingreso" });
  });
});

describe("fechas", () => {
  it("zona horaria y meses", () => {
    // 2026-11-04 03:00 UTC = 2026-11-03 21:00 en CDMX
    expect(todayISO("America/Mexico_City", new Date("2026-11-04T03:00:00Z"))).toBe("2026-11-03");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(nextDayOfMonth("2026-11-20", 5)).toBe("2026-12-05");
    expect(nextDayOfMonth("2026-11-20", 25)).toBe("2026-11-25");
  });
});

describe("dirección de Supabase", () => {
  it("quita rutas y diagonales copiadas por error", () => {
    expect(limpiarUrlSupabase("https://abc.supabase.co/rest/v1/")).toBe("https://abc.supabase.co");
    expect(limpiarUrlSupabase(" https://abc.supabase.co/ ")).toBe("https://abc.supabase.co");
    expect(limpiarUrlSupabase("abc.supabase.co")).toBe("https://abc.supabase.co");
    expect(limpiarUrlSupabase("\"https://abc.supabase.co/auth/v1\"")).toBe("https://abc.supabase.co");
    expect(limpiarUrlSupabase("http://127.0.0.1:54321")).toBe("http://127.0.0.1:54321");
  });
});

import { ocurrencias, siguienteVencimiento } from "@/lib/calendar";

describe("programados", () => {
  it("quincenal el 15 y fin de mes", () => {
    expect(ocurrencias({ frecuencia: "quincenal", proximo_vencimiento: "2026-11-15" }, "2026-11-01", "2027-01-31")).toEqual([
      "2026-11-15", "2026-11-30", "2026-12-15", "2026-12-31", "2027-01-15", "2027-01-31",
    ]);
  });
  it("quincenal el 1 y el 16", () => {
    expect(ocurrencias({ frecuencia: "quincenal", proximo_vencimiento: "2026-11-16" }, "2026-11-01", "2026-12-20")).toEqual([
      "2026-11-16", "2026-12-01", "2026-12-16",
    ]);
  });
  it("semanal y catorcenal", () => {
    expect(ocurrencias({ frecuencia: "semanal", proximo_vencimiento: "2026-11-06" }, "2026-11-10", "2026-11-30")).toEqual(["2026-11-13", "2026-11-20", "2026-11-27"]);
    expect(ocurrencias({ frecuencia: "catorcenal", proximo_vencimiento: "2026-11-06" }, "2026-11-01", "2026-12-10")).toEqual(["2026-11-06", "2026-11-20", "2026-12-04"]);
  });
  it("mensual en fin de mes y anual", () => {
    expect(ocurrencias({ frecuencia: "mensual", proximo_vencimiento: "2026-01-31" }, "2026-01-01", "2026-03-31")).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(ocurrencias({ frecuencia: "anual", proximo_vencimiento: "2026-06-10" }, "2026-01-01", "2028-01-01")).toEqual(["2026-06-10", "2027-06-10"]);
  });
  it("avanza el vencimiento de un pago que ya pasó", () => {
    expect(siguienteVencimiento({ frecuencia: "quincenal", proximo_vencimiento: "2026-10-15" }, "2026-11-05")).toBe("2026-11-15");
    expect(siguienteVencimiento({ frecuencia: "unica", proximo_vencimiento: "2026-10-15" }, "2026-11-05")).toBeNull();
    expect(siguienteVencimiento({ frecuencia: "mensual", proximo_vencimiento: "2026-12-01" }, "2026-11-05")).toBeNull();
  });
});

import { asignarHashes } from "@/lib/hash";

describe("duplicados a propósito", () => {
  const cafe = { fecha: "2026-11-05", monto: 50, descripcion: "Café" };
  it("un repetido marcado recibe un hash distinto", () => {
    const existente = transactionHash(cafe.fecha, cafe.monto, cafe.descripcion);
    const [h] = asignarHashes([{ ...cafe, forzar: true }], new Set([existente]));
    expect(h).not.toBe(existente);
  });
  it("dos repetidos en el mismo lote no chocan entre sí", () => {
    const existente = transactionHash(cafe.fecha, cafe.monto, cafe.descripcion);
    const hs = asignarHashes([{ ...cafe, forzar: true }, { ...cafe, forzar: true }], new Set([existente]));
    expect(new Set([existente, ...hs]).size).toBe(3);
  });
  it("sin marcar conserva el hash normal (la base lo ignora)", () => {
    const existente = transactionHash(cafe.fecha, cafe.monto, cafe.descripcion);
    expect(asignarHashes([{ ...cafe, forzar: false }], new Set([existente]))).toEqual([existente]);
  });
});
