"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { money } from "@/lib/format";
import type { DraftTransaction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { guardarBorradores } from "./actions";

type Opcion = { id: string; nombre: string };

/** Vista previa editable: confirmas, corriges y guardas. */
export function PreviewEditor({
  inicial,
  importId,
  aviso,
  cuentas,
  categorias,
  onDone,
}: {
  inicial: DraftTransaction[];
  importId: string | null;
  aviso?: string | null;
  cuentas: Opcion[];
  categorias: Opcion[];
  onDone: () => void;
}) {
  const [rows, setRows] = useState(inicial);
  const [pending, start] = useTransition();
  const [resultado, setResultado] = useState<string | null>(null);
  const router = useRouter();

  const set = (key: string, patch: Partial<DraftTransaction>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const incluidos = rows.filter((r) => r.incluir);
  const duplicados = rows.filter((r) => r.duplicado).length;
  const porRevisar = incluidos.filter((r) => r.requiere_revision).length;
  const totalGasto = incluidos.filter((r) => r.tipo === "gasto").reduce((s, r) => s + r.monto, 0);

  function guardar() {
    start(async () => {
      const r = await guardarBorradores(incluidos, importId);
      if (r.error) setResultado(`Error: ${r.error}`);
      else {
        setResultado(`Se guardaron ${r.guardados} movimientos.`);
        router.refresh();
        setTimeout(onDone, 1200);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <Badge>{rows.length} detectados</Badge>
        <Badge>{incluidos.length} a guardar</Badge>
        {duplicados > 0 && <Badge>{duplicados} duplicados (desmarcados)</Badge>}
        {porRevisar > 0 && <Badge>{porRevisar} irán a “Por revisar”</Badge>}
        <Badge>Gastos {money(totalGasto)}</Badge>
      </div>
      {aviso && <p className="rounded-lg border border-border p-2 text-sm">{aviso}</p>}

      <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {rows.map((r) => (
          <div key={r.key} className={cn("grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 p-3", !r.incluir && "opacity-50")}>
            <input
              type="checkbox"
              className="mt-2 h-5 w-5 accent-neutral-900"
              checked={r.incluir}
              onChange={(e) => set(r.key, { incluir: e.target.checked })}
              aria-label="Incluir"
            />
            <div className="grid grid-cols-2 gap-2 md:grid-cols-[8.5rem_1fr_7rem_6rem_9rem_9rem]">
              <input
                type="date"
                value={r.fecha}
                onChange={(e) => set(r.key, { fecha: e.target.value })}
                className="h-9 rounded-md border border-border px-2"
              />
              <input
                value={r.descripcion_original}
                onChange={(e) => set(r.key, { descripcion_original: e.target.value })}
                className="col-span-2 h-9 rounded-md border border-border px-2 md:col-span-1 order-first md:order-none"
              />
              <input
                inputMode="decimal"
                value={r.monto}
                onChange={(e) => set(r.key, { monto: Math.abs(Number(e.target.value.replace(/[$,]/g, "")) || 0) })}
                className="h-9 rounded-md border border-border px-2 text-right tabular"
              />
              <select
                value={r.tipo}
                onChange={(e) => set(r.key, { tipo: e.target.value as "gasto" | "ingreso" })}
                className="h-9 rounded-md border border-border px-2"
              >
                <option value="gasto">Gasto</option>
                <option value="ingreso">Ingreso</option>
              </select>
              <select
                value={r.account_id ?? ""}
                onChange={(e) => set(r.key, { account_id: e.target.value || null })}
                className="h-9 rounded-md border border-border px-2"
              >
                <option value="">Sin cuenta</option>
                {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <select
                value={r.category_id ?? ""}
                onChange={(e) =>
                  set(r.key, {
                    category_id: e.target.value || null,
                    confianza: e.target.value ? 1 : null,
                    origen_categoria: "manual",
                    requiere_revision: !e.target.value,
                  })
                }
                className={cn("h-9 rounded-md border px-2", r.requiere_revision ? "border-neutral-900" : "border-border")}
              >
                <option value="">Sin categoría</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <div className="col-span-2 flex flex-wrap gap-1 md:col-span-6">
                {r.duplicado && <Badge>Posible duplicado</Badge>}
                {r.origen_categoria === "regla" && <Badge>Por regla</Badge>}
                {r.origen_categoria === "ia" && r.confianza !== null && <Badge>IA {Math.round(r.confianza * 100)}%</Badge>}
                {r.requiere_revision && r.incluir && <Badge>Por revisar</Badge>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-20 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-white p-3 md:bottom-4">
        <Button onClick={guardar} disabled={pending || incluidos.length === 0} size="lg" className="flex-1 md:flex-none">
          {pending ? "Guardando…" : `Guardar ${incluidos.length} movimiento${incluidos.length === 1 ? "" : "s"}`}
        </Button>
        <Button variant="ghost" onClick={onDone} disabled={pending}>Cancelar</Button>
        {resultado && <p className="text-sm">{resultado}</p>}
      </div>
    </div>
  );
}
