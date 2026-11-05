import Link from "next/link";
import { Repeat, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/app/action-form";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Input, Select } from "@/components/ui/input";
import { addMonths, monthEnd, monthStart, todayISO } from "@/lib/dates";
import { fechaCorta, mesLargo, money } from "@/lib/format";
import { requireUser } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { borrarMovimiento } from "../revisar/actions";
import { CategorySelect } from "./category-select";

type SP = Promise<{ mes?: string; cuenta?: string; categoria?: string; q?: string }>;

export default async function MovimientosPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : todayISO().slice(0, 7);
  const inicio = `${mes}-01`;

  let query = supabase
    .from("transactions")
    .select("id, fecha, descripcion_original, comercio, monto, tipo, category_id, es_recurrente, requiere_revision, account_id, es_demo, accounts(nombre, saldo_fecha)")
    .gte("fecha", inicio)
    .lte("fecha", monthEnd(inicio))
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (sp.cuenta) query = query.eq("account_id", sp.cuenta);
  if (sp.categoria === "ninguna") query = query.is("category_id", null);
  else if (sp.categoria) query = query.eq("category_id", sp.categoria);
  if (sp.q) query = query.or(`descripcion_original.ilike.%${sp.q.replace(/[%,()]/g, "")}%,comercio.ilike.%${sp.q.replace(/[%,()]/g, "")}%`);

  const [{ data: txs }, { data: cats }, { data: cuentas }] = await Promise.all([
    query,
    supabase.from("categories").select("id, nombre").order("nombre"),
    supabase.from("accounts").select("id, nombre").order("nombre"),
  ]);

  const lista = txs ?? [];
  const gastos = lista.filter((t) => t.tipo === "gasto").reduce((s, t) => s + Number(t.monto), 0);
  const ingresos = lista.filter((t) => t.tipo === "ingreso").reduce((s, t) => s + Number(t.monto), 0);
  const prev = addMonths(inicio, -1).slice(0, 7);
  const next = addMonths(inicio, 1).slice(0, 7);
  const qs = (m: string) => {
    const p = new URLSearchParams({ ...sp, mes: m } as Record<string, string>);
    return `/movimientos?${p}`;
  };

  return (
    <>
      <PageHeader titulo="Movimientos" descripcion={`Gastos ${money(gastos)} · Ingresos ${money(ingresos)}`}>
        <Link href="/importar" className={buttonVariants({ size: "sm" })}>Agregar</Link>
      </PageHeader>

      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href={qs(prev)} className={buttonVariants({ variant: "outline", size: "sm" })}>←</Link>
        <span className="font-medium capitalize">{mesLargo(mes)}</span>
        <Link href={qs(next)} className={cn(buttonVariants({ variant: "outline", size: "sm" }), monthStart(todayISO()) <= inicio && "pointer-events-none opacity-40")}>→</Link>
      </div>

      <form className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <input type="hidden" name="mes" value={mes} />
        <Input name="q" placeholder="Buscar…" defaultValue={sp.q} className="col-span-2 md:col-span-1" />
        <Select name="cuenta" defaultValue={sp.cuenta ?? ""}>
          <option value="">Todas las cuentas</option>
          {(cuentas ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </Select>
        <Select name="categoria" defaultValue={sp.categoria ?? ""}>
          <option value="">Todas las categorías</option>
          <option value="ninguna">Sin categoría</option>
          {(cats ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </Select>
        <button className={cn(buttonVariants({ variant: "secondary" }), "col-span-2 md:col-span-1")}>Filtrar</button>
      </form>

      <p className="mb-3 text-xs text-muted-foreground">
        Un movimiento actualiza el saldo de su cuenta solo si tiene cuenta y su fecha es igual o posterior al día en que capturaste el saldo.
        Si un saldo no cuadra con tu banco, corrígelo en <Link href="/cuentas" className="underline">Cuentas</Link>.
      </p>

      {lista.length === 0 ? (
        <Empty titulo="Sin movimientos en este periodo" href="/importar" accion="Agregar movimientos" />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {lista.map((t) => {
            const acc = t.accounts as unknown as { nombre: string; saldo_fecha: string | null } | null;
            const noAfecta = t.es_demo
              ? null
              : !t.account_id
                ? "Sin cuenta: no afecta saldo"
                : acc?.saldo_fecha && t.fecha < acc.saldo_fecha
                  ? `Anterior al saldo del ${fechaCorta(acc.saldo_fecha)}: no lo afecta`
                  : null;
            return (
              <div key={t.id} className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{t.comercio || t.descripcion_original}</p>
                    {t.es_recurrente && <Repeat className="h-3.5 w-3.5 shrink-0 text-neutral-500" aria-label="Recurrente" />}
                    {t.requiere_revision && <Badge>revisar</Badge>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {fechaCorta(t.fecha)}{acc ? ` · ${acc.nombre}` : ""} · {t.descripcion_original}
                  </p>
                  {noAfecta && <p className="mt-1 text-[11px] text-neutral-500">○ {noAfecta}</p>}
                </div>
                <div className="flex items-center justify-between gap-2 md:justify-end">
                  <CategorySelect txId={t.id} value={t.category_id} categorias={cats ?? []} />
                  <span className={cn("w-28 text-right font-semibold tabular", t.tipo === "ingreso" && "text-neutral-500")}>
                    {t.tipo === "ingreso" ? "+" : "−"}{money(t.monto)}
                  </span>
                  <ConfirmButton action={borrarMovimiento.bind(null, t.id)} confirmText="¿Borrar este movimiento?" className="h-8 w-8 px-0 text-neutral-400">
                    <Trash2 className="h-4 w-4" />
                  </ConfirmButton>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
