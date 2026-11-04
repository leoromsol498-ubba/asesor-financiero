-- =====================================================================
-- Asesor Financiero · Esquema de base de datos
-- Cada tabla pertenece a un usuario (user_id) y está protegida con
-- Row Level Security: cada quien solo puede ver y modificar sus filas.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Tipos ----------
do $$ begin
  create type tipo_cuenta as enum ('debito', 'credito', 'efectivo', 'ahorro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_movimiento as enum ('gasto', 'ingreso');
exception when duplicate_object then null; end $$;

do $$ begin
  create type frecuencia_pago as enum ('mensual', 'anual', 'unica');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_importacion as enum ('pendiente', 'procesado', 'confirmado', 'error');
exception when duplicate_object then null; end $$;

-- ---------- Cuentas ----------
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null,
  tipo tipo_cuenta not null default 'debito',
  dia_corte smallint check (dia_corte between 1 and 31),
  dia_limite_pago smallint check (dia_limite_pago between 1 and 31),
  saldo_actual numeric(14, 2) not null default 0,
  ultimos_4 char(4) check (ultimos_4 ~ '^[0-9]{4}$'),
  es_demo boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Categorías ----------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null,
  presupuesto_mensual numeric(14, 2) not null default 0,
  color_neutro text not null default '#525252',
  es_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, nombre)
);

-- ---------- Importaciones ----------
create table if not exists public.imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre_archivo text not null,
  ruta_storage text,
  estado estado_importacion not null default 'pendiente',
  movimientos_detectados integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Movimientos ----------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  fecha date not null,
  descripcion_original text not null,
  comercio text,
  monto numeric(14, 2) not null check (monto >= 0),
  tipo tipo_movimiento not null default 'gasto',
  category_id uuid references public.categories (id) on delete set null,
  requiere_revision boolean not null default false,
  es_recurrente boolean not null default false,
  confianza numeric(3, 2),
  hash_unico text not null,
  import_id uuid references public.imports (id) on delete set null,
  es_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, hash_unico)
);
create index if not exists transactions_user_fecha_idx on public.transactions (user_id, fecha desc);
create index if not exists transactions_revision_idx on public.transactions (user_id) where requiere_revision;

-- ---------- Reglas de categorización ----------
create table if not exists public.categorization_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  patron_texto text not null,
  category_id uuid not null references public.categories (id) on delete cascade,
  veces_aplicada integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, patron_texto)
);

-- ---------- Metas de ahorro ----------
create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null,
  monto_objetivo numeric(14, 2) not null check (monto_objetivo > 0),
  monto_actual numeric(14, 2) not null default 0,
  fecha_objetivo date not null,
  es_demo boolean not null default false,
  created_at timestamptz not null default now()
);

-- Aportaciones a metas: permiten medir el ritmo de los últimos 3 meses.
create table if not exists public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null references public.savings_goals (id) on delete cascade,
  fecha date not null default current_date,
  monto numeric(14, 2) not null,
  nota text,
  created_at timestamptz not null default now()
);
create index if not exists goal_contributions_goal_idx on public.goal_contributions (goal_id, fecha);

-- ---------- Pagos programados ----------
create table if not exists public.scheduled_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null,
  monto numeric(14, 2) not null check (monto >= 0),
  frecuencia frecuencia_pago not null default 'mensual',
  proximo_vencimiento date not null,
  account_id uuid references public.accounts (id) on delete set null,
  es_demo boolean not null default false,
  created_at timestamptz not null default now()
);

-- Registro de alertas enviadas (evita correos repetidos).
create table if not exists public.alert_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  clave text not null,           -- ej. "pago:<id>:2026-11-15:7d"
  enviado_en timestamptz not null default now(),
  unique (user_id, clave)
);

-- =====================================================================
-- Disparador: mantener savings_goals.monto_actual = suma de aportaciones
-- =====================================================================
create or replace function public.recalcular_meta() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_goal uuid := coalesce(new.goal_id, old.goal_id);
begin
  update public.savings_goals g
     set monto_actual = coalesce((select sum(monto) from public.goal_contributions c where c.goal_id = v_goal), 0)
   where g.id = v_goal;
  return null;
end $$;

drop trigger if exists goal_contributions_recalc on public.goal_contributions;
create trigger goal_contributions_recalc
after insert or update or delete on public.goal_contributions
for each row execute function public.recalcular_meta();

-- =====================================================================
-- Row Level Security
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'accounts', 'categories', 'imports', 'transactions', 'categorization_rules',
    'savings_goals', 'goal_contributions', 'scheduled_payments', 'alert_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "propietario" on public.%I', t);
    execute format(
      'create policy "propietario" on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- =====================================================================
-- Storage: bucket privado para estados de cuenta en PDF.
-- Ruta obligatoria: {user_id}/{archivo}.pdf
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('statements', 'statements', false, 20971520, array['application/pdf'])
on conflict (id) do update set public = false;

drop policy if exists "statements_select_propios" on storage.objects;
create policy "statements_select_propios" on storage.objects for select to authenticated
  using (bucket_id = 'statements' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "statements_insert_propios" on storage.objects;
create policy "statements_insert_propios" on storage.objects for insert to authenticated
  with check (bucket_id = 'statements' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "statements_delete_propios" on storage.objects;
create policy "statements_delete_propios" on storage.objects for delete to authenticated
  using (bucket_id = 'statements' and (storage.foldername(name))[1] = (select auth.uid())::text);
