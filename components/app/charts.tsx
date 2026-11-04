"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { money, moneyShort } from "@/lib/format";

const NEGRO = "#171717";
const GRIS = "#888888";
const ROJO = "#dc2626"; // solo "excedido"
const EJE = "#737373";
const GRID = "#eeeeee";

function TooltipBox({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-neutral-700">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: p.color }} />
          {p.name}: <span className="tabular font-medium text-neutral-950">{money(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

/** Presupuesto vs gastado por categoría (barras horizontales: se leen bien en el celular). */
export function BudgetChart({ data }: { data: { nombre: string; presupuesto: number; gastado: number; excedido: boolean }[] }) {
  const alto = Math.max(220, data.length * 56 + 60);
  return (
    <div style={{ height: alto }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" tickFormatter={moneyShort} tick={{ fill: EJE, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="nombre" width={104} tick={{ fill: "#404040", fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip content={<TooltipBox />} cursor={{ fill: "#f5f5f5" }} />
          <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: "#404040" }} />
          <Bar dataKey="presupuesto" name="Presupuesto" fill={GRIS} radius={[0, 4, 4, 0]} maxBarSize={14} />
          <Bar dataKey="gastado" name="Gastado" fill={NEGRO} radius={[0, 4, 4, 0]} maxBarSize={14}>
            {data.map((d) => (
              <Cell key={d.nombre} fill={d.excedido ? ROJO : NEGRO} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Gasto total de los últimos 6 meses, con el presupuesto mensual como referencia. */
export function TrendChart({ data, presupuesto }: { data: { mes: string; gastos: number; ingresos: number }[]; presupuesto: number }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }} barGap={2} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="mes" tick={{ fill: EJE, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={moneyShort} width={70} tick={{ fill: EJE, fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<TooltipBox />} cursor={{ fill: "#f5f5f5" }} />
          <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: "#404040" }} />
          {presupuesto > 0 && (
            <ReferenceLine y={presupuesto} stroke={EJE} strokeDasharray="4 4" />
          )}
          <Bar dataKey="ingresos" name="Ingresos" fill={GRIS} radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="gastos" name="Gastos" fill={NEGRO} radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
