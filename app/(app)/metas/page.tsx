import { ActionForm, ConfirmButton } from "@/components/app/action-form";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { addMonths, todayISO } from "@/lib/dates";
import { fechaCorta, money, pct } from "@/lib/format";
import { analizarMeta } from "@/lib/goals";
import { usarIA } from "@/lib/settings";
import { requireUser } from "@/lib/supabase/server";
import type { SavingsGoal } from "@/lib/types";
import { borrarMeta, crearMeta, registrarAporte } from "./actions";
import { SuggestButton } from "./suggest-button";

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold tabular">{value}</p>
    </div>
  );
}

export default async function MetasPage() {
  const { supabase } = await requireUser();
  const hoy = todayISO();
  const [{ data: metas }, { data: aportes }, ia] = await Promise.all([
    supabase.from("savings_goals").select("*").order("fecha_objetivo"),
    supabase.from("goal_contributions").select("goal_id, fecha, monto").order("fecha"),
    usarIA(supabase),
  ]);

  return (
    <>
      <PageHeader titulo="Metas de ahorro" descripcion="Cuánto te falta, cuánto apartar y si vas a tiempo." />
      <div className="grid gap-4 lg:grid-cols-2">
        {((metas ?? []) as SavingsGoal[]).map((m) => {
          const a = analizarMeta(m, (aportes ?? []).filter((x) => x.goal_id === m.id).map((x) => ({ ...x, monto: Number(x.monto) })), hoy);
          let estado: string;
          if (a.completada) estado = "¡Meta cumplida!";
          else if (a.aTiempo === null) estado = "Sin aportaciones en los últimos 3 meses";
          else if (a.aTiempo) estado = `Al ritmo actual llegas a tiempo (${a.fechaEstimada ? fechaCorta(a.fechaEstimada) : ""})`;
          else estado = `Al ritmo actual llegas con ${a.mesesRetraso} ${a.mesesRetraso === 1 ? "mes" : "meses"} de retraso`;

          return (
            <Card key={m.id}>
              <CardHeader className="flex-row items-start justify-between">
                <div>
                  <CardTitle>{m.nombre}</CardTitle>
                  <p className="text-sm text-muted-foreground">Para el {fechaCorta(m.fecha_objetivo)}</p>
                </div>
                <Badge className={a.aTiempo === false || a.vencida ? "border-neutral-900 bg-neutral-900 text-white" : ""}>
                  {a.vencida ? "Vencida" : pct(a.avancePct)}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Progress value={a.avancePct} />
                <div className="grid grid-cols-3 gap-3">
                  <Dato label="Ahorrado" value={money(a.actual)} />
                  <Dato label="Objetivo" value={money(a.objetivo)} />
                  <Dato label="Falta" value={money(a.falta)} />
                  <Dato label="Por mes" value={money(a.porMes)} />
                  <Dato label="Por quincena" value={money(a.porQuincena)} />
                  <Dato label="Tu ritmo al mes" value={money(a.ritmoMensual)} />
                </div>
                <p className="rounded-lg border border-border p-2 text-sm">{estado}</p>
                {!a.completada && ia && <SuggestButton goalId={m.id} />}
                <details>
                  <summary className="cursor-pointer text-sm text-neutral-600">Registrar aportación</summary>
                  <ActionForm action={registrarAporte.bind(null, m.id)} submit="Registrar" resetOnSuccess className="mt-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Input name="monto" inputMode="decimal" placeholder="Monto (− si retiraste)" required />
                      <Input name="fecha" type="date" defaultValue={hoy} required />
                    </div>
                  </ActionForm>
                </details>
                <ConfirmButton action={borrarMeta.bind(null, m.id)} confirmText={`¿Borrar la meta "${m.nombre}"?`} className="self-start text-neutral-500">
                  Borrar meta
                </ConfirmButton>
              </CardContent>
            </Card>
          );
        })}

        <Card className="self-start">
          <CardHeader><CardTitle>Nueva meta</CardTitle></CardHeader>
          <CardContent>
            <ActionForm action={crearMeta} submit="Crear meta" resetOnSuccess>
              <Field label="Nombre"><Input name="nombre" placeholder="Ej. Fondo de emergencia" required /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Objetivo"><Input name="monto_objetivo" inputMode="decimal" placeholder="50,000" required /></Field>
                <Field label="Fecha objetivo"><Input name="fecha_objetivo" type="date" defaultValue={addMonths(hoy, 12)} required /></Field>
              </div>
              <Field label="Ya tengo ahorrado (opcional)"><Input name="monto_inicial" inputMode="decimal" placeholder="0" /></Field>
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
