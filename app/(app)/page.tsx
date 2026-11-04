import Link from "next/link";
import { BudgetChart, TrendChart } from "@/components/app/charts";
import { PageHeader } from "@/components/app/page-header";
import { EstadoBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { pctMesTranscurrido } from "@/lib/budget";
import { cargarPresupuesto } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { fechaCorta, mesCorto, mesLargo, money, pct } from "@/lib/format";
import { requireUser } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

function Stat({ label, value, sub, rojo }: { label: string; value: string; sub?: string; rojo?: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold tabular md:text-2xl", rojo && "text-excedido")}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

export default async function DashboardPage() {
  const { supabase } = await requireUser();
  const hoy = todayISO();
  const d = await cargarPresupuesto(supabase, hoy);
  const pctMes = pctMesTranscurrido(hoy);

  if (d.categorias.length === 0) {
    return (
      <>
        <PageHeader titulo="Hola 👋" descripcion="Empecemos a configurar tu asesor financiero." />
        <Empty
          titulo="Aún no tienes datos"
          texto="Puedes cargar datos de ejemplo para conocer la app, o crear tus categorías y cuentas."
          href="/ajustes"
          accion="Ir a Ajustes"
        />
      </>
    );
  }

  const excedidas = d.resumen.filter((r) => r.estado === "excedido").length;
  const enRiesgo = d.resumen.filter((r) => r.estado === "en_riesgo").length;
  const pctGastado = d.presupuestoTotal > 0 ? (d.gastadoMes / d.presupuestoTotal) * 100 : 0;
  const conPresupuesto = d.resumen.filter((r) => r.presupuesto > 0);

  return (
    <>
      <PageHeader titulo="Presupuesto" descripcion={`${mesLargo(hoy.slice(0, 7))} · ha pasado el ${pct(pctMes)} del mes`}>
        <Link href="/importar" className={buttonVariants({ size: "sm" })}>+ Agregar gasto</Link>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Gastado este mes" value={money(d.gastadoMes)} sub={`${pct(pctGastado)} del presupuesto`} rojo={d.gastadoMes > d.presupuestoTotal && d.presupuestoTotal > 0} />
        <Stat label="Presupuesto mensual" value={money(d.presupuestoTotal)} sub={`Disponible ${money(d.presupuestoTotal - d.gastadoMes)}`} />
        <Stat label="Ingresos del mes" value={money(d.ingresosMes)} />
        <Stat label="Categorías" value={`${excedidas} excedidas`} sub={`${enRiesgo} en riesgo`} rojo={excedidas > 0} />
      </div>

      {d.sinCategoria > 0 && (
        <Link href="/revisar" className="mb-6 block rounded-xl border border-border p-3 text-sm hover:bg-muted">
          Tienes {money(d.sinCategoria)} en gastos sin categoría este mes. <span className="underline">Revisarlos →</span>
        </Link>
      )}

      <h2 className="mb-3 font-semibold">Por categoría</h2>
      <div className="mb-8 grid gap-3 md:grid-cols-2">
        {d.resumen.map((r) => (
          <Card key={r.categoria.id} className={cn(r.estado === "excedido" && "border-excedido")}>
            <CardHeader className="flex-row items-center justify-between pb-1">
              <CardTitle>{r.categoria.nombre}</CardTitle>
              <EstadoBadge estado={r.estado} />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="tabular">
                  <span className="text-lg font-semibold">{money(r.gastado)}</span>
                  <span className="text-sm text-muted-foreground"> de {money(r.presupuesto)}</span>
                </p>
                <p className={cn("text-sm tabular", r.diferencia < 0 ? "text-excedido font-medium" : "text-neutral-600")}>
                  {r.diferencia < 0 ? `Excedido ${money(-r.diferencia)}` : `Quedan ${money(r.diferencia)}`}
                  {r.presupuesto > 0 && ` · ${pct(r.pctGastado)}`}
                </p>
              </div>
              <Progress value={r.presupuesto > 0 ? r.pctGastado : 100} marca={r.pctMes} excedido={r.estado === "excedido"} />
              <div className="grid grid-cols-2 gap-2 text-xs text-neutral-600">
                <p>
                  Ritmo:{" "}
                  <strong className="text-neutral-900">
                    {Number.isFinite(r.ritmo) ? `${r.ritmo > 0 ? "+" : ""}${r.ritmo.toFixed(0)} pts` : "—"}
                  </strong>{" "}
                  vs. el mes
                </p>
                <p className="text-right">
                  Proyección al cierre:{" "}
                  <strong className={cn("tabular", r.presupuesto > 0 && r.proyeccion > r.presupuesto ? "text-excedido" : "text-neutral-900")}>
                    {money(r.proyeccion)}
                  </strong>
                </p>
              </div>
              {r.top.length > 0 && (
                <div className="border-t border-border pt-2">
                  <p className="mb-1 text-xs text-muted-foreground">Lo que más empuja el gasto</p>
                  {r.top.map((t) => (
                    <div key={t.id} className="flex justify-between gap-2 text-sm">
                      <span className="truncate">{t.comercio || t.descripcion_original} <span className="text-xs text-muted-foreground">· {fechaCorta(t.fecha)}</span></span>
                      <span className="shrink-0 tabular">{money(t.monto)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Presupuesto vs. gastado</CardTitle>
            <CardDescription>Mes actual. En rojo, las categorías excedidas.</CardDescription>
          </CardHeader>
          <CardContent>
            <BudgetChart
              data={conPresupuesto.map((r) => ({ nombre: r.categoria.nombre, presupuesto: r.presupuesto, gastado: r.gastado, excedido: r.estado === "excedido" }))}
            />
          </CardContent>
        </Card>
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Últimos 6 meses</CardTitle>
            <CardDescription>Gastos e ingresos por mes. La línea punteada es tu presupuesto mensual.</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart data={d.evolucion.map((e) => ({ ...e, mes: mesCorto(e.mes) }))} presupuesto={d.presupuestoTotal} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
