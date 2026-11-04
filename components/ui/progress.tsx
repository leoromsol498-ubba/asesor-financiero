import { cn } from "@/lib/utils";

/** Barra de avance. `marca` dibuja una línea (ej. % del mes transcurrido). */
export function Progress({ value, marca, excedido }: { value: number; marca?: number; excedido?: boolean }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-neutral-100">
      <div
        className={cn("h-full rounded-full", excedido ? "bg-excedido" : "bg-neutral-900")}
        style={{ width: `${v}%` }}
      />
      {marca !== undefined && (
        <div className="absolute top-0 h-full w-0.5 bg-neutral-400" style={{ left: `${Math.min(marca, 100)}%` }} />
      )}
    </div>
  );
}
