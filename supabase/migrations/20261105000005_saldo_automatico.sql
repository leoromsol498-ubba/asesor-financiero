-- =====================================================================
-- Saldo automático
-- Cada cuenta guarda la fecha en que su saldo se capturó a mano
-- (saldo_fecha). Los movimientos con fecha >= saldo_fecha actualizan el
-- saldo solos; los anteriores (ej. estados de cuenta viejos) no lo tocan.
-- =====================================================================
alter table public.accounts
  add column if not exists saldo_fecha date not null
  default ((now() at time zone 'America/Mexico_City')::date);

create or replace function public.ajustar_saldo() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  -- Revertir el efecto de la versión anterior del movimiento
  if tg_op in ('UPDATE', 'DELETE') and old.account_id is not null and not old.es_demo then
    update accounts a
       set saldo_actual = a.saldo_actual - (case when old.tipo = 'ingreso' then old.monto else -old.monto end)
     where a.id = old.account_id and old.fecha >= a.saldo_fecha;
  end if;
  -- Aplicar el efecto de la versión nueva
  if tg_op in ('INSERT', 'UPDATE') and new.account_id is not null and not new.es_demo then
    update accounts a
       set saldo_actual = a.saldo_actual + (case when new.tipo = 'ingreso' then new.monto else -new.monto end)
     where a.id = new.account_id and new.fecha >= a.saldo_fecha;
  end if;
  return null;
end $$;

drop trigger if exists transactions_ajustar_saldo on public.transactions;
create trigger transactions_ajustar_saldo
after insert or delete or update of account_id, fecha, monto, tipo on public.transactions
for each row execute function public.ajustar_saldo();
