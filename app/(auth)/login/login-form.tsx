"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { enviarEnlace, verificarCodigo, type LoginState } from "./actions";

export function LoginForm() {
  const [envio, enviar, enviando] = useActionState<LoginState, FormData>(enviarEnlace, {});
  const [verif, verificar, verificando] = useActionState<LoginState, FormData>(verificarCodigo, {});

  const enviado = envio.enviado || verif.enviado;
  const email = verif.email || envio.email || "";

  if (!enviado) {
    return (
      <form action={enviar} className="flex flex-col gap-4">
        <Field label="Correo">
          <Input name="email" type="email" autoComplete="email" required placeholder="tu@correo.com" defaultValue={email} />
        </Field>
        {envio.error && <p className="text-sm text-excedido">{envio.error}</p>}
        <Button type="submit" disabled={enviando} size="lg">
          {enviando ? "Enviando…" : "Enviarme enlace de acceso"}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-neutral-700">
        Te enviamos un correo a <strong>{email}</strong>. Abre el enlace <em>o</em> escribe aquí el código de 6 dígitos.
      </p>
      <form action={verificar} className="flex flex-col gap-4">
        <input type="hidden" name="email" value={email} />
        <Field label="Código">
          <Input name="token" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" required />
        </Field>
        {verif.error && <p className="text-sm text-excedido">{verif.error}</p>}
        <Button type="submit" disabled={verificando} size="lg">
          {verificando ? "Verificando…" : "Entrar"}
        </Button>
      </form>
      <form action={enviar}>
        <input type="hidden" name="email" value={email} />
        <Button type="submit" variant="ghost" size="sm" disabled={enviando}>
          Reenviar correo
        </Button>
      </form>
    </div>
  );
}
