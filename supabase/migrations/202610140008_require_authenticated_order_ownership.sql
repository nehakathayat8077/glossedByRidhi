begin;

do $$
declare
  orders_rls_enabled boolean;
  checkout_function record;
begin
  if to_regprocedure('public.create_order(text,text,jsonb,text,text)') is null then
    raise exception 'Expected public.create_order(text,text,jsonb,text,text); inspect the live checkout RPC before applying.';
  end if;

  if to_regprocedure('public.admin_create_order(uuid,text,text,text,jsonb,text)') is null then
    raise exception 'Expected the existing admin_create_order RPC; apply the customer order ownership migration first.';
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

  select c.relrowsecurity
    into orders_rls_enabled
    from pg_class as c
    where c.oid = 'public.orders'::regclass;

  if not coalesce(orders_rls_enabled, false) then
    raise exception 'Row-level security is not enabled on public.orders.';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and policyname = 'Customers can read own orders'
      and cmd = 'SELECT'
      and roles @> array['authenticated']::name[]
      and qual ilike '%user_id%'
      and qual ilike '%auth.uid%'
  ) then
    raise exception 'The customer owner-only orders read policy is missing; restore customer order ownership policies first.';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and policyname = 'Admins can manage orders'
      and cmd = 'ALL'
      and roles @> array['authenticated']::name[]
      and qual ilike '%is_admin%'
      and with_check ilike '%is_admin%'
  ) then
    raise exception 'The administrator orders policy is missing; restore administrator order access first.';
  end if;

  for checkout_function in
    select p.oid::regprocedure as signature
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_order'
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      checkout_function.signature
    );
  end loop;
end;
$$;

-- Checkout is account-only. The admin creation RPC remains usable by an
-- authenticated administrator and reassigns the resulting order to its
-- explicitly selected customer UUID after checkout validation succeeds.
create or replace function public.create_order(
  p_address text,
  p_customer_name text,
  p_items jsonb,
  p_payment_method text,
  p_phone text
)
returns table (order_id uuid, order_total numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := auth.uid();
  item jsonb;
  product_id uuid;
  quantity integer;
  product_record record;
  merchandise_total numeric(10, 2) := 0;
  order_items jsonb := '[]'::jsonb;
  new_order_id uuid;
  final_total numeric(10, 2);
begin
  if authenticated_user_id is null then
    raise exception 'Sign in before placing an order.';
  end if;

  if coalesce(length(trim(p_customer_name)), 0) < 2
    or length(trim(p_customer_name)) > 120
    or length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) not between 7 and 15
    or coalesce(length(trim(p_address)), 0) < 5
    or length(trim(p_address)) > 1000
  then
    raise exception 'Please provide a valid name, phone number, and delivery address.';
  end if;

  if p_payment_method is null
    or p_payment_method not in ('cod', 'qr_whatsapp')
  then
    raise exception 'Choose Cash on Delivery or QR payment through WhatsApp.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Order items must be provided as a list.';
  end if;

  if jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'An order must contain between 1 and 50 item lines.';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(item) <> 'object' then
      raise exception 'An order item is invalid.';
    end if;

    begin
      product_id := (item ->> 'id')::uuid;
      quantity := (item ->> 'qty')::integer;
    exception when others then
      raise exception 'An order item has an invalid product ID or quantity.';
    end;

    if quantity is null or quantity < 1 or quantity > 100 then
      raise exception 'Order quantity must be between 1 and 100.';
    end if;

    select p.id, p.name, p.price, p.stock
      into product_record
      from public.products as p
      where p.id = product_id
        and p.is_active = true
      for share;

    if not found then
      raise exception 'One of the selected products is no longer available.';
    end if;

    if product_record.stock is not null and product_record.stock < quantity + coalesce((
      select sum((previous_item.value ->> 'qty')::integer)
      from jsonb_array_elements(order_items) as previous_item(value)
      where previous_item.value ->> 'id' = product_record.id::text
    ), 0) then
      raise exception 'There is not enough stock for %.', product_record.name;
    end if;

    merchandise_total := merchandise_total + (product_record.price * quantity);
    order_items := order_items || jsonb_build_array(jsonb_build_object(
      'id', product_record.id,
      'name', product_record.name,
      'qty', quantity,
      'unit_price', product_record.price,
      'line_total', product_record.price * quantity
    ));
  end loop;

  final_total := merchandise_total
    + case when merchandise_total <= 999 then 60 else 0 end;

  insert into public.orders (
    customer_name,
    phone,
    address,
    items,
    total,
    status,
    payment_method,
    payment_status,
    user_id
  )
  values (
    trim(p_customer_name),
    trim(p_phone),
    trim(p_address),
    order_items,
    final_total,
    'new',
    p_payment_method,
    'pending',
    authenticated_user_id
  )
  returning id into new_order_id;

  return query select new_order_id, final_total;
end;
$$;

grant execute on function public.create_order(text, text, jsonb, text, text)
  to authenticated;

notify pgrst, 'reload schema';

commit;
