import { ActionForm, ConfirmButton } from "@/components/app/action-form";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fechaCorta, money } from "@/lib/format";
import { requireUser } from "@/lib/supabase/server";
import type { Account } from "@/lib/types";
import { AccountFields } from "./account-fields";
import { actualizarCuenta, borrarCuenta, crearCuenta } from "./actions";

const TIPOS = { debito: "Débito", credito: "Crédito", efectivo: "Efectivo", ahorro: "Ahorro" };

export default async function CuentasPage() {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("accounts").select("*").order("created_at");
  const cuentas = (data ?? []) as Account[];
  const total = cuentas.reduce((s, c) => s + Number(c.saldo_actual), 0);

  return (
    <>
      <PageHeader titulo="Cuentas" descripcion={`Saldo neto: ${money(total)}`} />
      <div className="grid gap-4 md:grid-cols-2">
        {cuentas.map((c) => (
          <Card key={c.id}>
            <CardHeader className="flex-row items-start justify-between">
              <div>
                <CardTitle>{c.nombre}</CardTitle>
                <div className="mt-1 flex gap-2">
                  <Badge>{TIPOS[c.tipo]}</Badge>
                  {c.ultimos_4 && <Badge>•••• {c.ultimos_4}</Badge>}
                  {c.es_demo && <Badge className="border-dashed">demo</Badge>}
                </div>
              </div>
              <p className="text-lg font-semibold tabular">{money(c.saldo_actual)}</p>
            </CardHeader>
            <CardContent>
              <p className="mb-2 text-xs text-muted-foreground">
                Se actualiza solo con los movimientos desde el {fechaCorta(c.saldo_fecha)}. Si no coincide con tu banco, edítalo.
              </p>
              {c.tipo === "credito" && (
                <p className="mb-2 text-sm text-muted-foreground">
                  Corte: día {c.dia_corte ?? "—"} · Límite de pago: día {c.dia_limite_pago ?? "—"}
                </p>
              )}
              <details className="group">
                <summary className="cursor-pointer text-sm text-neutral-600 underline-offset-2 hover:underline">Editar</summary>
                <div className="mt-3 flex flex-col gap-2">
                  <ActionForm action={actualizarCuenta.bind(null, c.id)}>
                    <AccountFields a={c} />
                  </ActionForm>
                  <ConfirmButton action={borrarCuenta.bind(null, c.id)} confirmText="¿Borrar esta cuenta? Sus movimientos se conservan sin cuenta.">
                    Borrar cuenta
                  </ConfirmButton>
                </div>
              </details>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader>
            <CardTitle>Nueva cuenta</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={crearCuenta} submit="Agregar cuenta" resetOnSuccess>
              <AccountFields />
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
