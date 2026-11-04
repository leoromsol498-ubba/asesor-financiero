"use client";

import { useState, useTransition } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { DraftTransaction } from "@/lib/types";
import { procesarPDF, registrarImportPDF, type Preparado } from "./actions";
import { PreviewEditor } from "./preview-editor";

type Opcion = { id: string; nombre: string };

export function PdfImport({ cuentas, categorias }: { cuentas: Opcion[]; categorias: Opcion[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [cuenta, setCuenta] = useState("");
  const [paso, setPaso] = useState<string | null>(null);
  const [res, setRes] = useState<Preparado | null>(null);
  const [pending, start] = useTransition();

  if (res?.drafts) {
    return (
      <PreviewEditor
        inicial={res.drafts as DraftTransaction[]}
        importId={res.importId ?? null}
        aviso={res.aviso}
        cuentas={cuentas}
        categorias={categorias}
        onDone={() => { setRes(null); setFile(null); }}
      />
    );
  }

  function procesar() {
    if (!file) return;
    start(async () => {
      setRes(null);
      if (file.size > 20 * 1024 * 1024) return setRes({ error: "El PDF pesa más de 20 MB." });
      setPaso("Guardando el PDF de forma privada…");
      const reg = await registrarImportPDF(file.name);
      if (reg.error || !reg.id || !reg.ruta) return setRes({ error: reg.error ?? "No se pudo registrar." });

      const supabase = createClient();
      const { error } = await supabase.storage.from("statements").upload(reg.ruta, file, { contentType: "application/pdf" });
      if (error) {
        setPaso(null);
        return setRes({ error: `No se pudo subir: ${error.message}` });
      }
      setPaso("Leyendo el estado de cuenta con IA (puede tardar hasta 1–2 minutos)…");
      const r = await procesarPDF(reg.id, cuenta || null);
      setPaso(null);
      setRes(r);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> Estado de cuenta en PDF</CardTitle>
        <CardDescription>
          Se guarda en un espacio privado y la IA extrae los movimientos. Los números de tarjeta se guardan solo con los últimos 4 dígitos.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-white"
        />
        <Field label="Cuenta" hint="Si la dejas en automático, se busca por los últimos 4 dígitos del estado de cuenta.">
          <Select value={cuenta} onChange={(e) => setCuenta(e.target.value)}>
            <option value="">Automática</option>
            {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </Select>
        </Field>
        {paso && <p className="animate-pulse text-sm text-neutral-600">{paso}</p>}
        {res?.error && <p className="text-sm text-excedido">{res.error}</p>}
        <Button size="lg" onClick={procesar} disabled={!file || pending}>
          {pending ? "Procesando…" : "Extraer movimientos"}
        </Button>
      </CardContent>
    </Card>
  );
}
