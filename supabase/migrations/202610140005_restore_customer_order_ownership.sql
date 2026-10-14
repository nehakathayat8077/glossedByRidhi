begin;

-- Keep the database admin predicate aligned with AdminApp.jsx. It trusts only
-- Supabase-managed app_metadata and never infers admin access from email.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'admin', false);
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

alter table public.orders
  add column if not exists user_id uuid;

do $$
declare
  user_id_attnum smallint;
begin
  select attnum
    into user_id_attnum
  from pg_attribute
  where attrelid = 'public.orders'::regclass
    and attname = 'user_id'
    and not attisdropped;

  if user_id_attnum is null then
    raise exception 'Could not find public.orders.user_id after adding it.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and contype = 'f'
      and user_id_attnum = any(conkey)
      and confrelid = 'auth.users'::regclass
  ) then
    alter table public.orders
      add constraint orders_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete set null
      not valid;
  end if;
end;
$$;

create index if not exists orders_user_id_created_at_idx
  on public.orders (user_id, created_at desc);

-- New orders are linked to the authenticated caller. Existing rows are not
-- assigned by matching names or phone numbers.
drop trigger if exists orders_assign_user_id on public.orders;
drop trigger if exists orders_set_owner on public.orders;
drop trigger if exists orders_set_user_id on public.orders;
drop trigger if exists orders_zzzz_set_user_id on public.orders;

create or replace function public.set_order_user_id()
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

revoke all on function public.set_order_user_id()
  from public, anon, authenticated;

-- Ensure user_id is set from the request even for inserts made by the
-- SECURITY DEFINER create_order RPC.
create trigger orders_zzzz_set_user_id
  before insert on public.orders
  for each row execute function public.set_order_user_id();

alter table public.orders enable row level security;

-- Replace any legacy permissive order policies with owner/admin-only access.
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
  loop
    execute format('drop policy %I on public.orders', existing_policy.policyname);
  end loop;
end;
$$;

revoke all privileges on table public.orders from public, anon, authenticated;
grant select, update (status) on public.orders to authenticated;

-- Checkout remains through the existing SECURITY DEFINER RPC; guest checkout
-- remains supported by that function with a NULL user_id.
grant execute on function public.create_order(text, text, text, jsonb, text)
  to anon, authenticated;

create policy "Customers can read own orders"
  on public.orders
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Admins can manage orders"
  on public.orders
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

notify pgrst, 'reload schema';

commit;
