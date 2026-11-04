"use client";

import { useTransition } from "react";
import { corregirCategoria } from "../revisar/actions";

export function CategorySelect({ txId, value, categorias }: { txId: string; value: string | null; categorias: { id: string; nombre: string }[] }) {
  const [pending, start] = useTransition();
  return (
    <select
      defaultValue={value ?? ""}
      disabled={pending}
      aria-label="Categoría"
      onChange={(e) => e.target.value && start(() => corregirCategoria(txId, e.target.value).then(() => undefined))}
      className="h-8 max-w-40 rounded-md border border-border bg-white px-2 text-xs"
    >
      <option value="" disabled>Sin categoría</option>
      {categorias.map((c) => (
        <option key={c.id} value={c.id}>{c.nombre}</option>
      ))}
    </select>
  );
}
