import { Field, Input, Select } from "@/components/ui/input";
import type { ScheduledPayment } from "@/lib/types";

export function PaymentFields({ p, cuentas, hoy }: { p?: ScheduledPayment; cuentas: { id: string; nombre: string }[]; hoy: string }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2"><Field label="Nombre"><Input name="nombre" defaultValue={p?.nombre} placeholder="Ej. Renta" required /></Field></div>
      <Field label="Monto"><Input name="monto" inputMode="decimal" defaultValue={p?.monto} placeholder="0.00" required /></Field>
      <Field label="Frecuencia">
        <Select name="frecuencia" defaultValue={p?.frecuencia ?? "mensual"}>
          <option value="mensual">Mensual</option>
          <option value="anual">Anual</option>
          <option value="unica">Única vez</option>
        </Select>
      </Field>
      <Field label="Próximo vencimiento"><Input name="proximo_vencimiento" type="date" defaultValue={p?.proximo_vencimiento ?? hoy} required /></Field>
      <Field label="Se paga desde">
        <Select name="account_id" defaultValue={p?.account_id ?? ""}>
          <option value="">Sin cuenta</option>
          {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </Select>
      </Field>
    </div>
  );
}
