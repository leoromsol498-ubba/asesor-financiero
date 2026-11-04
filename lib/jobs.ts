import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { accionSemanal } from "./ai";
import { eventosEntre, siguienteVencimiento, type Evento } from "./calendar";
import { cargarPresupuesto } from "./data";
import { addDays, diffDays } from "./dates";
import { enviarCorreo, esc, plantilla, ROJO, tabla } from "./email";
import { fechaCorta, money, pct } from "./format";
import { analizarMeta } from "./goals";
import type { Account, ScheduledPayment } from "./types";

// Estas funciones reciben siempre el user_id y filtran por él, porque los
// crons usan el cliente administrador (que no tiene RLS).

async function cargarCuentasYPagos(db: SupabaseClient, userId: string, hoy: string) {
  const [{ data: cuentas }, { data: pagos }] = await Promise.all([
    db.from("accounts").select("*").eq("user_id", userId),
    db.from("scheduled_payments").select("*").eq("user_id", userId),
  ]);
  const pays = (pagos ?? []) as ScheduledPayment[];

  // Recorre al siguiente vencimiento los pagos recurrentes que ya pasaron
  for (const p of pays) {
    const sig = siguienteVencimiento(p, hoy);
    if (sig) {
      await db.from("scheduled_payments").update({ proximo_vencimiento: sig }).eq("id", p.id).eq("user_id", userId);
      p.proximo_vencimiento = sig;
    }
  }
  return { cuentas: (cuentas ?? []) as Account[], pagos: pays };
}

/** ¿Alcanza el saldo? Considera todos los pagos de la misma cuenta hasta esa fecha. */
function evaluarSaldo(e: Evento, todos: Evento[], cuentas: Account[]): { texto: string; alcanza: boolean | null } {
  if (e.tipo === "limite") {
    const disponible = cuentas.filter((c) => c.tipo === "debito" || c.tipo === "efectivo").reduce((s, c) => s + Number(c.saldo_actual), 0);
    if (e.monto === null) return { texto: "Sin deuda registrada en la tarjeta", alcanza: null };
    const alcanza = disponible >= e.monto;
    return { texto: `${alcanza ? "Alcanza" : "No alcanza"}: tienes ${money(disponible)} en débito/efectivo`, alcanza };
  }
  const cuenta = cuentas.find((c) => c.id === e.account_id);
  if (!cuenta) return { texto: "Sin cuenta asociada", alcanza: null };
  if (cuenta.tipo === "credito") return { texto: `Se carga a ${cuenta.nombre} (crédito)`, alcanza: null };
  const comprometido = todos
    .filter((x) => x.tipo === "pago" && x.account_id === cuenta.id && x.fecha <= e.fecha && x.monto)
    .reduce((s, x) => s + (x.monto ?? 0), 0);
  const saldo = Number(cuenta.saldo_actual);
  const alcanza = saldo >= comprometido;
  return {
    texto: `${alcanza ? "Alcanza" : "No alcanza"}: ${cuenta.nombre} tiene ${money(saldo)}${comprometido > (e.monto ?? 0) ? ` y debe cubrir ${money(comprometido)} en pagos próximos` : ""}`,
    alcanza,
  };
}

export async function revisarPagos(db: SupabaseClient, userId: string, hoy: string, opciones: { forzar?: boolean } = {}) {
  const { cuentas, pagos } = await cargarCuentasYPagos(db, userId, hoy);
  const eventos = eventosEntre(cuentas, pagos, hoy, addDays(hoy, 7)).filter((e) => e.tipo !== "corte");

  const alertas: { e: Evento; dias: number; clave: string }[] = [];
  for (const e of eventos) {
    const dias = diffDays(hoy, e.fecha);
    // Ventanas: 7 días (3 a 7) y 2 días (0 a 2). Si un día no corre el cron, no se pierde la alerta.
    const ventana = dias >= 3 && dias <= 7 ? "7d" : dias >= 0 && dias <= 2 ? "2d" : null;
    if (!ventana) continue;
    alertas.push({ e, dias, clave: `${e.tipo}:${e.payment_id ?? e.account_id}:${e.fecha}:${ventana}` });
  }

  let pendientes = alertas;
  if (!opciones.forzar && alertas.length > 0) {
    const { data: enviados } = await db.from("alert_log").select("clave").eq("user_id", userId).in("clave", alertas.map((a) => a.clave));
    const ya = new Set((enviados ?? []).map((r) => r.clave));
    pendientes = alertas.filter((a) => !ya.has(a.clave));
  }
  if (pendientes.length === 0) return { enviados: 0, revisados: eventos.length };

  const filas = pendientes.map(({ e, dias }) => {
    const s = evaluarSaldo(e, eventos, cuentas);
    const cuando = dias === 0 ? "<strong>hoy</strong>" : dias === 1 ? "mañana" : `en ${dias} días`;
    return [
      `<strong>${esc(e.nombre)}</strong><br><span style="color:#737373;font-size:12px">${fechaCorta(e.fecha)} · ${cuando}</span><br><span style="font-size:12px;${s.alcanza === false ? `color:${ROJO}` : "color:#404040"}">${esc(s.texto)}</span>`,
      e.monto !== null ? `<strong>${money(e.monto)}</strong>` : "—",
    ];
  });

  const urgente = pendientes.some((a) => a.dias <= 2);
  const asunto = urgente
    ? `⏰ Pago próximo: ${pendientes[0].e.nombre} ${pendientes[0].dias === 0 ? "vence hoy" : `en ${pendientes[0].dias} días`}`
    : `Pagos de la próxima semana (${pendientes.length})`;

  await enviarCorreo(asunto, plantilla(urgente ? "Tienes pagos muy pronto" : "Pagos de la próxima semana", tabla(filas)));

  if (!opciones.forzar) {
    await db.from("alert_log").upsert(
      pendientes.map((a) => ({ user_id: userId, clave: a.clave })),
      { onConflict: "user_id,clave", ignoreDuplicates: true },
    );
  }
  return { enviados: pendientes.length, revisados: eventos.length };
}

