-- =====================================================================
-- Datos de ejemplo (seed)
-- Se cargan desde la app: Ajustes → "Cargar datos de ejemplo".
-- Todo lo que se crea queda marcado con es_demo = true para poder
-- borrarlo después sin tocar tus datos reales.
-- =====================================================================

create or replace function public.borrar_datos_demo() returns void
language plpgsql security invoker set search_path = public as $$
declare uid uuid := auth.uid();
begin
  delete from transactions where user_id = uid and es_demo;
  delete from scheduled_payments where user_id = uid and es_demo;
  delete from savings_goals where user_id = uid and es_demo;
  delete from accounts where user_id = uid and es_demo;
  -- Solo se borran categorías demo que ya no tengan movimientos reales
  delete from categories c where c.user_id = uid and c.es_demo
    and not exists (select 1 from transactions t where t.category_id = c.id);
end $$;

create or replace function public.cargar_datos_demo() returns void
language plpgsql security invoker set search_path = public as $$
declare
  uid uuid := auth.uid();
  c_super uuid; c_rest uuid; c_transp uuid; c_serv uuid; c_subs uuid;
  c_salud uuid; c_entre uuid; c_ropa uuid; c_hogar uuid; c_ingreso uuid;
  a_debito uuid; a_credito uuid; a_ahorro uuid; a_efectivo uuid;
  g_viaje uuid; g_fondo uuid;
  m int; d int; mes date; dias_mes int; limite int;
