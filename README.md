# Asesor Financiero

App web personal para registrar gastos y cuentas. Te dice en qué categorías te estás pasando del presupuesto, cuánto te falta para tus metas de ahorro y te avisa por correo antes de que llegue un pago importante.

Funciona en el celular y la puedes agregar a tu pantalla de inicio como si fuera una app.

> **No necesitas saber programar para seguir esta guía.** Solo vas a copiar y pegar valores entre páginas web. Calcula unos **45 minutos** la primera vez.

---

## Índice

1. [Qué hace la app](#1-qué-hace-la-app)
2. [Cómo está armada (explicado sin tecnicismos)](#2-cómo-está-armada-explicado-sin-tecnicismos)
3. [Cuentas que necesitas](#3-cuentas-que-necesitas)
4. [Paso a paso para ponerla en internet](#4-paso-a-paso-para-ponerla-en-internet)
5. [Primer uso](#5-primer-uso)
6. [Lista exacta de variables de entorno](#6-lista-exacta-de-variables-de-entorno)
7. [Correrla en tu computadora (opcional)](#7-correrla-en-tu-computadora-opcional)
8. [Cómo hacer cambios después](#8-cómo-hacer-cambios-después)
9. [Problemas comunes](#9-problemas-comunes)
10. [Mapa del código](#10-mapa-del-código)
11. [Seguridad y costos](#11-seguridad-y-costos)

---

## 1. Qué hace la app

| Pantalla | Para qué sirve |
|---|---|
| **Inicio** | Tu presupuesto del mes por categoría. Para cada una ves lo gastado, la diferencia, el ritmo de gasto, la proyección al cierre del mes y los 3 gastos más grandes. Incluye dos gráficas: presupuesto contra gastado y los últimos 6 meses. |
| **Agregar** | Tres formas de registrar movimientos:<br>• **Rápida**: escribe "350 súper con débito" y la IA lo interpreta.<br>• **CSV o Excel**: el archivo que descargas de tu banca en línea.<br>• **PDF**: tu estado de cuenta; la IA saca los movimientos. |
| **Por revisar** | Movimientos que la IA no pudo categorizar con seguridad. Los corriges con un toque y la app **aprende**: la próxima vez ese comercio se categoriza solo. |
| **Movimientos** | Todo lo registrado, por mes, con buscador y filtros. |
| **Metas** | Cuánto llevas ahorrado, cuánto apartar por mes y por quincena, y si llegas a tiempo al ritmo de los últimos 3 meses. El botón **"¿De dónde saco la diferencia?"** te propone recortes concretos. |
| **Calendario** | Fechas de corte y límite de pago de tus tarjetas, y tus pagos programados (renta, seguros, etc.). |
| **Cuentas / Categorías** | Das de alta tus tarjetas y cuentas, y defines el presupuesto mensual de cada categoría. |
| **Ajustes** | **Encender o apagar la IA**, cargar **datos de ejemplo**, probar los correos y ver qué configuración falta. |

**Usar la app sin IA (sin gastar nada):** en **Ajustes → Inteligencia artificial** presiona **Apagar IA**. Con la IA apagada:
- Capturas a mano.
- Al importar CSV/Excel se aplican tus reglas aprendidas y lo demás va a "Por revisar".
- La captura rápida, los PDF y el botón de sugerencias se ocultan.
- El reporte semanal usa una recomendación simple.

Puedes encenderla de nuevo cuando quieras. También funciona sin configurar la llave de Anthropic.

**Correos automáticos:**

- **Todos los días a las 8:00 am**: si un pago vence en 7 días o en 2 días, recibes un correo con el monto y si el saldo de tu cuenta alcanza.
- **Domingos a las 3:00 pm**: un resumen con el estado del presupuesto, el avance de tus metas, los pagos de las próximas 2 semanas y una acción recomendada para la semana.

**Reglas que la app siempre respeta:**

- Nunca guarda números completos de tarjeta. Si aparecen en un PDF, solo se conservan los últimos 4 dígitos.
- No da recomendaciones de inversión.
- Solo tu correo puede entrar.

---

## 2. Cómo está armada (explicado sin tecnicismos)

La app usa 5 servicios. Cada uno hace una parte del trabajo:

```
   Tú (celular o compu)
          │
          ▼
   ┌──────────────┐   guarda y lee datos   ┌───────────────┐
   │   VERCEL     │ ─────────────────────► │   SUPABASE    │
   │ (la página   │                        │ (base de datos,│
   │  web y los   │   lee PDFs, categoriza │  login y PDFs) │
   │  avisos      │ ─────────────────────► ├───────────────┤
   │  diarios)    │                        │  ANTHROPIC    │
   │              │   manda correos        │  (la IA)      │
   │              │ ─────────────────────► ├───────────────┤
   └──────────────┘                        │   RESEND      │
          ▲                                │  (correos)    │
          │ el código vive en              └───────────────┘
   ┌──────────────┐
   │   GITHUB     │
   └──────────────┘
```

- **GitHub** guarda el código. Cada vez que el código cambia ahí, Vercel actualiza la app solo.
- **Vercel** pone la app en internet y ejecuta las revisiones diarias y semanales.
- **Supabase** es la base de datos. Ahí viven tus movimientos, cuentas y metas, más el login y los PDF. Tiene candados ("Row Level Security") para que solo tu usuario vea tus datos.
- **Anthropic** es la IA (Claude). Lee tus PDF, entiende la captura rápida y categoriza.
- **Resend** envía los correos.

Los servicios se conectan con **llaves** (textos largos y secretos). Esas llaves se guardan en Vercel como **variables de entorno**, nunca dentro del código.

---

## 3. Cuentas que necesitas

Crea estas cuentas antes de empezar. Todas tienen plan gratuito, **excepto Anthropic, que cobra por uso** (ver [costos](#11-seguridad-y-costos)).

| Servicio | Dónde | Notas |
|---|---|---|
| GitHub | https://github.com/signup | Guarda el código |
| Vercel | https://vercel.com/signup | **Entra con tu cuenta de GitHub** (es lo más fácil) |
| Supabase | https://supabase.com/dashboard | Puedes entrar con GitHub |
| Anthropic | https://console.anthropic.com | Necesitas agregar una tarjeta y algo de crédito (ej. 5 USD) |
| Resend | https://resend.com/signup | **Regístrate con `leoromsol498@gmail.com`** (sin dominio propio, Resend solo envía al correo de tu cuenta) |

---

## 4. Paso a paso para ponerla en internet

### Paso 1. Crear la base de datos en Supabase

1. Entra a https://supabase.com/dashboard y presiona **New project**.
2. Llena el formulario:
   - **Name**: `asesor-financiero`
   - **Database password**: presiona *Generate a password* y guárdala en un lugar seguro. No la vas a necesitar en la app, pero sí si algún día quieres administrar la base.
   - **Region**: la más cercana a ti (por ejemplo *East US*).
3. Presiona **Create new project** y espera 1 o 2 minutos.
4. En el menú izquierdo abre **SQL Editor** y presiona **+ New query**.
5. Abre el archivo [`supabase/setup.sql`](supabase/setup.sql) de este repositorio. En GitHub hay un botón para copiar todo el archivo.
6. Pega el contenido en el editor y presiona **Run**. Debe decir *Success. No rows returned*.

   Esto crea las tablas, los candados de seguridad, el espacio privado para los PDF y los datos de ejemplo. Si lo ejecutas otra vez no pasa nada malo.

### Paso 2. Configurar el inicio de sesión en Supabase

> **Haz primero el Paso 5 (Resend).** Supabase pide un servidor de correo propio (SMTP) para poder personalizar la plantilla, y usaremos Resend.

1. Ve a **Authentication → Sign In / Providers** y confirma que **Email** está activado.
2. Ve a **Authentication → Emails → SMTP Settings**, activa **Enable custom SMTP** y llena:

   | Campo | Valor |
   |---|---|
   | Sender email address | `onboarding@resend.dev` (no tu Gmail: Resend no puede enviar desde una dirección de Gmail) |
   | Sender name | `Asesor Financiero` |
   | Host | `smtp.resend.com` |
   | Port number | `465` |
   | Username | `resend` (literalmente esa palabra) |
   | Password | Una llave de API de Resend (`re_…`). Crea una aparte llamada `supabase-smtp`. |

   Presiona **Save**. Esto también sube el límite a 30 correos por hora.

   *Alternativa con Gmail:*
   - Host: `smtp.gmail.com`
   - Puerto: `465`
   - Usuario: tu Gmail
   - Contraseña: una **contraseña de aplicación** de Google (myaccount.google.com → Seguridad; requiere verificación en 2 pasos). Nunca tu contraseña normal.
   - Sender email address: tu Gmail.
3. Ve a **Authentication → Emails → Templates → Magic Link**:
   - En **Subject** escribe `Tu acceso a Asesor Financiero`.
   - En **Body** borra todo y pega el contenido de [`supabase/plantilla-correo-acceso.html`](supabase/plantilla-correo-acceso.html).
   - Presiona **Save**.

   Con esta plantilla el correo trae un botón **y** un código. El código sirve si abres el correo en un dispositivo distinto al que usas para entrar.
4. **URL Configuration** se llena en el Paso 6, cuando ya tengas la dirección de Vercel.

### Paso 3. Copiar las llaves de Supabase

Ve a **Project Settings** (el engrane) y luego a **API Keys** y **Data API**. Copia estos valores a un bloc de notas **temporal**:

| Lo que ves en Supabase | Variable |
|---|---|
| Project URL (`https://xxxx.supabase.co`) | `NEXT_PUBLIC_SUPABASE_URL` |
| **Publishable key** (`sb_publishable_…`), o la *anon public* si ves "Legacy API keys" | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **Secret key** (`sb_secret_…`), o la *service_role*. ⚠️ Es la más delicada: no la compartas. | `SUPABASE_SERVICE_ROLE_KEY` |

### Paso 4. Llave de Anthropic (la IA)

1. Entra a https://console.anthropic.com.
2. En **Billing**, agrega una tarjeta y compra crédito (5 USD alcanzan para mucho uso personal).
3. En **API Keys** presiona **Create Key**, nómbrala `asesor-financiero` y copia la llave (`sk-ant-…`). **Solo se muestra una vez.**

### Paso 5. Llave de Resend (correos)

1. Entra a https://resend.com con la cuenta registrada con `leoromsol498@gmail.com`.
2. En **API Keys** presiona **Create API Key**, nómbrala `asesor-financiero` con permiso *Sending access* y copia la llave (`re_…`).

> Con el remitente `onboarding@resend.dev` no necesitas comprar dominio, pero **solo puede enviar al correo con el que te registraste en Resend**. Si después quieres un remitente propio (ej. `alertas@tudominio.com`), verifica tu dominio en Resend → *Domains* y cambia `ALERT_EMAIL_FROM`.

### Paso 6. Publicar en Vercel

1. Asegúrate de que el código esté en tu GitHub, en el repositorio `asesor-financiero`.
2. En https://vercel.com/new elige el repositorio `asesor-financiero` y presiona **Import**.
3. Antes de presionar Deploy, abre **Environment Variables** y agrega **una por una** las variables de la [sección 6](#6-lista-exacta-de-variables-de-entorno).
4. Presiona **Deploy** y espera unos 2 minutos.
5. Copia la dirección que te da Vercel, por ejemplo `https://asesor-financiero-xxxx.vercel.app`.
6. Regresa a Vercel → tu proyecto → **Settings → Environment Variables**:
   - Cambia `NEXT_PUBLIC_APP_URL` por esa dirección.
   - Ve a **Deployments**, abre el menú `⋯` del último despliegue y elige **Redeploy**.
7. Regresa a Supabase → **Authentication → URL Configuration**:
   - **Site URL**: tu dirección de Vercel.
   - **Redirect URLs**: agrega `https://TU-DIRECCION.vercel.app/**` y también `http://localhost:3000/**`.
   - Presiona **Save**.

**Las tareas automáticas ya quedan programadas.** Están en `vercel.json` y las verás en Vercel → tu proyecto → **Settings → Cron Jobs**. El plan gratis permite una ejecución diaria por tarea, así que pueden llegar con unos minutos de variación dentro de esa hora.

| Tarea | Horario (Ciudad de México) | En UTC (vercel.json) |
|---|---|---|
| Alertas de pagos | Diario 8:00 am | `0 14 * * *` |
| Reporte semanal | Domingo 3:00 pm | `0 21 * * 0` |

### Paso 7. Cerrar el registro (seguridad)

**Después de entrar por primera vez** (ver [sección 5](#5-primer-uso)), ve a Supabase → **Authentication → Sign In / Providers** y **desactiva "Allow new users to sign up"**. Así nadie más puede crear una cuenta.

La app ya rechaza cualquier correo distinto al tuyo; este paso agrega un segundo candado.

---

## 5. Primer uso

1. Abre tu dirección de Vercel. En el celular, usa el menú del navegador y elige **Agregar a pantalla de inicio**.
2. Escribe `leoromsol498@gmail.com` y presiona **Enviarme enlace de acceso**.
3. Abre el correo y toca **Entrar**, o escribe el código en la app.
4. Ve a **Más → Ajustes** y prueba:
   - **Cargar datos de ejemplo**: carga 6 meses de movimientos ficticios para que veas el dashboard, las metas y el calendario.
   - **Enviar correo de prueba**, **Probar alerta de pagos** y **Probar reporte semanal**.
5. Cuando termines de explorar, presiona **Borrar datos de ejemplo**. Tus datos reales no se tocan.
6. Configura tus datos reales:
   1. **Categorías**: presiona *Crear categorías básicas* y ajusta los presupuestos.
   2. **Cuentas**: da de alta tus tarjetas, con los días de corte y de pago y **solo los últimos 4 dígitos**.
   3. **Calendario**: agrega tus pagos fijos (renta, seguros, colegiaturas…).
   4. **Metas**: crea tus metas de ahorro.
   5. **Agregar**: importa tu primer estado de cuenta.

### Qué probar en cada parte

| Parte | Prueba |
|---|---|
| Login | Que solo entre tu correo. Con otro correo debe decir *"no tiene acceso"*. |
| Captura rápida | Escribe `350 súper con débito` y luego `ayer 120 uber con tarjeta`. |
| CSV | Sube el CSV de tu banco. Revisa que las columnas detectadas sean correctas antes de continuar. |
| PDF | Sube un estado de cuenta. En la vista previa revisa que los números de tarjeta aparezcan como `****1234`. |
| Duplicados | Sube el mismo archivo dos veces. La segunda vez los movimientos deben salir como *Posible duplicado*, desmarcados. |
| Por revisar | Corrige uno. Debe decir que la próxima vez se categoriza solo. Revisa la regla en **Categorías → Reglas aprendidas**. |
| Dashboard | Con los datos de ejemplo, *Restaurantes* debe salir en rojo (excedido) y *Entretenimiento* en negro (en riesgo). |
| Metas | El botón **¿De dónde saco la diferencia?** debe dar montos por categoría. |

---

## 6. Lista exacta de variables de entorno

Captúralas en Vercel → **Settings → Environment Variables**, marcando los ambientes *Production* y *Preview*. Para tu computadora van en un archivo `.env.local` (copia de [`.env.example`](.env.example)).

| Variable | Valor | ¿Secreta? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL de Supabase | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key de Supabase | No (es pública por diseño) |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key de Supabase | **Sí** |
| `ANTHROPIC_API_KEY` | `sk-ant-…` | **Sí** |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | No |
| `RESEND_API_KEY` | `re_…` | **Sí** |
| `ALERT_EMAIL_FROM` | `Asesor Financiero <onboarding@resend.dev>` | No |
| `ALLOWED_EMAIL` | `leoromsol498@gmail.com` | No |
| `NEXT_PUBLIC_APP_CURRENCY` | `MXN` | No |
| `NEXT_PUBLIC_APP_TIMEZONE` | `America/Mexico_City` | No |
| `CRON_SECRET` | Texto aleatorio largo (ver abajo) | **Sí** |
| `NEXT_PUBLIC_APP_URL` | `https://TU-DIRECCION.vercel.app` | No |

**¿Cómo genero `CRON_SECRET`?** Cualquier texto largo y aleatorio sirve. Puedes usar https://www.uuidgenerator.net/ y pegar dos UUID juntos. En una terminal también puedes ejecutar:

```bash
openssl rand -hex 32
```

Vercel lo envía automáticamente al ejecutar los crons. Con él, nadie más puede disparar tus alertas.

> **Versatilidad:** si un día cambias de moneda, de zona horaria o de modelo de IA, solo cambias la variable y haces *Redeploy*. Si cambias la zona horaria, ajusta también las horas UTC de `vercel.json`.

---

## 7. Correrla en tu computadora (opcional)

Solo si quieres hacer cambios y verlos antes de publicarlos.

1. Instala:
   - **Node.js 22 LTS**: https://nodejs.org
   - **Git**: https://git-scm.com/downloads
   - Recomendado, **VS Code**: https://code.visualstudio.com
2. Abre una terminal (en Mac: *Terminal*; en Windows: *PowerShell*) y descarga el código. Cambia `TU-USUARIO` por tu usuario de GitHub:

   ```bash
   git clone https://github.com/TU-USUARIO/asesor-financiero.git
   ```

   ```bash
   cd asesor-financiero
   ```

   ```bash
   npm install
   ```

3. Copia `.env.example` como `.env.local` y llena los valores (los mismos de Vercel, con `NEXT_PUBLIC_APP_URL=http://localhost:3000`).
4. Arranca la app:

   ```bash
   npm run dev
   ```

5. Abre http://localhost:3000.

**Comandos útiles:**

| Comando | Qué hace |
|---|---|
| `npm run dev` | Arranca la app en tu computadora |
| `npm test` | Corre las pruebas de los cálculos (presupuesto, metas, duplicados, CSV) |
| `npm run check` | Revisa tipos, estilo, pruebas y que compile, todo de una vez |

**Supabase en tu computadora (avanzado):** con Docker instalado, `npx supabase start` levanta una base local con las migraciones de `supabase/migrations`.

---

## 8. Cómo hacer cambios después

- **Desde la web, sin instalar nada:** en GitHub abre un archivo, presiona el lápiz ✏️, edítalo y presiona *Commit changes*. Vercel publica el cambio solo en 1 o 2 minutos.
- **Desde tu computadora:** haz el cambio, prueba con `npm run dev` y luego ejecuta:

  ```bash
  git add -A
  ```

  ```bash
  git commit -m "describe tu cambio"
  ```

  ```bash
  git push
  ```

- **Con ayuda de IA:** puedes pedirle a Claude Code cambios como "agrega una categoría fija para mascotas" o "cambia el reporte semanal al lunes".

**Cambios frecuentes y dónde se hacen:**

| Quiero… | Dónde |
|---|---|
| Cambiar presupuestos o categorías | En la app → Categorías |
| Cambiar el horario de los correos | `vercel.json` (las horas están en **UTC**: CDMX = UTC − 6) |
| Cambiar cuándo algo está "en riesgo" (hoy son 20 puntos) | `lib/budget.ts` → `UMBRAL_RIESGO` |
| Cambiar qué tan segura debe estar la IA (hoy 70 %) | `lib/config.ts` → `CONFIANZA_MINIMA` |
| Cambiar las instrucciones de la IA | `lib/ai.ts` |
| Cambiar los días de aviso de pagos (7 y 2) | `lib/jobs.ts` → `revisarPagos` |

---

## 9. Problemas comunes

| Síntoma | Solución |
|---|---|
| "Falta configurar Supabase" | Faltan `NEXT_PUBLIC_SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Agrégalas y haz **Redeploy**. Las variables `NEXT_PUBLIC_*` solo se aplican al volver a desplegar. |
| No llega el correo de acceso | Revisa spam. Confirma el SMTP del Paso 2: el remitente debe ser `onboarding@resend.dev`, el usuario `resend` y la contraseña tu llave `re_…`. En Resend → *Emails* puedes ver si el envío falló y por qué. |
| El enlace del correo dice "venció" | Usa el **código** del correo, o pide uno nuevo. Revisa que tu dirección esté en *Redirect URLs* (Paso 6.7). |
| "Este correo no tiene acceso" | `ALLOWED_EMAIL` debe ser exactamente `leoromsol498@gmail.com`. |
| "No se pudieron cargar… ¿Ejecutaste las migraciones?" | Repite el Paso 1 (pegar `supabase/setup.sql`). |
| Error de IA "llave no válida" o "modelo no existe" | Revisa `ANTHROPIC_API_KEY`, que tengas crédito en Anthropic y el valor de `ANTHROPIC_MODEL`. |
| No llegan alertas | En Ajustes, prueba **Enviar correo de prueba**. Si falla, revisa `RESEND_API_KEY` y que tu cuenta de Resend sea `leoromsol498@gmail.com`. Después revisa Vercel → *Settings → Cron Jobs → View logs*. |
| El PDF tarda o falla | Los PDF muy largos o escaneados como imagen pueden fallar. Prueba con el PDF original del banco o divídelo. |
| Mi banco me da `.xls` | Ábrelo en Excel o Google Sheets y guárdalo como `.xlsx` o `.csv`. |

---

## 10. Mapa del código

Para cuando quieras entender o modificar algo:

```
app/
  (auth)/login/          Pantalla de acceso (correo + código)
  auth/confirm/          A donde llega el enlace del correo
  (app)/                 Todo lo que requiere sesión
    page.tsx             Dashboard de presupuesto
    importar/            Captura rápida, CSV/Excel, PDF y vista previa
    revisar/             Bandeja "Por revisar" + aprendizaje de reglas
    movimientos/         Lista de movimientos
    metas/               Metas de ahorro y sugerencias de IA
    calendario/          Calendario y pagos programados
    cuentas/ categorias/ ajustes/
  api/cron/              Tareas automáticas (alertas diarias y reporte semanal)
components/              Piezas visuales (botones, tarjetas, gráficas)
lib/
  ai.ts                  Todas las llamadas a la IA (con reglas de seguridad)
  budget.ts goals.ts     Cálculos de presupuesto y metas
  columns.ts             Detección de columnas en CSV/Excel
  transactions.ts        Duplicados, reglas, categorización y recurrentes
  jobs.ts email.ts       Contenido de los correos
  calendar.ts dates.ts   Fechas, vencimientos y zona horaria
supabase/
  migrations/            Estructura de la base de datos
  setup.sql              Las migraciones en un solo archivo, para pegar en Supabase
proxy.ts                 Protege todas las páginas (solo tu correo entra)
vercel.json              Horario de las tareas automáticas
tests/                   Pruebas automáticas de los cálculos
```

**Tecnologías:**
- Next.js 16 (App Router) y TypeScript
- Tailwind CSS con componentes estilo shadcn/ui
- Recharts para las gráficas
- Supabase: Postgres, Auth, Storage y RLS
- API de Anthropic
- Resend
- Vercel Cron Jobs

---

## 11. Seguridad y costos

**Seguridad**

- **Llaves:** todas viven en variables de entorno. Ninguna está en el código.
- **Tus datos en la base:** cada tabla tiene *Row Level Security*; cada fila pertenece a tu usuario y la base rechaza cualquier acceso de otro usuario.
- **PDF:** van a un espacio **privado** de Supabase Storage, en una carpeta con tu identificador.
- **Números de tarjeta y cuenta:** la IA recibe la instrucción de enmascararlos, y además la app quita cualquier secuencia de 12 a 19 dígitos antes de guardar (deja `****1234`). En las cuentas solo se aceptan 4 dígitos.
- **Instrucción en cada llamada a la IA:** no dar recomendaciones de inversión ni de compra o venta de instrumentos financieros.
- **Crons:** solo se pueden ejecutar con `CRON_SECRET`.

**Costos aproximados (uso personal)**

| Servicio | Costo |
|---|---|
| Vercel Hobby | Gratis |
| Supabase Free | Gratis. Se pausa tras 1 semana sin uso; los correos diarios lo mantienen activo. |
| Resend Free | Gratis (3,000 correos al mes) |
| Anthropic | Por uso: una captura rápida ~0.003 USD; categorizar 80 movimientos ~0.04 USD; un estado de cuenta en PDF ~0.10 a 0.20 USD. Un mes típico ronda 1 USD. Con la IA apagada: 0. |