export async function reporteSemanal(db: SupabaseClient, userId: string, hoy: string) {
  const p = await cargarPresupuesto(db, hoy, userId);
  const { cuentas, pagos } = await cargarCuentasYPagos(db, userId, hoy);
  const [{ data: metas }, { data: aportes }] = await Promise.all([
    db.from("savings_goals").select("*").eq("user_id", userId),
    db.from("goal_contributions").select("goal_id, fecha, monto").eq("user_id", userId),
  ]);
  const proximos = eventosEntre(cuentas, pagos, hoy, addDays(hoy, 14)).filter((e) => e.tipo !== "corte");
  const metasA = (metas ?? []).map((m) => ({
    m,
    a: analizarMeta(m, (aportes ?? []).filter((x) => x.goal_id === m.id).map((x) => ({ ...x, monto: Number(x.monto) })), hoy),
  }));

  // Acción recomendada (IA). Si falla, usamos una regla sencilla.
  let accion: string;
  try {
    accion = await accionSemanal({
      hoy,
      gastado_mes: p.gastadoMes,
      presupuesto_mes: p.presupuestoTotal,
      categorias: p.resumen.slice(0, 8).map((r) => ({ categoria: r.categoria.nombre, gastado: r.gastado, presupuesto: r.presupuesto, proyeccion: r.proyeccion, estado: r.estado })),
      metas: metasA.map(({ m, a }) => ({ nombre: m.nombre, falta: a.falta, por_mes: a.porMes, ritmo_mensual: a.ritmoMensual, meses_retraso: a.mesesRetraso })),
      pagos_14_dias: proximos.map((e) => ({ nombre: e.nombre, fecha: e.fecha, monto: e.monto })),
    });
  } catch {
    const peor = p.resumen.find((r) => r.estado === "excedido" || r.estado === "en_riesgo");
    accion = peor
      ? `Esta semana pon pausa a ${peor.categoria.nombre}: llevas ${money(peor.gastado)} de ${money(peor.presupuesto)}.`
      : "Vas bien. Aparta hoy lo que corresponde a tus metas de ahorro.";
  }

  const presupuestoHTML = tabla(
    p.resumen.slice(0, 8).map((r) => {
      const color = r.estado === "excedido" ? `color:${ROJO};font-weight:600` : "";
      const etiqueta = { excedido: "Excedido", en_riesgo: "En riesgo", en_orden: "En orden", sin_presupuesto: "Sin presupuesto" }[r.estado];
      return [
        `${esc(r.categoria.nombre)}<br><span style="font-size:12px;${color || "color:#737373"}">${etiqueta}${r.presupuesto > 0 ? ` · ${pct(r.pctGastado)}` : ""}</span>`,
        `<span style="${color}">${money(r.gastado)}</span><br><span style="font-size:12px;color:#737373">de ${money(r.presupuesto)}</span>`,
      ];
    }),
  );

  const metasHTML = metasA.length
    ? tabla(
        metasA.map(({ m, a }) => [
          `${esc(m.nombre)}<br><span style="font-size:12px;color:#737373">${a.completada ? "Cumplida" : a.aTiempo === null ? "Sin aportaciones recientes" : a.aTiempo ? "Vas a tiempo" : `${a.mesesRetraso} meses de retraso`} · aparta ${money(a.porMes)}/mes</span>`,
          `${pct(a.avancePct)}<br><span style="font-size:12px;color:#737373">faltan ${money(a.falta)}</span>`,
        ]),
      )
    : `<p style="color:#737373;font-size:14px">Sin metas registradas.</p>`;

  const pagosHTML = proximos.length
    ? tabla(proximos.map((e) => [`${fechaCorta(e.fecha)} · ${esc(e.nombre)}`, e.monto !== null ? money(e.monto) : "—"]))
    : `<p style="color:#737373;font-size:14px">Sin pagos en los próximos 14 días.</p>`;

  const cuerpo = `
    <p style="font-size:14px;margin:0 0 16px">Llevas <strong>${money(p.gastadoMes)}</strong> de <strong>${money(p.presupuestoTotal)}</strong> este mes.</p>
    <div style="background:#0a0a0a;color:#fff;border-radius:8px;padding:12px 14px;margin:0 0 20px;font-size:14px"><strong>Acción de la semana:</strong> ${esc(accion)}</div>
    <h2 style="font-size:15px;margin:20px 0 4px">Presupuesto</h2>${presupuestoHTML}
    <h2 style="font-size:15px;margin:20px 0 4px">Metas de ahorro</h2>${metasHTML}
    <h2 style="font-size:15px;margin:20px 0 4px">Pagos de los próximos 14 días</h2>${pagosHTML}`;

  await enviarCorreo(`Tu resumen semanal · ${fechaCorta(hoy)}`, plantilla("Resumen semanal", cuerpo));
  return { ok: true };
}
