import Link from "next/link";
import { buttonVariants } from "./button";

export function Empty({ titulo, texto, href, accion }: { titulo: string; texto?: string; href?: string; accion?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <p className="font-medium">{titulo}</p>
      {texto && <p className="max-w-sm text-sm text-muted-foreground">{texto}</p>}
      {href && accion && (
        <Link href={href} className={buttonVariants({ variant: "outline", size: "sm" })}>
          {accion}
        </Link>
      )}
    </div>
  );
}
