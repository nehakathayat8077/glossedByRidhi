begin;

alter table public.services
  add column if not exists image_url text;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'admin', false);
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

revoke all privileges on table
  public.services,
  public.designs,
  public.products,
  public.appointments,
  public.orders,
  public.newsletter_subscribers,
  public.business_settings
from public, anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.services, public.designs, public.products, public.business_settings to anon;
grant insert (name, phone, email, service_id, appointment_date, time_slot, notes)
  on public.appointments to anon;
grant insert (email) on public.newsletter_subscribers to anon;
grant select, insert, update, delete on
  public.services,
  public.designs,
  public.products,
  public.appointments,
  public.orders,
  public.newsletter_subscribers,
  public.business_settings
to authenticated;

-- Replace every policy on these project tables so any older permissive policy
-- cannot accidentally grant regular authenticated users access to admin data.
do $$
declare
  target_table text;
  existing_policy record;
begin
  foreach target_table in array array[
    'services',
    'designs',
    'products',
    'appointments',
    'orders',
    'newsletter_subscribers',
    'business_settings'
  ]
  loop
    for existing_policy in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = target_table
    loop
      execute format(
        'drop policy %I on public.%I',
        existing_policy.policyname,
        target_table
      );
    end loop;
  end loop;
end;
$$;

alter table public.services enable row level security;
alter table public.designs enable row level security;
alter table public.products enable row level security;
alter table public.appointments enable row level security;
alter table public.orders enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.business_settings enable row level security;

create policy "Public can read active services"
  on public.services for select to anon using (is_active);
create policy "Public can read active designs"
  on public.designs for select to anon using (is_active);
create policy "Public can read active products"
  on public.products for select to anon using (is_active);
create policy "Public can request appointments"
  on public.appointments for insert to anon with check (status = 'pending');
create policy "Public can subscribe to newsletter"
  on public.newsletter_subscribers for insert to anon with check (true);
create policy "Public can read business settings"
  on public.business_settings for select to anon using (true);

create policy "Admins can manage services"
  on public.services for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Admins can manage designs"
  on public.designs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Admins can manage products"
  on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Admins can manage appointments"
  on public.appointments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Admins can manage orders"
  on public.orders for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Admins can manage subscribers"
  on public.newsletter_subscribers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Admins can manage business settings"
  on public.business_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Product prices and order snapshots are calculated in Postgres rather than
-- trusted from an editable browser cart.
drop policy if exists "Public can submit orders" on public.orders;
revoke insert on public.orders from anon;

create or replace function public.create_order(
  p_customer_name text,
  p_phone text,
  p_address text,
  p_items jsonb
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
    or coalesce(length(trim(p_phone)), 0) < 7
    or coalesce(length(trim(p_address)), 0) < 5
  then
    raise exception 'Please provide valid customer details and at least one item.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Order items must be provided as a list.';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'Please provide at least one item.';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
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

    merchandise_total :=
      merchandise_total + (product_record.price * quantity);
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
    status
  )
  values (
    trim(p_customer_name),
    trim(p_phone),
    trim(p_address),
    order_items,
    final_total,
    'new'
  )
  returning id into new_order_id;

  return query select new_order_id, final_total;
end;
$$;

revoke all on function public.create_order(text, text, text, jsonb) from public;
grant execute on function public.create_order(text, text, text, jsonb) to anon, authenticated;

drop policy if exists "Public can read images" on storage.objects;
drop policy if exists "Authenticated users can manage images" on storage.objects;
drop policy if exists "Admins can manage images" on storage.objects;

create policy "Public can read images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'images');
create policy "Admins can manage images"
  on storage.objects for all to authenticated
  using (bucket_id = 'images' and public.is_admin())
  with check (bucket_id = 'images' and public.is_admin());

commit;