begin
  if uid is null then
    raise exception 'Debes iniciar sesión para cargar los datos de ejemplo';
  end if;

  -- Si ya había datos de ejemplo, se reemplazan (no se duplican)
  perform public.borrar_datos_demo();
  perform setseed(0.42);

  -- Categorías (si ya existe una con el mismo nombre, se reutiliza)
  insert into categories (user_id, nombre, presupuesto_mensual, color_neutro, es_demo) values
    (uid, 'Supermercado', 6000, '#171717', true),
    (uid, 'Restaurantes', 2500, '#262626', true),
    (uid, 'Transporte', 2000, '#404040', true),
    (uid, 'Servicios', 1800, '#525252', true),
    (uid, 'Suscripciones', 700, '#737373', true),
    (uid, 'Salud', 1200, '#a3a3a3', true),
    (uid, 'Entretenimiento', 1500, '#d4d4d4', true),
    (uid, 'Ropa', 1000, '#e5e5e5', true),
    (uid, 'Hogar', 900, '#f5f5f5', true),
    (uid, 'Ingresos', 0, '#000000', true)
  on conflict (user_id, nombre) do nothing;

  select id into c_super  from categories where user_id = uid and nombre = 'Supermercado';
  select id into c_rest   from categories where user_id = uid and nombre = 'Restaurantes';
  select id into c_transp from categories where user_id = uid and nombre = 'Transporte';
  select id into c_serv   from categories where user_id = uid and nombre = 'Servicios';
  select id into c_subs   from categories where user_id = uid and nombre = 'Suscripciones';
  select id into c_salud  from categories where user_id = uid and nombre = 'Salud';
  select id into c_entre  from categories where user_id = uid and nombre = 'Entretenimiento';
  select id into c_ropa   from categories where user_id = uid and nombre = 'Ropa';
  select id into c_hogar  from categories where user_id = uid and nombre = 'Hogar';
  select id into c_ingreso from categories where user_id = uid and nombre = 'Ingresos';

  -- Cuentas
  insert into accounts (user_id, nombre, tipo, dia_corte, dia_limite_pago, saldo_actual, ultimos_4, es_demo)
    values (uid, 'Débito Nómina (demo)', 'debito', null, null, 18500, '1234', true) returning id into a_debito;
  insert into accounts (user_id, nombre, tipo, dia_corte, dia_limite_pago, saldo_actual, ultimos_4, es_demo)
    values (uid, 'Tarjeta de Crédito (demo)', 'credito', 5, 25, -7350, '9876', true) returning id into a_credito;
  insert into accounts (user_id, nombre, tipo, saldo_actual, es_demo)
    values (uid, 'Ahorro (demo)', 'ahorro', 42000, true) returning id into a_ahorro;
  insert into accounts (user_id, nombre, tipo, saldo_actual, es_demo)
    values (uid, 'Efectivo (demo)', 'efectivo', 1200, true) returning id into a_efectivo;

  -- Movimientos de los últimos 6 meses (incluye el actual)
  for m in 0..5 loop
    mes := (date_trunc('month', current_date) - make_interval(months => m))::date;
    dias_mes := extract(day from (mes + interval '1 month - 1 day'))::int;
    limite := case when m = 0 then extract(day from current_date)::int else dias_mes end;

    -- Ingresos quincenales
    if limite >= 1 then
      insert into transactions (user_id, account_id, fecha, descripcion_original, comercio, monto, tipo, category_id, es_recurrente, hash_unico, es_demo)
      values (uid, a_debito, mes, 'DEPOSITO NOMINA EMPRESA SA', 'Nómina', 16500, 'ingreso', c_ingreso, true, 'demo-' || gen_random_uuid(), true);
    end if;
    if limite >= 15 then
      insert into transactions (user_id, account_id, fecha, descripcion_original, comercio, monto, tipo, category_id, es_recurrente, hash_unico, es_demo)
      values (uid, a_debito, mes + 14, 'DEPOSITO NOMINA EMPRESA SA', 'Nómina', 16500, 'ingreso', c_ingreso, true, 'demo-' || gen_random_uuid(), true);
    end if;

    -- Cargos fijos mensuales (recurrentes)
    if limite >= 3 then
      insert into transactions (user_id, account_id, fecha, descripcion_original, comercio, monto, tipo, category_id, es_recurrente, hash_unico, es_demo) values
        (uid, a_credito, mes + 2, 'NETFLIX.COM', 'Netflix', 299, 'gasto', c_subs, true, 'demo-' || gen_random_uuid(), true),
        (uid, a_credito, mes + 2, 'SPOTIFY MX', 'Spotify', 129, 'gasto', c_subs, true, 'demo-' || gen_random_uuid(), true);
    end if;
    if limite >= 8 then
      insert into transactions (user_id, account_id, fecha, descripcion_original, comercio, monto, tipo, category_id, es_recurrente, hash_unico, es_demo) values
        (uid, a_debito, mes + 7, 'TELMEX INTERNET', 'Telmex', 549, 'gasto', c_serv, true, 'demo-' || gen_random_uuid(), true),
        (uid, a_debito, mes + 7, 'CFE SUMINISTRADOR', 'CFE', round((380 + random() * 250)::numeric, 2), 'gasto', c_serv, true, 'demo-' || gen_random_uuid(), true),
        (uid, a_credito, mes + 7, 'SMART FIT MENSUALIDAD', 'Smart Fit', 499, 'gasto', c_salud, true, 'demo-' || gen_random_uuid(), true);
    end if;

    -- Gastos variables
    for d in 1..limite loop
      -- Súper cada ~4 días
      if d % 4 = 1 then
        insert into transactions (user_id, account_id, fecha, descripcion_original, comercio, monto, tipo, category_id, hash_unico, es_demo)
        values (uid, a_debito, mes + d - 1,
          (array['WALMART SUPERCENTER', 'SORIANA HIPER', 'CHEDRAUI', 'LA COMER'])[1 + floor(random() * 4)::int],
          null, round((550 + random() * 600)::numeric, 2), 'gasto', c_super, 'demo-' || gen_random_uuid(), true);
      end if;
      -- Restaurantes: más frecuentes en el mes actual para que salga "excedido"
      if (m = 0 and d % 2 = 0) or (m > 0 and d % 4 = 2) then
        insert into transactions (user_id, account_id, fecha, descripcion_original, comercio, monto, tipo, category_id, hash_unico, es_demo)
        values (uid, a_credito, mes + d - 1,
          (array['RAPPI *RESTAURANTE', 'UBER EATS', 'STARBUCKS', 'TACOS EL GUERO', 'SUSHI ROLL'])[1 + floor(random() * 5)::int],
          null, round((180 + random() * 420)::numeric, 2), 'gasto', c_rest, 'demo-' || gen_random_uuid(), true);
      end if;
      -- Transporte
      if d % 3 = 0 then
        insert into transactions (user_id, account_id, fecha, descripcion_original, comercio, monto, tipo, category_id, hash_unico, es_demo)
        values (uid, a_credito, mes + d - 1,
          (array['UBER TRIP', 'DIDI MOBILITY', 'GASOLINERA PEMEX'])[1 + floor(random() * 3)::int],
          null, round((90 + random() * 380)::numeric, 2), 'gasto', c_transp, 'demo-' || gen_random_uuid(), true);
      end if;
      -- Entretenimiento: cada semana (va "en riesgo" en el mes actual)
      if d % 7 = 5 then
        insert into transactions (user_id, account_id, fecha, descripcion_original, comercio, monto, tipo, category_id, hash_unico, es_demo)
        values (uid, a_credito, mes + d - 1,
          (array['CINEPOLIS', 'TICKETMASTER', 'STEAM GAMES'])[1 + floor(random() * 3)::int],
          null, round((200 + random() * (case when m = 0 then 500 else 250 end))::numeric, 2), 'gasto', c_entre, 'demo-' || gen_random_uuid(), true);
      end if;
      -- Ropa y hogar ocasionales
      if d = 12 then
        insert into transactions (user_id, account_id, fecha, descripcion_original, comercio, monto, tipo, category_id, hash_unico, es_demo)
        values (uid, a_credito, mes + d - 1, 'LIVERPOOL', 'Liverpool', round((400 + random() * 700)::numeric, 2), 'gasto', c_ropa, 'demo-' || gen_random_uuid(), true);
      end if;
      if d = 20 then
        insert into transactions (user_id, account_id, fecha, descripcion_original, comercio, monto, tipo, category_id, hash_unico, es_demo)
        values (uid, a_efectivo, mes + d - 1, 'HOME DEPOT', 'Home Depot', round((250 + random() * 600)::numeric, 2), 'gasto', c_hogar, 'demo-' || gen_random_uuid(), true);
      end if;
      if d = 16 then
        insert into transactions (user_id, account_id, fecha, descripcion_original, comercio, monto, tipo, category_id, hash_unico, es_demo)
        values (uid, a_debito, mes + d - 1, 'FARMACIA GUADALAJARA', 'Farmacia Guadalajara', round((150 + random() * 400)::numeric, 2), 'gasto', c_salud, 'demo-' || gen_random_uuid(), true);
      end if;
    end loop;
  end loop;

  -- Gastos grandes al inicio del mes actual para que el dashboard muestre
  -- una categoría "excedida" y otra "en riesgo" sin importar qué día sea.
  insert into transactions (user_id, account_id, fecha, descripcion_original, comercio, monto, tipo, category_id, hash_unico, es_demo) values
    (uid, a_credito, date_trunc('month', current_date)::date, 'RESTAURANTE PUJOL CENA CUMPLEANOS', 'Pujol', 2650, 'gasto', c_rest, 'demo-' || gen_random_uuid(), true),
    (uid, a_credito, date_trunc('month', current_date)::date, 'TICKETMASTER CONCIERTO', 'Ticketmaster', 1100, 'gasto', c_entre, 'demo-' || gen_random_uuid(), true);

  -- Algunos movimientos sin categoría para probar la bandeja "Por revisar"
  insert into transactions (user_id, account_id, fecha, descripcion_original, comercio, monto, tipo, category_id, requiere_revision, confianza, hash_unico, es_demo) values
    (uid, a_credito, current_date, 'MERPAGO*TIENDITA ONLINE', 'Mercado Pago', 389, 'gasto', null, true, 0.35, 'demo-' || gen_random_uuid(), true),
    (uid, a_credito, current_date, 'AMAZON MX MARKETPLACE', 'Amazon', 749, 'gasto', c_hogar, true, 0.55, 'demo-' || gen_random_uuid(), true),
    (uid, a_debito, current_date, 'OXXO 1234 CDMX', 'OXXO', 86.5, 'gasto', c_super, true, 0.5, 'demo-' || gen_random_uuid(), true);

  -- Reglas de ejemplo
  insert into categorization_rules (user_id, patron_texto, category_id) values
    (uid, 'netflix', c_subs), (uid, 'spotify', c_subs), (uid, 'uber eats', c_rest),
    (uid, 'walmart', c_super), (uid, 'cfe', c_serv)
  on conflict (user_id, patron_texto) do nothing;

  -- Metas de ahorro con aportaciones mensuales
  insert into savings_goals (user_id, nombre, monto_objetivo, fecha_objetivo, es_demo)
    values (uid, 'Viaje a Japón (demo)', 60000, (current_date + interval '10 months')::date, true) returning id into g_viaje;
  insert into savings_goals (user_id, nombre, monto_objetivo, fecha_objetivo, es_demo)
    values (uid, 'Fondo de emergencia (demo)', 90000, (current_date + interval '18 months')::date, true) returning id into g_fondo;

  for m in 0..5 loop
    insert into goal_contributions (user_id, goal_id, fecha, monto, nota) values
      (uid, g_viaje, (date_trunc('month', current_date) - make_interval(months => m))::date + 1, 3000, 'Aportación demo'),
      (uid, g_fondo, (date_trunc('month', current_date) - make_interval(months => m))::date + 1, 4500, 'Aportación demo');
  end loop;

  -- Pagos programados
  insert into scheduled_payments (user_id, nombre, monto, frecuencia, proximo_vencimiento, account_id, es_demo) values
    (uid, 'Renta (demo)', 9500, 'mensual', (current_date + 2), a_debito, true),
    (uid, 'Pago tarjeta de crédito (demo)', 7350, 'mensual', (current_date + 7), a_debito, true),
    (uid, 'Seguro de auto (demo)', 14800, 'anual', (current_date + 40), a_debito, true),
    (uid, 'Predial (demo)', 2300, 'unica', (current_date + 12), a_debito, true);
end $$;

revoke all on function public.cargar_datos_demo() from public, anon;
revoke all on function public.borrar_datos_demo() from public, anon;
grant execute on function public.cargar_datos_demo() to authenticated;
grant execute on function public.borrar_datos_demo() to authenticated;
