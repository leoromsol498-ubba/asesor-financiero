import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { LINKS_MAS } from "@/components/app/links";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { cerrarSesion } from "../../(auth)/login/actions";

export default function MasPage() {
  return (
    <>
      <PageHeader titulo="Más" />
      <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {LINKS_MAS.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted">
            <Icon className="h-5 w-5 text-neutral-500" />
            <span className="flex-1">{label}</span>
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          </Link>
        ))}
      </div>
      <form action={cerrarSesion} className="mt-6">
        <Button variant="outline" className="w-full">Cerrar sesión</Button>
      </form>
    </>
  );
}
