import { ActionForm, ConfirmButton } from "@/components/app/action-form";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { money } from "@/lib/format";
import { requireUser } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";
import { actualizarCategoria, borrarCategoria, borrarRegla, crearCategoria, crearCategoriasBasicas } from "./actions";

const GRISES = ["#0a0a0a", "#262626", "#404040", "#525252", "#737373", "#a3a3a3", "#d4d4d4"];

function CategoriaCampos({ c }: { c?: Category }) {
  return (
    <div className="grid grid-cols-[1fr_8rem_3rem] items-center gap-2">
      <Input name="nombre" defaultValue={c?.nombre} placeholder="Nombre" required aria-label="Nombre" />
      <Input name="presupuesto_mensual" inputMode="decimal" defaultValue={c?.presupuesto_mensual ?? ""} placeholder="Presupuesto" aria-label="Presupuesto mensual" />
      <select name="color_neutro" defaultValue={c?.color_neutro ?? "#525252"} aria-label="Tono" className="h-10 rounded-lg border border-border px-1">
        {GRISES.map((g) => (
          <option key={g} value={g} style={{ background: g }}>{"■"}</option>
        ))}
      </select>
    </div>
  );
}

export default async function CategoriasPage() {
  const { supabase } = await requireUser();
  const [{ data }, { data: reglas }] = await Promise.all([
    supabase.from("categories").select("*").order("nombre"),
    supabase.from("categorization_rules").select("id, patron_texto, category_id, veces_aplicada").order("patron_texto"),
  ]);
  const categorias = (data ?? []) as Category[];
  const nombre = new Map(categorias.map((c) => [c.id, c.nombre]));
  const total = categorias.reduce((s, c) => s + Number(c.presupuesto_mensual), 0);

  return (
    <>
      <PageHeader titulo="Categorías y presupuesto" descripcion={`Presupuesto mensual total: ${money(total)}`} />

      {categorias.length === 0 && (
        <form action={crearCategoriasBasicas} className="mb-4">
          <Button type="submit" variant="outline">Crear categorías básicas</Button>
        </form>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>Tus categorías</CardTitle>
            <CardDescription>Cambia el nombre o el presupuesto y presiona Guardar.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {categorias.map((c) => (
              <div key={c.id} className="flex flex-col gap-2 border-b border-border pb-4 last:border-0">
                <ActionForm action={actualizarCategoria.bind(null, c.id)} buttonVariant="outline" className="md:flex-row md:items-start" buttonClassName="md:w-28">
                  <div className="flex-1"><CategoriaCampos c={c} /></div>
                </ActionForm>
                <ConfirmButton action={borrarCategoria.bind(null, c.id)} confirmText={`¿Borrar "${c.nombre}"? Sus movimientos quedarán sin categoría.`} className="self-start text-neutral-500">
                  Borrar
                </ConfirmButton>
              </div>
            ))}
            <div className="rounded-lg bg-muted p-3">
              <p className="mb-2 text-sm font-medium">Nueva categoría</p>
              <ActionForm action={crearCategoria} submit="Agregar" resetOnSuccess>
                <CategoriaCampos />
              </ActionForm>
            </div>
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Reglas aprendidas</CardTitle>
            <CardDescription>Se crean cuando corriges una categoría. Si el texto del movimiento contiene estas palabras, se categoriza solo.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {(reglas ?? []).length === 0 && <p className="text-sm text-muted-foreground">Aún no hay reglas.</p>}
            {(reglas ?? []).map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">
                  “{r.patron_texto}” → <strong>{nombre.get(r.category_id) ?? "?"}</strong>
                </span>
                <ConfirmButton action={borrarRegla.bind(null, r.id)} confirmText="¿Borrar esta regla?" className="h-7 px-2 text-neutral-500">
                  ×
                </ConfirmButton>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
