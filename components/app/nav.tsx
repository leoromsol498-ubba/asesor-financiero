"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MOVIL, TODAS } from "./links";

function activo(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

export function Sidebar({ pendientes }: { pendientes: number }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {TODAS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-muted hover:text-neutral-950",
            activo(path, href) && "bg-muted font-medium text-neutral-950",
          )}
        >
          <Icon className="h-4 w-4" />
          <span className="flex-1">{label}</span>
          {href === "/revisar" && pendientes > 0 && (
            <span className="rounded-full bg-neutral-900 px-1.5 text-xs text-white tabular">{pendientes}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav({ pendientes }: { pendientes: number }) {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 backdrop-blur md:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {MOVIL.map(({ href, label, icon: Icon, destacado }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "relative flex flex-col items-center gap-0.5 py-2 text-[11px] text-neutral-500",
              activo(path, href) && "text-neutral-950 font-medium",
            )}
          >
            {destacado ? (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-950 text-white">
                <Icon className="h-5 w-5" />
              </span>
            ) : (
              <Icon className="h-5 w-5" />
            )}
            {!destacado && label}
            {href === "/revisar" && pendientes > 0 && (
              <span className="absolute right-4 top-1 rounded-full bg-neutral-900 px-1 text-[10px] text-white">{pendientes}</span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}
