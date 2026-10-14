begin;

do $$
declare
  admin_definition text;
  checkout_definition text;
  checkout_argument_names text[];
  checkout_result text;
  checkout_is_security_definer boolean;
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'public.is_admin() is missing; inspect the current administrator authorization before applying.';
  end if;

  select pg_get_functiondef('public.is_admin()'::regprocedure)
    into admin_definition;

  if admin_definition not ilike '%app_metadata%'
    or admin_definition not ilike '%role%'
    or admin_definition not ilike '%admin%'
    or not exists (
      select 1
      from pg_proc
      where oid = 'public.is_admin()'::regprocedure
        and prosecdef
        and proconfig @> array['search_path=""']
    )
  then
    raise exception 'public.is_admin() does not match the trusted app_metadata role check; inspect it before applying.';
  end if;

  if to_regprocedure('public.create_order(text,text,jsonb,text,text)') is null then
    raise exception 'The existing create_order checkout RPC is missing; inspect the current checkout schema before applying.';
  end if;

  select
    p.proargnames[1:5]::text[],
    pg_get_function_result(p.oid),
    p.prosecdef,
    pg_get_functiondef(p.oid)
    into
      checkout_argument_names,
      checkout_result,
      checkout_is_security_definer,
      checkout_definition
    from pg_proc as p
    where p.oid = 'public.create_order(text,text,jsonb,text,text)'::regprocedure;

  if checkout_argument_names is distinct from array[
       'p_address',
       'p_customer_name',
       'p_items',
       'p_payment_method',
       'p_phone'
     ]::text[]
    or regexp_replace(lower(coalesce(checkout_result, '')), '\s+', '', 'g')
      <> 'table(order_iduuid,order_totalnumeric)'
    or not checkout_is_security_definer
    or checkout_definition not ilike '%payment_status%'
  then
    raise exception 'The existing create_order RPC does not match the expected secure checkout arguments or return columns; inspect it before applying.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'user_id'
  ) then
    raise exception 'public.orders.user_id is missing; apply the customer order ownership migration first.';
  end if;
end;
$$;

grant execute on function public.create_order(text, text, jsonb, text, text)
  to anon, authenticated;

-- Resolve account emails to verified auth.users IDs only in this admin-only
-- lookup. All order creation and repair calls use the returned UUID.
create or replace function public.admin_find_customer_by_email(p_customer_email text)
returns table (user_id uuid, email text, full_name text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only administrators can look up customer accounts.';
  end if;

  if coalesce(length(trim(p_customer_email)), 0) = 0 then
    raise exception 'Enter the email address on the customer account.';
  end if;

  return query
    select u.id, u.email::text, coalesce(u.raw_user_meta_data ->> 'full_name', '')
    from auth.users as u
    where lower(u.email) = lower(trim(p_customer_email));
end;
$$;

revoke all on function public.admin_find_customer_by_email(text)
  from public, anon, authenticated;
grant execute on function public.admin_find_customer_by_email(text)
  to authenticated;

-- Replace the email-based creation RPC with one that requires the resolved
-- Supabase Auth UUID. Checkout validation/pricing remains centralized in
-- public.create_order; only this admin RPC can attach a different owner.
drop function if exists public.admin_create_order(text, text, text, text, jsonb, text);

create function public.admin_create_order(
  p_customer_id uuid,
  p_customer_name text,
  p_phone text,
  p_address text,
  p_items jsonb,
  p_payment_method text
)
returns table (order_id uuid, order_total numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_order_id uuid;
  created_order_total numeric;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can create orders for customers.';
  end if;

  if p_customer_id is null or not exists (
    select 1 from auth.users as u where u.id = p_customer_id
  ) then
    raise exception 'Select a valid customer account before creating the order.';
  end if;

  select created.order_id, created.order_total
    into created_order_id, created_order_total
    from public.create_order(
      p_address,
      p_customer_name,
      p_items,
      p_payment_method,
      p_phone
    ) as created;

  update public.orders
    set user_id = p_customer_id
    where id = created_order_id;

  if not found or not exists (
    select 1 from public.orders as o
    where o.id = created_order_id
      and o.user_id = p_customer_id
  ) then
    raise exception 'The created order could not be linked to the selected customer account.';
  end if;

  return query select created_order_id, created_order_total;
end;
$$;

revoke all on function public.admin_create_order(uuid, text, text, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.admin_create_order(uuid, text, text, text, jsonb, text)
  to authenticated;

-- Historical NULL-owner orders are linked only when an administrator
-- supplies both the order ID and a verified customer UUID. Never infer owners
-- from order names, email snapshots, or phone numbers.
create or replace function public.admin_link_order_to_customer(
  p_order_id uuid,
  p_customer_id uuid
)
returns table (order_id uuid, user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only administrators can link orders to customer accounts.';
  end if;

  if p_order_id is null or p_customer_id is null
    or not exists (
      select 1 from auth.users as u where u.id = p_customer_id
    )
  then
    raise exception 'Select an existing order and a verified customer account.';
  end if;

  update public.orders
    set user_id = p_customer_id
    where id = p_order_id
      and user_id is null;

  if not found then
    raise exception 'The order was not found or is already linked to an account.';
  end if;

  return query select p_order_id, p_customer_id;
end;
$$;

revoke all on function public.admin_link_order_to_customer(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_link_order_to_customer(uuid, uuid)
  to authenticated;

notify pgrst, 'reload schema';

commit;
