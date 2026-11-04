"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fechaCorta, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { confirmarTodos, corregirCategoria } from "./actions";

interface Item {
  id: string;
  fecha: string;
  descripcion_original: string;
  comercio: string | null;
  monto: number;
  tipo: "gasto" | "ingreso";
  category_id: string | null;
  confianza: number | null;
  cuenta: string | null;
}

export function ReviewList({ items, categorias }: { items: Item[]; categorias: { id: string; nombre: string }[] }) {
  const [ocultos, ocultar] = useOptimistic<string[], string[]>([], (prev, ids) => [...prev, ...ids]);
  const [, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const visibles = items.filter((i) => !ocultos.includes(i.id));
  const conSugerencia = visibles.filter((i) => i.category_id);

  function elegir(item: Item, categoryId: string) {
    startTransition(async () => {
      ocultar([item.id]);
      const r = await corregirCategoria(item.id, categoryId);
      const nombre = categorias.find((c) => c.id === categoryId)?.nombre;
      setMensaje(
        r.similares > 0
          ? `Listo. También se categorizaron ${r.similares} movimientos parecidos como ${nombre}.`
          : `Listo. La próxima vez “${item.comercio || item.descripcion_original}” irá a ${nombre}.`,
      );
    });
  }

  if (visibles.length === 0) {
    return <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">Todo revisado. 🎉</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {mensaje && <p className="rounded-lg bg-muted px-3 py-2 text-sm">{mensaje}</p>}
      {conSugerencia.length > 1 && (
        <Button
          variant="outline"
          className="self-start"
          onClick={() =>
            startTransition(async () => {
              ocultar(conSugerencia.map((i) => i.id));
              await confirmarTodos(conSugerencia.map((i) => i.id));
            })
          }
        >
          <Check className="h-4 w-4" /> Aceptar las {conSugerencia.length} sugerencias
        </Button>
      )}
      {visibles.map((item) => (
        <Card key={item.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{item.comercio || item.descripcion_original}</p>
              <p className="truncate text-xs text-muted-foreground">
                {fechaCorta(item.fecha)} · {item.descripcion_original}
                {item.cuenta ? ` · ${item.cuenta}` : ""}
              </p>
            </div>
            <p className={cn("shrink-0 font-semibold tabular", item.tipo === "ingreso" && "text-neutral-500")}>
              {item.tipo === "ingreso" ? "+" : "−"}
              {money(item.monto)}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {categorias.map((c) => {
              const sugerida = c.id === item.category_id;
              return (
                <button
                  key={c.id}
                  onClick={() => elegir(item, c.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors",
                    sugerida ? "border-neutral-950 bg-neutral-950 text-white" : "border-border hover:bg-muted",
                  )}
                >
                  {sugerida && <Check className="-ml-1 mr-1 inline h-3.5 w-3.5" />}
                  {c.nombre}
                  {sugerida && item.confianza !== null && (
                    <span className="ml-1 opacity-70">{Math.round(item.confianza * 100)}%</span>
                  )}
                </button>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}
