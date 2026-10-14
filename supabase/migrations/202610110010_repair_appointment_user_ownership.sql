begin;

-- Refuse to replace an unknown admin predicate or an unexpected booking RPC.
do $$
declare
  admin_definition text;
  order_definition text;
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'public.is_admin() does not exist; inspect the live admin authorization before applying.';
  end if;

  select pg_get_functiondef('public.is_admin()'::regprocedure)
    into admin_definition;

  if admin_definition is null
    or admin_definition not ilike '%app_metadata%'
    or admin_definition not ilike '%role%'
    or admin_definition not ilike '%admin%'
    or not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'is_admin'
        and p.prosecdef
        and p.proconfig @> array['search_path=""']
    )
  then
    raise exception 'Expected secure public.is_admin() using app_metadata role was not found; inspect the live function before applying.';
  end if;

  if to_regprocedure('public.create_order(text,text,text,jsonb,text)') is null then
    raise exception 'Expected public.create_order(text,text,text,jsonb,text) was not found; inspect the live RPC signature before applying.';
  end if;

  select pg_get_functiondef(
    'public.create_order(text,text,text,jsonb,text)'::regprocedure
  ) into order_definition;

  if order_definition not ilike '%security definer%'
    or order_definition not ilike '%orders%'
    or order_definition not ilike '%payment_status%'
  then
    raise exception 'The live create_order RPC does not match the expected secure checkout implementation; inspect it before applying.';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    where t.tgrelid = 'public.orders'::regclass
      and t.tgname = 'orders_guard_unpaid_status'
      and not t.tgisinternal
      and t.tgenabled <> 'D'
  ) then
    raise exception 'orders_guard_unpaid_status is missing or disabled; inspect payment protection before applying.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'appointments'
      and column_name = 'customer_id'
  ) then
    raise exception 'appointments.customer_id is missing; inspect the live booking schema before applying.';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'appointments'
      and policyname not in (
        'Public can request appointments',
        'Customers can request appointments',
        'Customers can read own appointments',
        'Admins can manage appointments'
      )
  ) or exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and policyname not in (
        'Customers can read own orders',
        'Admins can manage orders'
      )
  ) then
    raise exception 'Unexpected appointment/order RLS policy found. Review pg_policies and explicitly reconcile it before applying; no policy will be dropped.';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in ('appointments', 'orders')
      and policyname in ('Admins can manage appointments', 'Admins can manage orders')
      and (
        coalesce(qual, '') not ilike '%is_admin%'
        or coalesce(with_check, '') not ilike '%is_admin%'
      )
  ) then
    raise exception 'An existing admin policy is not restricted by public.is_admin(); inspect it before applying.';
  end if;
end;
$$;

alter table public.appointments
  add column if not exists user_id uuid references auth.users(id) on delete set null;

alter table public.orders
  add column if not exists user_id uuid references auth.users(id) on delete set null;

do $$
declare
  table_name text;
  user_id_attnum smallint;
begin
  foreach table_name in array array['appointments', 'orders']
  loop
    select attnum into user_id_attnum
    from pg_attribute
    where attrelid = format('public.%I', table_name)::regclass
      and attname = 'user_id'
      and not attisdropped;

    if exists (
      select 1
      from pg_constraint c
      where c.conrelid = format('public.%I', table_name)::regclass
        and c.contype = 'f'
        and user_id_attnum = any(c.conkey)
        and c.confrelid = 'auth.users'::regclass
        and c.confdeltype <> 'n'
    ) then
      raise exception 'Existing %.user_id foreign key does not use ON DELETE SET NULL; inspect before applying.', table_name;
    elsif not exists (
      select 1
      from pg_constraint c
      where c.conrelid = format('public.%I', table_name)::regclass
        and c.contype = 'f'
        and user_id_attnum = any(c.conkey)
        and c.confrelid = 'auth.users'::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (user_id) references auth.users(id) on delete set null not valid',
        table_name,
        table_name || '_user_id_fkey'
      );
    end if;
  end loop;
end;
$$;

-- Carry forward only an existing authenticated owner; never infer ownership
-- from customer name or phone.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'appointments'
      and column_name = 'customer_id'
  ) then
    execute '
      update public.appointments as a
      set user_id = a.customer_id
      where a.user_id is null
        and a.customer_id is not null
        and exists (select 1 from auth.users u where u.id = a.customer_id)
    ';
  end if;
