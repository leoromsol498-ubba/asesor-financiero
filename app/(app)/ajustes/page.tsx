import { ActionForm } from "@/components/app/action-form";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { anthropicModel, APP_CURRENCY, APP_TIMEZONE } from "@/lib/config";
import { emailFrom } from "@/lib/email";
import { usarIA } from "@/lib/settings";
import { requireUser } from "@/lib/supabase/server";
import { borrarDemo, cambiarIA, cargarDemo, correoPrueba, probarAlertas, probarReporte } from "./actions";

function Estado({ nombre, ok }: { nombre: string; ok: boolean }) {
  return (
    <li className="flex justify-between gap-2 py-1.5 text-sm">
      <code className="truncate">{nombre}</code>
      <span className={ok ? "text-neutral-600" : "font-medium text-excedido"}>{ok ? "✓ configurada" : "✗ falta"}</span>
    </li>
  );
}

export default async function AjustesPage() {
  const { supabase, user } = await requireUser();
  const env = process.env;
  const ia = await usarIA(supabase);

  return (
    <>
      <PageHeader titulo="Ajustes" descripcion={`Sesión: ${user.email}`} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Inteligencia artificial</CardTitle>
              <CardDescription>
                {ia
                  ? "Encendida: se usa para la captura rápida, los PDF, categorizar lo que no tiene regla y las sugerencias. Cuesta unos centavos por uso."
                  : "Apagada: no se gasta ningún token. Capturas a mano, importas CSV con tus reglas y lo demás va a “Por revisar”. La captura rápida, los PDF y las sugerencias se ocultan."}
              </CardDescription>
            </div>
            <span className={ia ? "shrink-0 rounded-full bg-neutral-900 px-3 py-1 text-xs text-white" : "shrink-0 rounded-full border border-border px-3 py-1 text-xs"}>
              {ia ? "Encendida" : "Apagada"}
            </span>
          </CardHeader>
          <CardContent>
            <ActionForm
              action={cambiarIA.bind(null, !ia)}
              submit={ia ? "Apagar IA" : "Encender IA"}
              pending="Guardando…"
              buttonVariant={ia ? "outline" : "default"}
              className="md:max-w-xs"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Datos de ejemplo</CardTitle>
            <CardDescription>Carga 6 meses de movimientos ficticios para probar el dashboard. Se borran sin tocar tus datos reales.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ActionForm action={cargarDemo} submit="Cargar datos de ejemplo" pending="Cargando…" />
            <ActionForm action={borrarDemo} submit="Borrar datos de ejemplo" pending="Borrando…" buttonVariant="outline" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Probar correos</CardTitle>
            <CardDescription>Envía ahora los correos que normalmente salen solos. Remitente: {emailFrom()}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ActionForm action={correoPrueba} submit="Enviar correo de prueba" pending="Enviando…" buttonVariant="outline" />
            <ActionForm action={probarAlertas} submit="Probar alerta de pagos" pending="Revisando…" buttonVariant="outline" />
            <ActionForm action={probarReporte} submit="Probar reporte semanal" pending="Generando…" buttonVariant="outline" />
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Configuración</CardTitle>
            <CardDescription>
              Moneda {APP_CURRENCY} · Zona horaria {APP_TIMEZONE} · Modelo de IA {anthropicModel()}. Las llaves nunca se muestran.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              <Estado nombre="NEXT_PUBLIC_SUPABASE_URL" ok={!!env.NEXT_PUBLIC_SUPABASE_URL} />
              <Estado nombre="NEXT_PUBLIC_SUPABASE_ANON_KEY" ok={!!(env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)} />
              <Estado nombre="SUPABASE_SERVICE_ROLE_KEY" ok={!!(env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY)} />
              <Estado nombre="ANTHROPIC_API_KEY" ok={!!env.ANTHROPIC_API_KEY} />
              <Estado nombre="RESEND_API_KEY" ok={!!env.RESEND_API_KEY} />
              <Estado nombre="ALLOWED_EMAIL" ok={!!env.ALLOWED_EMAIL} />
              <Estado nombre="CRON_SECRET" ok={!!env.CRON_SECRET} />
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
