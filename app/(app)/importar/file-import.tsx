"use client";

import { useMemo, useState, useTransition } from "react";
import Papa from "papaparse";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/input";
import { aplicarMapeo, detectarMapeo, type Celda, type Mapeo } from "@/lib/columns";
import { money } from "@/lib/format";
import type { DraftTransaction } from "@/lib/types";
import { prepararDesdeArchivo, type Preparado } from "./actions";
import { PreviewEditor } from "./preview-editor";

type Opcion = { id: string; nombre: string };

async function leerArchivo(file: File): Promise<Celda[][]> {
  const nombre = file.name.toLowerCase();
  if (nombre.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    return (await readSheet(file)) as Celda[][];
  }
  if (nombre.endsWith(".xls")) {
    throw new Error("El formato .xls antiguo no es compatible. Ábrelo en Excel y guárdalo como .xlsx o .csv.");
  }
  const texto = await file.text();
  const r = Papa.parse<string[]>(texto.replace(/^﻿/, ""), { skipEmptyLines: true });
  return r.data;
}

export function FileImport({ cuentas, categorias, usarIA = true }: { cuentas: Opcion[]; categorias: Opcion[]; usarIA?: boolean }) {
  const [archivo, setArchivo] = useState<string | null>(null);
  const [filas, setFilas] = useState<Celda[][] | null>(null);
  const [mapeo, setMapeo] = useState<Mapeo | null>(null);
  const [cuenta, setCuenta] = useState(cuentas[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<Preparado | null>(null);
  const [pending, start] = useTransition();

  const interpretado = useMemo(() => (filas && mapeo ? aplicarMapeo(filas, mapeo) : null), [filas, mapeo]);
  const encabezados = useMemo(() => {
    if (!filas || !mapeo) return [];
    const n = Math.max(...filas.slice(0, 30).map((f) => f.length));
    const enc = mapeo.filaEncabezado >= 0 ? filas[mapeo.filaEncabezado] : [];
    return Array.from({ length: n }, (_, i) => `${String.fromCharCode(65 + (i % 26))}${enc?.[i] ? ` · ${String(enc[i]).slice(0, 25)}` : ""}`);
  }, [filas, mapeo]);

  const reset = () => {
    setArchivo(null);
    setFilas(null);
    setMapeo(null);
    setRes(null);
    setError(null);
  };

  if (res?.drafts) {
    return (
      <PreviewEditor inicial={res.drafts as DraftTransaction[]} importId={res.importId ?? null} aviso={res.aviso} cuentas={cuentas} categorias={categorias} onDone={reset} />
    );
  }

  const col = (k: keyof Mapeo, label: string, opcional = false) => (
    <Field label={label}>
      <Select value={String(mapeo![k])} onChange={(e) => setMapeo({ ...mapeo!, [k]: Number(e.target.value) })}>
        {opcional && <option value={-1}>— No usar —</option>}
        {encabezados.map((h, i) => <option key={i} value={i}>{h}</option>)}
      </Select>
    </Field>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> CSV o Excel</CardTitle>
        <CardDescription>
          Descarga tus movimientos desde la banca en línea (.csv o .xlsx) y súbelos aquí.{" "}
          {usarIA
            ? "Lo que no tenga regla se categoriza con IA."
            : "IA apagada: se aplican tus reglas y lo demás lo categorizas tú."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <input
          type="file"
          accept=".csv,.txt,.xlsx,.xls"
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-white"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            reset();
            try {
              const data = await leerArchivo(f);
              if (data.length < 2) throw new Error("El archivo está vacío.");
              setArchivo(f.name);
              setFilas(data);
              setMapeo(detectarMapeo(data));
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        />
        {error && <p className="text-sm text-excedido">{error}</p>}

        {filas && mapeo && interpretado && (
          <>
            <div className="rounded-lg bg-muted p-3 text-sm">
              Detecté las columnas automáticamente. <strong>Revisa que sean correctas</strong> antes de continuar.
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Field label="Fila de títulos">
                <Select value={mapeo.filaEncabezado} onChange={(e) => setMapeo({ ...mapeo, filaEncabezado: Number(e.target.value) })}>
                  <option value={-1}>Sin títulos</option>
                  {filas.slice(0, 15).map((_, i) => <option key={i} value={i}>Fila {i + 1}</option>)}
                </Select>
              </Field>
              {col("fecha", "Fecha")}
              {col("descripcion", "Descripción")}
              {col("monto", "Monto (una sola columna)", true)}
              {col("cargo", "Cargos / retiros", true)}
              {col("abono", "Abonos / depósitos", true)}
              {mapeo.monto >= 0 && (
                <Field label="Los gastos aparecen como">
                  <Select value={mapeo.signoGastos} onChange={(e) => setMapeo({ ...mapeo, signoGastos: e.target.value as Mapeo["signoGastos"] })}>
                    <option value="negativo">Negativos (−350)</option>
                    <option value="positivo">Positivos (350)</option>
                  </Select>
                </Field>
              )}
              <Field label="Formato de fecha">
                <Select value={mapeo.formatoFecha} onChange={(e) => setMapeo({ ...mapeo, formatoFecha: e.target.value as Mapeo["formatoFecha"] })}>
                  <option value="dmy">día/mes/año</option>
                  <option value="mdy">mes/día/año</option>
                </Select>
              </Field>
              <Field label="Cuenta">
                <Select value={cuenta} onChange={(e) => setCuenta(e.target.value)}>
                  <option value="">Sin cuenta</option>
                  {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </Select>
              </Field>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-xs text-muted-foreground">
                  <tr><th className="p-2">Fecha</th><th className="p-2">Descripción</th><th className="p-2 text-right">Monto</th><th className="p-2">Tipo</th></tr>
                </thead>
                <tbody>
                  {interpretado.ok.slice(0, 6).map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-2 whitespace-nowrap">{r.fecha}</td>
                      <td className="max-w-56 truncate p-2">{r.descripcion}</td>
                      <td className="p-2 text-right tabular">{money(r.monto)}</td>
                      <td className="p-2">{r.tipo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-muted-foreground">
              {interpretado.ok.length} movimientos válidos en <strong>{archivo}</strong>
              {interpretado.omitidas > 0 && ` · ${interpretado.omitidas} filas omitidas (sin fecha o monto)`}
            </p>
            {res?.error && <p className="text-sm text-excedido">{res.error}</p>}
            <Button
              size="lg"
              disabled={pending || interpretado.ok.length === 0}
              onClick={() => start(async () => setRes(await prepararDesdeArchivo(archivo ?? "archivo", interpretado.ok, cuenta || null)))}
            >
              {pending ? "Revisando duplicados y categorizando…" : "Continuar a la vista previa"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
