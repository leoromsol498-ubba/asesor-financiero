import Link from "next/link";
import { ActionForm, ConfirmButton } from "@/components/app/action-form";
import { PageHeader } from "@/components/app/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { eventosEntre } from "@/lib/calendar";
import { addMonths, daysInMonth, monthEnd, parseISO, todayISO } from "@/lib/dates";
import { fechaCorta, mesLargo, money } from "@/lib/format";
import { requireUser } from "@/lib/supabase/server";
import type { Account, ScheduledPayment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { actualizarPago, borrarPago, crearPago } from "./actions";
import { PaymentFields } from "./payment-fields";

const DIAS = ["L", "M", "M", "J", "V", "S", "D"];
const MARCA = { corte: "○", limite: "●", pago: "■" };
const FRECUENCIA = { mensual: "Mensual", anual: "Anual", unica: "Única" };

export default async function CalendarioPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams;
  const hoy = todayISO();
  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : hoy.slice(0, 7);
  const inicio = `${mes}-01`;
  const { supabase } = await requireUser();
  const [{ data: cuentas }, { data: pagos }] = await Promise.all([
    supabase.from("accounts").select("*").order("nombre"),
    supabase.from("scheduled_payments").select("*").order("proximo_vencimiento"),
  ]);
  const accs = (cuentas ?? []) as Account[];
  const pays = (pagos ?? []) as ScheduledPayment[];
  const eventos = eventosEntre(accs, pays, inicio, monthEnd(inicio));

  const { y, m } = parseISO(inicio);
  const dim = daysInMonth(y, m);
  const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // lunes = 0
  const celdas = [...Array(offset).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];

  return (
    <>
      <PageHeader titulo="Calendario de pagos" descripcion="○ corte de tarjeta · ● fecha límite de pago · ■ pago programado" />

      <div className="mb-3 flex items-center justify-between">
        <Link href={`/calendario?mes=${addMonths(inicio, -1).slice(0, 7)}`} className={buttonVariants({ variant: "outline", size: "sm" })}>←</Link>
        <span className="font-medium capitalize">{mesLargo(mes)}</span>
        <Link href={`/calendario?mes=${addMonths(inicio, 1).slice(0, 7)}`} className={buttonVariants({ variant: "outline", size: "sm" })}>→</Link>
      </div>

      <div className="mb-6 grid grid-cols-7 gap-1 text-center text-xs">
        {DIAS.map((d, i) => <div key={i} className="py-1 text-muted-foreground">{d}</div>)}
        {celdas.map((dia, i) => {
          if (!dia) return <div key={i} />;
          const fecha = `${mes}-${String(dia).padStart(2, "0")}`;
          const ev = eventos.filter((e) => e.fecha === fecha);
          return (
            <div
              key={i}
              className={cn(
                "flex min-h-14 flex-col items-center gap-0.5 rounded-lg border border-border p-1 md:min-h-20 md:items-start",
                fecha === hoy && "border-neutral-950 border-2",
                ev.length > 0 && "bg-muted",
              )}
            >
              <span className={cn("text-[11px]", fecha === hoy && "font-bold")}>{dia}</span>
              <div className="flex flex-wrap justify-center gap-0.5 md:hidden">
                {ev.map((e, j) => <span key={j}>{MARCA[e.tipo]}</span>)}
              </div>
              <div className="hidden w-full flex-col gap-0.5 md:flex">
                {ev.map((e, j) => (
                  <span key={j} className="truncate text-left text-[10px] leading-tight">{MARCA[e.tipo]} {e.nombre}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Este mes</CardTitle></CardHeader>
          <CardContent className="flex flex-col divide-y divide-border">
            {eventos.length === 0 && <p className="text-sm text-muted-foreground">Sin fechas importantes.</p>}
            {eventos.map((e, i) => (
              <div key={i} className={cn("flex justify-between gap-2 py-2 text-sm", e.fecha < hoy && "opacity-50")}>
                <span>{MARCA[e.tipo]} {fechaCorta(e.fecha)} · {e.nombre}</span>
                {e.monto !== null && <span className="tabular font-medium">{money(e.monto)}</span>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pagos programados</CardTitle>
            <CardDescription>Recibirás un correo 7 y 2 días antes. Las fechas de tarjetas se toman de “Cuentas”.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {pays.map((p) => (
              <details key={p.id} className="rounded-lg border border-border p-3">
                <summary className="flex cursor-pointer justify-between gap-2 text-sm">
                  <span>{p.nombre} · {FRECUENCIA[p.frecuencia]} · {fechaCorta(p.proximo_vencimiento)}</span>
                  <span className="tabular font-medium">{money(p.monto)}</span>
                </summary>
                <div className="mt-3 flex flex-col gap-2">
                  <ActionForm action={actualizarPago.bind(null, p.id)}>
                    <PaymentFields p={p} cuentas={accs} hoy={hoy} />
                  </ActionForm>
                  <ConfirmButton action={borrarPago.bind(null, p.id)} confirmText="¿Borrar este pago?">Borrar</ConfirmButton>
                </div>
              </details>
            ))}
            <div className="rounded-lg bg-muted p-3">
              <p className="mb-2 text-sm font-medium">Nuevo pago</p>
              <ActionForm action={crearPago} submit="Agregar pago" resetOnSuccess>
                <PaymentFields cuentas={accs} hoy={hoy} />
              </ActionForm>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
