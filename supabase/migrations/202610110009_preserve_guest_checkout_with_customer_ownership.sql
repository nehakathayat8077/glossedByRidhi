begin;

alter table public.orders
  add column if not exists user_id uuid;

alter table public.appointments
  add column if not exists customer_id uuid,
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
    where constraint_row.conrelid = 'public.appointments'::regclass
      and constraint_row.confrelid = 'auth.users'::regclass
      and constraint_row.contype = 'f'
      and column_info.attname = 'customer_id'
  ) then
    alter table public.appointments
      add constraint appointments_customer_id_fkey
      foreign key (customer_id) references auth.users(id) on delete set null
      not valid;
  end if;
end;
$$;

-- Link appointments only when their existing customer_id already records the
-- authenticated owner. Historical orders and ownerless appointments stay NULL.
update public.appointments
set user_id = customer_id
where user_id is null
  and customer_id is not null;

create index if not exists orders_user_id_created_at_idx
  on public.orders (user_id, created_at desc);
create index if not exists appointments_user_id_created_at_idx
  on public.appointments (user_id, created_at desc);

create or replace function public.assign_appointment_user_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    new.user_id := auth.uid();
    new.customer_id := auth.uid();
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
  new.user_id := auth.uid();
  return new;
end;
$$;

revoke all on function public.assign_order_user_id() from public;
drop trigger if exists orders_assign_user_id on public.orders;
create trigger orders_assign_user_id
  before insert on public.orders
  for each row execute function public.assign_order_user_id();

alter table public.orders enable row level security;
alter table public.appointments enable row level security;

grant select on public.orders, public.appointments to authenticated;
revoke all privileges on table public.appointments from anon;
grant insert (name, phone, email, service_id, design_id, appointment_date, time_slot, notes)
  on public.appointments to anon;

drop policy if exists "Public can request appointments" on public.appointments;
create policy "Public can request appointments"
  on public.appointments for insert to anon
  with check (status = 'pending' and customer_id is null and user_id is null);

drop policy if exists "Customers can request appointments" on public.appointments;
create policy "Customers can request appointments"
  on public.appointments for insert to authenticated
  with check (
    status = 'pending'
    and customer_id = auth.uid()
    and user_id = auth.uid()
  );

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'services'
      and policyname = 'Customers can read active services'
  ) then
    create policy "Customers can read active services"
      on public.services for select to authenticated
      using (is_active);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'designs'
      and policyname = 'Customers can read active designs'
  ) then
    create policy "Customers can read active designs"
      on public.designs for select to authenticated
      using (is_active);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and policyname = 'Customers can read own orders'
  ) then
    create policy "Customers can read own orders"
      on public.orders for select to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'appointments'
      and policyname = 'Customers can read own appointments'
  ) then
    create policy "Customers can read own appointments"
      on public.appointments for select to authenticated
      using (user_id = auth.uid());
  end if;
end;
$$;

-- Keep the existing checkout validation and pricing behavior, but allow the
-- database to attach auth.uid() when signed in and NULL for guest checkout.
do $$
declare
  existing_function record;
begin
  for existing_function in
    select procedure_row.oid::regprocedure as signature
    from pg_proc as procedure_row
    join pg_namespace as namespace_row on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'create_order'
  loop
    execute format('drop function %s', existing_function.signature);
  end loop;
end;
$$;

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
    auth.uid()
  )
  returning id into new_order_id;

  return query select new_order_id, final_total;
end;
$$;

revoke all on function public.create_order(text, text, text, jsonb, text) from public;
grant execute on function public.create_order(text, text, text, jsonb, text) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
