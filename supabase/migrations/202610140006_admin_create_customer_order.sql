begin;

do $$
declare
  admin_definition text;
  checkout_definition text;
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

  if to_regprocedure('public.create_order(text,text,text,jsonb,text)') is null then
    raise exception 'The existing create_order checkout RPC is missing; inspect the current checkout schema before applying.';
  end if;

  select pg_get_functiondef(
    'public.create_order(text,text,text,jsonb,text)'::regprocedure
  ) into checkout_definition;

  if checkout_definition not ilike '%security definer%'
    or checkout_definition not ilike '%payment_status%'
  then
    raise exception 'The existing create_order RPC does not match the secure checkout implementation; inspect it before applying.';
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

-- Admin-created orders resolve ownership from a customer's account email.
-- Customer names and phone numbers are never used to infer an account owner.
create or replace function public.admin_create_order(
  p_customer_email text,
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
  target_user_id uuid;
  created_order_id uuid;
  created_order_total numeric;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can create orders for customers.';
  end if;

  if coalesce(length(trim(p_customer_email)), 0) = 0 then
    raise exception 'Enter the email address on the customer account.';
  end if;

  select u.id
    into target_user_id
    from auth.users as u
    where lower(u.email) = lower(trim(p_customer_email));

  if target_user_id is null then
    raise exception 'No customer account was found for that email address.';
  end if;

  select created.order_id, created.order_total
    into created_order_id, created_order_total
    from public.create_order(
      p_customer_name,
      p_phone,
      p_address,
      p_items,
      p_payment_method
    ) as created;

  update public.orders
    set user_id = target_user_id
    where id = created_order_id;

  if not found then
    raise exception 'The created order could not be linked to the customer account.';
  end if;

  return query select created_order_id, created_order_total;
end;
$$;

revoke all on function public.admin_create_order(text, text, text, text, jsonb, text)
  from public, anon;
grant execute on function public.admin_create_order(text, text, text, text, jsonb, text)
  to authenticated;

notify pgrst, 'reload schema';

commit;
