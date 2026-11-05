-- =====================================================================
-- Preferencias del usuario (ej. encender/apagar la IA)
-- =====================================================================
create table if not exists public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  usar_ia boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
drop policy if exists "propietario" on public.user_settings;
create policy "propietario" on public.user_settings for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
