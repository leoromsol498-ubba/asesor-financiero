export function PageHeader({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 md:mb-7">
      <div>
        <h1 className="text-xl font-semibold md:text-2xl">{titulo}</h1>
        {descripcion && <p className="mt-1 text-sm text-muted-foreground">{descripcion}</p>}
      </div>
      {children && <div className="flex gap-2">{children}</div>}
    </div>
  );
}
