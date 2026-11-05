"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import type { DraftTransaction } from "@/lib/types";
import { interpretarLinea, prepararManual, type Preparado } from "./actions";
import { PreviewEditor } from "./preview-editor";

type Opcion = { id: string; nombre: string };

export function QuickCapture({ cuentas, categorias, hoy, usarIA = true }: { cuentas: Opcion[]; categorias: Opcion[]; hoy: string; usarIA?: boolean }) {
  const [texto, setTexto] = useState("");
  const [res, setRes] = useState<Preparado | null>(null);
  const [pending, start] = useTransition();

  const reset = () => {
    setRes(null);
    setTexto("");
  };

  if (res?.drafts) {
    return (
      <PreviewEditor
        inicial={res.drafts as DraftTransaction[]}
        importId={null}
        aviso={res.aviso}
        cuentas={cuentas}
        categorias={categorias}
        onDone={reset}
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {usarIA && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Captura rápida</CardTitle>
          <CardDescription>Escríbelo como lo dirías: “350 súper con débito”, “ayer 120 uber”, “me pagaron 8000”.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => setRes(await interpretarLinea(texto)));
            }}
          >
            <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="350 súper con débito" autoFocus />
            {res?.error && <p className="text-sm text-excedido">{res.error}</p>}
            <Button type="submit" disabled={pending || !texto.trim()} size="lg">
              {pending ? "Interpretando…" : "Interpretar"}
            </Button>
          </form>
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Captura manual</CardTitle>
          <CardDescription>Sin IA y sin costo, llenando cada campo.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-2 gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              start(async () =>
                setRes(
                  await prepararManual({
                    fecha: String(f.get("fecha")),
                    descripcion: String(f.get("descripcion")),
                    monto: Math.abs(Number(String(f.get("monto")).replace(/[$,]/g, ""))),
                    tipo: f.get("tipo") as "gasto" | "ingreso",
                    account_id: (f.get("account_id") as string) || null,
                    category_id: (f.get("category_id") as string) || null,
                  }),
                ),
              );
            }}
          >
            <Field label="Monto"><Input name="monto" inputMode="decimal" required placeholder="0.00" /></Field>
            <Field label="Fecha"><Input name="fecha" type="date" defaultValue={hoy} required /></Field>
            <div className="col-span-2"><Field label="Descripción"><Input name="descripcion" required placeholder="Ej. Farmacia" /></Field></div>
            <Field label="Tipo">
              <Select name="tipo" defaultValue="gasto"><option value="gasto">Gasto</option><option value="ingreso">Ingreso</option></Select>
            </Field>
            <Field label="Cuenta">
              <Select name="account_id" defaultValue={cuentas[0]?.id ?? ""}>
                <option value="">Sin cuenta</option>
                {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </Select>
            </Field>
            <div className="col-span-2">
              <Field
                label="Categoría"
                hint={usarIA ? "Elige una para no usar IA. En “Automática” se usan tus reglas y, si no hay, la IA." : "En “Automática” se usan tus reglas; si no hay, va a “Por revisar”."}
              >
                <Select name="category_id" defaultValue="">
                  <option value="">Automática</option>
                  {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </Select>
              </Field>
            </div>
            <Button type="submit" variant="outline" disabled={pending} className="col-span-2">Revisar y guardar</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
