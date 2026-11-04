"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function Tabs({ tabs }: { tabs: { id: string; label: string; content: React.ReactNode }[] }) {
  const [activa, setActiva] = useState(tabs[0].id);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiva(t.id)}
            className={cn(
              "rounded-lg px-2 py-2 text-sm text-neutral-600",
              activa === t.id && "bg-white font-medium text-neutral-950 shadow-sm",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} hidden={t.id !== activa}>{t.content}</div>
      ))}
    </div>
  );
}
