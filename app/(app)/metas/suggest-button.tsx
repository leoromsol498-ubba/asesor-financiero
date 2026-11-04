"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PropuestaAhorro } from "@/lib/ai";
import { money } from "@/lib/format";
import { sugerirAhorro } from "./actions";

export function SuggestButton({ goalId }: { goalId: string }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<{ propuesta?: PropuestaAhorro; error?: string } | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <Button variant="outline" disabled={pending} onClick={() => start(async () => setRes(await sugerirAhorro(goalId)))}>
        <Sparkles className="h-4 w-4" />
        {pending ? "Analizando tus gastos…" : "¿De dónde saco la diferencia?"}
      </Button>
      {res?.error && <p className="text-sm text-excedido">{res.error}</p>}
      {res?.propuesta && (
        <div className="rounded-lg bg-muted p-3 text-sm">
          <p className="mb-2">{res.propuesta.resumen}</p>
          <ul className="flex flex-col gap-2">
            {res.propuesta.recortes.map((r, i) => (
              <li key={i} className="flex justify-between gap-3 border-t border-border pt-2">
                <span>
                  <strong>{r.categoria}</strong> — {r.como}
                </span>
                <span className="shrink-0 font-medium tabular">{money(r.monto_mensual)}/mes</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 border-t border-border pt-2 font-medium">
            Total: {money(res.propuesta.total_mensual)} al mes {res.propuesta.alcanza ? "· cubre la diferencia" : "· no alcanza a cubrir todo"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">Sugerencia generada por IA sobre tus gastos. No es asesoría de inversión.</p>
        </div>
      )}
    </div>
  );
}
