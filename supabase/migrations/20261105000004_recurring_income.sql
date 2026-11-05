-- =====================================================================
-- Ingresos y gastos programados con registro automático
-- =====================================================================
alter type frecuencia_pago add value if not exists 'quincenal';
alter type frecuencia_pago add value if not exists 'semanal';
alter type frecuencia_pago add value if not exists 'catorcenal';

alter table public.scheduled_payments
  add column if not exists tipo tipo_movimiento not null default 'gasto',
  add column if not exists category_id uuid references public.categories (id) on delete set null,
  add column if not exists registrar_automatico boolean not null default false;
