"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ActionResult = { error?: string; ok?: string } | undefined;

/**
 * Formulario que llama a una Server Action y muestra el error o el éxito.
 * `resetOnSuccess` limpia los campos al guardar.
 */
export function ActionForm({
  action,
  children,
  submit = "Guardar",
  pending = "Guardando…",
  className,
  resetOnSuccess = false,
  buttonVariant,
  buttonClassName,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  children?: React.ReactNode;
  submit?: React.ReactNode;
  pending?: string;
  className?: string;
  resetOnSuccess?: boolean;
  buttonVariant?: ButtonProps["variant"];
  buttonClassName?: string;
}) {
  const [state, formAction, isPending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className={cn("flex flex-col gap-3", className)}>
      {children}
      {state?.error && <p className="text-sm text-excedido">{state.error}</p>}
      {state?.ok && <p className="text-sm text-neutral-600">{state.ok}</p>}
      <Button type="submit" disabled={isPending} variant={buttonVariant} className={buttonClassName}>
        {isPending ? pending : submit}
      </Button>
    </form>
  );
}

/** Botón que ejecuta una acción (ej. borrar) con confirmación. */
export function ConfirmButton({
  action,
  children,
  confirmText = "¿Seguro?",
  className,
  variant = "ghost",
  size = "sm",
}: {
  action: () => Promise<unknown>;
  children: React.ReactNode;
  confirmText?: string;
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  return (
    <form
      action={async () => {
        await action();
      }}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      <Button type="submit" variant={variant} size={size} className={className}>
        {children}
      </Button>
    </form>
  );
}