end;
$$;

-- Keep compatibility ownership aligned with the canonical user_id field.
create or replace function public.set_appointment_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.user_id := auth.uid();
    new.customer_id := auth.uid();
  elsif not public.is_admin() then
    new.user_id := null;
    new.customer_id := null;
  end if;

  return new;
end;
$$;

revoke all on function public.set_appointment_owner() from public, anon, authenticated;

drop trigger if exists appointments_set_owner on public.appointments;
create trigger appointments_set_owner
  before insert on public.appointments
  for each row execute function public.set_appointment_owner();

create or replace function public.set_order_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.user_id := auth.uid();
  return new;
end;
$$;

revoke all on function public.set_order_owner() from public, anon, authenticated;

drop trigger if exists orders_set_owner on public.orders;
create trigger orders_set_owner
  before insert on public.orders
  for each row execute function public.set_order_owner();

-- The SECURITY DEFINER checkout RPC is left unchanged. This insert trigger
-- attaches the caller's authenticated owner (or NULL for guest checkout).

-- Ensure account ownership is enforced without deleting unrelated policies.
alter table public.appointments enable row level security;
alter table public.orders enable row level security;

drop policy if exists "Customers can read own appointments" on public.appointments;
create policy "Customers can read own appointments"
  on public.appointments for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Customers can read own orders" on public.orders;
create policy "Customers can read own orders"
  on public.orders for select to authenticated
  using (user_id = (select auth.uid()));

-- Preserve the known guest and authenticated booking policies if already
-- present; create missing policies only. Do not replace other policies.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'appointments'
      and policyname = 'Public can request appointments'
  ) then
    create policy "Public can request appointments"
      on public.appointments for insert to anon
      with check (status = 'pending' and user_id is null);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'appointments'
      and policyname = 'Customers can request appointments'
  ) then
    create policy "Customers can request appointments"
      on public.appointments for insert to authenticated
      with check (user_id = (select auth.uid()) and status = 'pending');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'appointments'
      and policyname = 'Admins can manage appointments'
  ) then
    create policy "Admins can manage appointments"
      on public.appointments for all to authenticated
      using (public.is_admin()) with check (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'orders'
      and policyname = 'Admins can manage orders'
  ) then
    create policy "Admins can manage orders"
      on public.orders for all to authenticated
      using (public.is_admin()) with check (public.is_admin());
  end if;
end;
$$;

-- Clear pre-existing table- and column-level write grants before restoring
-- the narrow appointment write surface and the established order permissions.
revoke all privileges on public.appointments, public.orders
  from public, anon, authenticated;
do $$
declare
  appointment_columns text;
  order_columns text;
begin
  select string_agg(format('%I', attname), ', ')
    into appointment_columns
    from pg_attribute
    where attrelid = 'public.appointments'::regclass
      and attnum > 0 and not attisdropped;
  select string_agg(format('%I', attname), ', ')
    into order_columns
    from pg_attribute
    where attrelid = 'public.orders'::regclass
      and attnum > 0 and not attisdropped;

  execute format(
    'revoke insert (%1$s), update (%1$s) on public.appointments from public, anon, authenticated',
    appointment_columns
  );
  execute format(
    'revoke insert (%1$s), update (%1$s) on public.orders from public, anon, authenticated',
    order_columns
  );
end;
$$;

grant select on public.appointments to authenticated;
grant insert (name, phone, email, service_id, appointment_date, time_slot, notes)
  on public.appointments to anon;
grant insert (name, phone, email, service_id, appointment_date, time_slot, notes)
  on public.appointments to authenticated;
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'appointments'
      and column_name = 'design_id'
  ) then
    execute 'grant insert (name, phone, email, service_id, design_id, appointment_date, time_slot, notes) on public.appointments to anon, authenticated';
  end if;
end;
$$;
grant update (status) on public.appointments to authenticated;

grant select, insert, update, delete on public.orders to authenticated;
grant execute on function public.create_order(text, text, text, jsonb, text)
  to anon, authenticated;

notify pgrst, 'reload schema';
commit;
