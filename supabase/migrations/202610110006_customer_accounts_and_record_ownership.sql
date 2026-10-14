begin;

-- Preserve the existing appointments.customer_id ownership reference while
-- adding a consistent user_id column for customer account history.
alter table public.appointments
  add column if not exists user_id uuid;

alter table public.orders
  add column if not exists user_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint as constraint_row
    join unnest(constraint_row.conkey) as key_column(attnum) on true
    join pg_attribute as column_info
      on column_info.attrelid = constraint_row.conrelid
     and column_info.attnum = key_column.attnum
    where constraint_row.conrelid = 'public.appointments'::regclass
      and constraint_row.confrelid = 'auth.users'::regclass
      and constraint_row.contype = 'f'
      and column_info.attname = 'user_id'
  ) then
    alter table public.appointments
      add constraint appointments_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete set null
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint as constraint_row
    join unnest(constraint_row.conkey) as key_column(attnum) on true
    join pg_attribute as column_info
      on column_info.attrelid = constraint_row.conrelid
     and column_info.attnum = key_column.attnum
    where constraint_row.conrelid = 'public.orders'::regclass
      and constraint_row.confrelid = 'auth.users'::regclass
      and constraint_row.contype = 'f'
      and column_info.attname = 'user_id'
  ) then
    alter table public.orders
      add constraint orders_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete set null
      not valid;
  end if;
end;
$$;

-- Existing appointment ownership can be safely carried forward; historical
-- orders remain unassigned because the old schema did not record their owner.
update public.appointments
set user_id = customer_id
where user_id is null
  and customer_id is not null;

create index if not exists appointments_user_id_created_at_idx
  on public.appointments (user_id, created_at desc);

create index if not exists orders_user_id_created_at_idx
  on public.orders (user_id, created_at desc);

create or replace function public.assign_appointment_user_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    if auth.uid() is null then
      raise exception 'Sign in before requesting an appointment.';
    end if;
    new.user_id := auth.uid();
  end if;

  return new;
end;
$$;

revoke all on function public.assign_appointment_user_id() from public;
drop trigger if exists appointments_assign_user_id on public.appointments;
create trigger appointments_assign_user_id
  before insert on public.appointments
  for each row execute function public.assign_appointment_user_id();

create or replace function public.assign_order_user_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in before placing an order.';
  end if;

  new.user_id := auth.uid();
  return new;
end;
$$;

revoke all on function public.assign_order_user_id() from public;
drop trigger if exists orders_assign_user_id on public.orders;
create trigger orders_assign_user_id
  before insert on public.orders
  for each row execute function public.assign_order_user_id();

alter table public.appointments enable row level security;
alter table public.orders enable row level security;

-- Guest appointment and order writes are no longer permitted. Orders are
-- created only through the authenticated SECURITY DEFINER checkout RPC.
revoke all privileges on public.appointments from public, anon;
revoke all privileges on public.orders from public, anon;
drop policy if exists "Public can request appointments" on public.appointments;

grant select, insert, update, delete on public.appointments to authenticated;
grant select, insert, update, delete on public.orders to authenticated;

drop policy if exists "Customers can request appointments" on public.appointments;
create policy "Customers can request appointments"
  on public.appointments for insert to authenticated
  with check (
    status = 'pending'
    and user_id = auth.uid()
    and customer_id = auth.uid()
  );

drop policy if exists "Customers can read own appointments" on public.appointments;
create policy "Customers can read own appointments"
  on public.appointments for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Customers can read own orders" on public.orders;
create policy "Customers can read own orders"
  on public.orders for select to authenticated
  using (user_id = auth.uid());

-- The existing admin policies remain in place. A customer has no UPDATE or
-- DELETE policy, so order totals/payment fields and booking statuses stay admin-controlled.
-- Also disable older overloaded signatures left by prior migrations without
-- dropping functions that may still be referenced by existing clients.
do $$
declare
  order_function record;
begin
  for order_function in
    select procedure_row.oid::regprocedure::text as signature
    from pg_proc as procedure_row
    join pg_namespace as namespace_row on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'create_order'
  loop
    execute format(
      'revoke all on function %s from public, anon',
      order_function.signature
    );
  end loop;
end;
$$;

grant execute on function public.create_order(text, text, jsonb, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
