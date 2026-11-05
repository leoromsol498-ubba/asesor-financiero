import { Field, Input, Select } from "@/components/ui/input";
import { FRECUENCIAS } from "@/lib/calendar";
import type { ScheduledPayment } from "@/lib/types";

type Opcion = { id: string; nombre: string };

export function PaymentFields({ p, cuentas, categorias, hoy }: { p?: ScheduledPayment; cuentas: Opcion[]; categorias: Opcion[]; hoy: string }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2"><Field label="Nombre"><Input name="nombre" defaultValue={p?.nombre} placeholder="Ej. Renta o Nómina" required /></Field></div>
      <Field label="Tipo">
        <Select name="tipo" defaultValue={p?.tipo ?? "gasto"}>
          <option value="gasto">Gasto (pago)</option>
          <option value="ingreso">Ingreso</option>
        </Select>
      </Field>
      <Field label="Monto"><Input name="monto" inputMode="decimal" defaultValue={p?.monto} placeholder="0.00" required /></Field>
      <Field label="Frecuencia" hint="Quincenal: el día elegido y 15 días después (el 15 → también fin de mes).">
        <Select name="frecuencia" defaultValue={p?.frecuencia ?? "mensual"}>
          {Object.entries(FRECUENCIAS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </Select>
      </Field>
      <Field label="Próxima fecha"><Input name="proximo_vencimiento" type="date" defaultValue={p?.proximo_vencimiento ?? hoy} required /></Field>
      <Field label="Cuenta">
        <Select name="account_id" defaultValue={p?.account_id ?? ""}>
          <option value="">Sin cuenta</option>
          {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </Select>
      </Field>
      <Field label="Categoría">
        <Select name="category_id" defaultValue={p?.category_id ?? ""}>
          <option value="">Sin categoría</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </Select>
      </Field>
      <label className="col-span-2 flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
        <input type="checkbox" name="registrar_automatico" defaultChecked={p?.registrar_automatico ?? false} className="mt-0.5 h-5 w-5 accent-neutral-900" />
        <span>
          <strong>Registrar automáticamente</strong> como movimiento en cada fecha.
          <span className="block text-xs text-muted-foreground">
            No lo actives si también importas el estado de cuenta de esa cuenta, o quedaría duplicado.
          </span>
        </span>
      </label>
    </div>
  );
}
