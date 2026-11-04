import * as React from "react";
import { cn } from "@/lib/utils";
import type { EstadoPresupuesto } from "@/lib/budget";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs font-medium text-neutral-700",
        className,
      )}
      {...props}
    />
  );
}

const ESTADOS: Record<EstadoPresupuesto, { texto: string; clase: string }> = {
  excedido: { texto: "Excedido", clase: "border-excedido bg-excedido text-white" },
  en_riesgo: { texto: "En riesgo", clase: "border-neutral-900 bg-neutral-900 text-white" },
  en_orden: { texto: "En orden", clase: "border-border text-neutral-600" },
  sin_presupuesto: { texto: "Sin presupuesto", clase: "border-dashed text-neutral-500" },
};

export function EstadoBadge({ estado }: { estado: EstadoPresupuesto }) {
  const e = ESTADOS[estado];
  return <Badge className={e.clase}>{e.texto}</Badge>;
}
