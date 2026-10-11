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
  name text not null,
  phone text not null,
  email text not null,
  service_id uuid references public.services(id) on delete set null,
  appointment_date date not null,
  time_slot time not null,
  notes text,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create unique index if not exists appointments_one_active_booking_per_slot
  on public.appointments (appointment_date, time_slot)
  where status <> 'cancelled';

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  address text not null,
  items jsonb not null default '[]'::jsonb,
  total numeric(10, 2) not null check (total >= 0),
  status text not null default 'new'
    check (status in ('new', 'paid', 'shipped', 'delivered', 'cancelled')),
  created_at timestamptz not null default now()
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
alter table public.newsletter_subscribers enable row level security;
alter table public.business_settings enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.services, public.designs, public.products, public.business_settings to anon;
grant insert (name, phone, email, service_id, appointment_date, time_slot, notes)
  on public.appointments to anon;
grant insert (email) on public.newsletter_subscribers to anon;
grant select, insert, update, delete
  on public.services, public.designs, public.products, public.appointments,
     public.orders, public.newsletter_subscribers, public.business_settings
  to authenticated;

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
