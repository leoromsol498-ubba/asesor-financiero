import { Field, Input, Select } from "@/components/ui/input";
import type { Account } from "@/lib/types";

export function AccountFields({ a }: { a?: Account }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Field label="Nombre">
          <Input name="nombre" defaultValue={a?.nombre} placeholder="Ej. BBVA Débito" required />
        </Field>
      </div>
      <Field label="Tipo">
        <Select name="tipo" defaultValue={a?.tipo ?? "debito"}>
          <option value="debito">Débito</option>
          <option value="credito">Crédito</option>
          <option value="efectivo">Efectivo</option>
          <option value="ahorro">Ahorro</option>
        </Select>
      </Field>
      <Field label="Saldo actual" hint="Tal como lo ves hoy en tu banco (en crédito, la deuda en negativo). Desde hoy se actualiza solo con tus movimientos.">
        <Input name="saldo_actual" inputMode="decimal" defaultValue={a?.saldo_actual ?? ""} placeholder="0.00" />
      </Field>
      <Field label="Día de corte" hint="Solo tarjetas de crédito">
        <Input name="dia_corte" type="number" min={1} max={31} defaultValue={a?.dia_corte ?? ""} />
      </Field>
      <Field label="Día límite de pago">
        <Input name="dia_limite_pago" type="number" min={1} max={31} defaultValue={a?.dia_limite_pago ?? ""} />
      </Field>
      <div className="col-span-2">
        <Field label="Últimos 4 dígitos (opcional)" hint="Nunca escribas el número completo de tu tarjeta.">
          <Input name="ultimos_4" inputMode="numeric" maxLength={4} defaultValue={a?.ultimos_4 ?? ""} placeholder="1234" />
        </Field>
      </div>
    </div>
  );
}
