create extension if not exists pgcrypto;

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text,
  price numeric(10, 2) not null check (price >= 0),
  duration_minutes integer check (duration_minutes > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.services
  add column if not exists image_url text;

create table if not exists public.designs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10, 2) not null check (price >= 0),
  discount_percent numeric(5, 2) check (discount_percent between 0 and 100),
  image_url text,
  stock integer check (stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references auth.users(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  phone text not null,
  email text not null,
  service_id uuid references public.services(id) on delete set null,
  design_id uuid references public.designs(id) on delete set null,
  appointment_date date not null,
  time_slot time not null,
  notes text,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists appointments_one_active_booking_per_slot
  on public.appointments (appointment_date, time_slot)
  where status <> 'cancelled';

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  phone text not null,
  address text not null,
  items jsonb not null default '[]'::jsonb,
  total numeric(10, 2) not null check (total >= 0),
  status text not null default 'new'
    check (status in ('new', 'paid', 'shipped', 'delivered', 'cancelled')),
  payment_method text
    check (payment_method is null or payment_method in ('cod', 'qr_whatsapp')),
  payment_status text
    check (payment_status is null or payment_status in ('pending', 'paid', 'failed', 'refunded')),
  created_at timestamptz not null default now()
);

create table if not exists public.customer_store_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cart jsonb not null default '[]'::jsonb
    check (jsonb_typeof(cart) = 'array'),
  wishlist jsonb not null default '[]'::jsonb
    check (jsonb_typeof(wishlist) = 'array')
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.business_settings (
  id uuid primary key default gen_random_uuid(),
  working_start time not null,
  working_end time not null,
  slot_duration_minutes integer not null check (slot_duration_minutes > 0),
  off_days integer[] not null default '{}',
  created_at timestamptz not null default now(),
  check (working_end > working_start),
  check (off_days <@ array[0, 1, 2, 3, 4, 5, 6])
);

alter table public.services enable row level security;
alter table public.designs enable row level security;
alter table public.products enable row level security;
alter table public.appointments enable row level security;
alter table public.orders enable row level security;
alter table public.customer_store_state enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.business_settings enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.services, public.designs, public.products, public.business_settings to anon;
grant insert (name, phone, email, service_id, design_id, appointment_date, time_slot, notes)
  on public.appointments to anon;
grant insert (email) on public.newsletter_subscribers to anon;
grant select, insert, update, delete
  on public.services, public.designs, public.products,
     public.newsletter_subscribers, public.business_settings
  to authenticated;
revoke all privileges on public.orders from public, anon, authenticated;
grant select, update (status) on public.orders to authenticated;
revoke all privileges on public.customer_store_state from public, anon, authenticated;
grant select, insert, update on public.customer_store_state to authenticated;
revoke update on public.appointments from public, anon, authenticated;
grant select, insert, delete on public.appointments to authenticated;
grant update (status) on public.appointments to authenticated;

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

create or replace function public.prepare_appointment_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_service boolean;
  active_design boolean;
  settings record;
begin
  if not public.is_admin() then
    new.id := gen_random_uuid();
    new.customer_id := auth.uid();
    new.user_id := auth.uid();
    new.status := 'pending';
    new.created_at := now();
  end if;

  if length(trim(coalesce(new.name, ''))) < 2 or length(trim(new.name)) > 120 then
    raise exception 'Enter a name between 2 and 120 characters.';
  end if;
  if length(regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g')) < 7
    or length(regexp_replace(new.phone, '[^0-9]', '', 'g')) > 15 then
    raise exception 'Enter a valid phone number.';
  end if;
  if new.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email address.';
  end if;
  if new.appointment_date < current_date then
    raise exception 'Appointment date must be today or later.';
  end if;
  if new.service_id is null then
    raise exception 'Select a service.';
  end if;

  select s.is_active into active_service
  from public.services as s
  where s.id = new.service_id;
  if not found or not active_service then
    raise exception 'The selected service is no longer available.';
  end if;

  if new.design_id is not null then
    select d.is_active into active_design
    from public.designs as d
    where d.id = new.design_id;
    if not found or not active_design then
      raise exception 'The selected nail design is no longer available.';
    end if;
  end if;

  if length(coalesce(new.notes, '')) > 2000 then
    raise exception 'Appointment notes must be 2,000 characters or fewer.';
  end if;

  select bs.working_start, bs.working_end, bs.slot_duration_minutes, bs.off_days
    into settings
    from public.business_settings as bs
    order by bs.created_at
    limit 1;

  if found then
    if extract(dow from new.appointment_date)::integer = any(settings.off_days) then
      raise exception 'The studio is closed on the selected date.';
    end if;
    if new.time_slot < settings.working_start
      or new.time_slot + make_interval(mins => settings.slot_duration_minutes) > settings.working_end
      or mod(extract(epoch from (new.time_slot - settings.working_start))::integer, settings.slot_duration_minutes) <> 0 then
      raise exception 'Choose a time slot within the studio hours.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

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

revoke all on function public.prepare_appointment_request() from public;

create trigger appointments_prepare_request
  before insert on public.appointments
  for each row execute function public.prepare_appointment_request();

create or replace function public.touch_appointment_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_appointment_updated_at() from public;

create trigger appointments_touch_updated_at
  before update on public.appointments
  for each row execute function public.touch_appointment_updated_at();

create policy "Public can read active services"
  on public.services for select to anon using (is_active);
create policy "Public can read active designs"
  on public.designs for select to anon using (is_active);
create policy "Public can read active products"
  on public.products for select to anon using (is_active);
create policy "Public can request appointments"
  on public.appointments for insert to anon
  with check (status = 'pending' and customer_id is null and user_id is null);
create policy "Customers can request appointments"
  on public.appointments for insert to authenticated
  with check (status = 'pending' and customer_id = auth.uid() and user_id = auth.uid());
create policy "Customers can read own appointments"
  on public.appointments for select to authenticated using (user_id = auth.uid());
create policy "Customers can read own orders"
  on public.orders for select to authenticated using (user_id = auth.uid());
create policy "Customers can read own store state"
  on public.customer_store_state for select to authenticated
  using (user_id = auth.uid());
create policy "Customers can insert own store state"
  on public.customer_store_state for insert to authenticated
  with check (user_id = auth.uid());
create policy "Customers can update own store state"
  on public.customer_store_state for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "Customers can read active services"
  on public.services for select to authenticated using (is_active);
create policy "Customers can read active designs"
  on public.designs for select to authenticated using (is_active);
create policy "Public can subscribe to newsletter"
  on public.newsletter_subscribers for insert to anon with check (true);
create policy "Public can read business settings"
  on public.business_settings for select to anon using (true);

create policy "Admins can manage services"
  on public.services for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins can manage designs"
  on public.designs for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins can manage products"
  on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins can manage appointments"
  on public.appointments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins can manage orders"
  on public.orders for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins can manage subscribers"
  on public.newsletter_subscribers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins can manage business settings"
  on public.business_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.get_booked_slots(p_date date)
returns table (time_slot time)
language sql
stable
security definer
set search_path = ''
as $$
  select a.time_slot
  from public.appointments as a
  where a.appointment_date = p_date
    and a.status <> 'cancelled'
  order by a.time_slot;
$$;

revoke all on function public.get_booked_slots(date) from public;
grant execute on function public.get_booked_slots(date) to anon, authenticated;

insert into public.services (id, name, description, price) values
  ('10000000-0000-4000-8000-000000000001', 'Classic Manicure', 'Shape, cuticle care and a flawless polish finish.', 499),
  ('10000000-0000-4000-8000-000000000002', 'Gel Nails', 'Glossy colour that stays chip-free for weeks.', 799),
  ('10000000-0000-4000-8000-000000000003', 'Nail Extensions', 'Sculpted length in the shape you love.', 1299),
  ('10000000-0000-4000-8000-000000000004', 'Custom Nail Art', 'Hand-painted designs made from your idea.', 999)
on conflict (id) do nothing;

insert into public.designs (id, title, category, image_url) values
  ('20000000-0000-4000-8000-000000000001', 'Blush Milk Bath', 'Minimal', '/images/designs/design-01.jpg'),
  ('20000000-0000-4000-8000-000000000002', 'Champagne French', 'French', '/images/designs/design-07.jpg'),
  ('20000000-0000-4000-8000-000000000003', 'Rose Chrome', 'Chrome', '/images/designs/design-03.jpg'),
  ('20000000-0000-4000-8000-000000000004', 'Wild Peony', 'Floral', '/images/designs/design-04.jpg'),
  ('20000000-0000-4000-8000-000000000005', 'Veil & Pearl', 'Bridal', '/images/designs/design-08.jpg'),
  ('20000000-0000-4000-8000-000000000006', 'Midnight Sparkle', 'Party', '/images/designs/design-06.jpg')
on conflict (id) do nothing;

insert into public.products (id, name, price, discount_percent, image_url) values
  ('30000000-0000-4000-8000-000000000001', 'Press-On Nails', 699, 22, 'https://picsum.photos/seed/p1/600/700'),
  ('30000000-0000-4000-8000-000000000002', 'Nail Art Stickers', 249, null, 'https://picsum.photos/seed/p2/600/700'),
  ('30000000-0000-4000-8000-000000000003', 'Nail Care Kit', 599, 20, 'https://picsum.photos/seed/p3/600/700'),
  ('30000000-0000-4000-8000-000000000004', 'Cuticle Oil', 299, null, 'https://picsum.photos/seed/p4/600/700'),
  ('30000000-0000-4000-8000-000000000005', 'Nail File Kit', 349, 13, 'https://picsum.photos/seed/p5/600/700'),
  ('30000000-0000-4000-8000-000000000006', 'Gift Box', 1299, 19, 'https://picsum.photos/seed/p6/600/700')
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do update set public = excluded.public;

create policy "Public can read images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'images');
create policy "Admins can manage images"
  on storage.objects for all to authenticated
  using (bucket_id = 'images' and public.is_admin())
  with check (bucket_id = 'images' and public.is_admin());
