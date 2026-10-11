begin;

-- Existing orders have no recorded payment method. Keep those values NULL
-- rather than guessing how historical orders were paid.
alter table public.orders
  add column if not exists payment_method text,
  add column if not exists payment_status text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_payment_method_check'
  ) then
    alter table public.orders
      add constraint orders_payment_method_check
      check (payment_method is null or payment_method in ('cod', 'qr_whatsapp'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_payment_status_check'
  ) then
    alter table public.orders
      add constraint orders_payment_status_check
      check (payment_status is null or payment_status in ('pending', 'paid', 'failed', 'refunded'));
  end if;
end;
$$;

-- The previous four-argument function is removed so PostgREST cannot resolve
-- an ambiguous overload and the new client call has one exact RPC signature.
drop function if exists public.create_order(text, text, text, jsonb);
drop function if exists public.create_order(text, text, text, jsonb, text);

create function public.create_order(
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
  item jsonb;
  product_id uuid;
  quantity integer;
  product_record record;
  merchandise_total numeric(10, 2) := 0;
  order_items jsonb := '[]'::jsonb;
  new_order_id uuid;
  final_total numeric(10, 2);
begin
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
    payment_status
  )
  values (
    trim(p_customer_name),
    trim(p_phone),
    trim(p_address),
    order_items,
    final_total,
    'new',
    p_payment_method,
    'pending'
  )
  returning id into new_order_id;

  return query select new_order_id, final_total;
end;
$$;

revoke all on function public.create_order(text, text, text, jsonb, text) from public;
grant execute on function public.create_order(text, text, text, jsonb, text) to anon, authenticated;

-- Keep direct public order reads/writes closed; order creation is only via
-- the narrow RPC above, while existing admin RLS policies remain in force.
revoke all privileges on public.orders from anon;
alter table public.orders enable row level security;

notify pgrst, 'reload schema';

commit;
