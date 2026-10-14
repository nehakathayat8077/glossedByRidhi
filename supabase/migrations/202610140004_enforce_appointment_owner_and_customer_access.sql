begin;

-- Match the existing admin gate in src/admin/AdminApp.jsx. This reads only
-- Supabase's server-managed app_metadata claim; it does not assign a role.
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

alter table public.appointments
  add column if not exists user_id uuid;

do $$
declare
  user_id_attnum smallint;
begin
  select attnum
    into user_id_attnum
  from pg_attribute
  where attrelid = 'public.appointments'::regclass
    and attname = 'user_id'
    and not attisdropped;

  if user_id_attnum is null then
    raise exception 'Could not find public.appointments.user_id after adding it.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.appointments'::regclass
      and contype = 'f'
      and user_id_attnum = any(conkey)
      and confrelid = 'auth.users'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete set null
      not valid;
  end if;
end;
$$;

create index if not exists appointments_user_id_created_at_idx
  on public.appointments (user_id, created_at desc);

-- Historical rows remain unassigned. Future authenticated customer inserts
-- get their owner from the verified JWT, never from client-supplied data.
drop trigger if exists appointments_assign_user_id on public.appointments;
drop trigger if exists appointments_set_owner on public.appointments;
drop trigger if exists appointments_set_user_id on public.appointments;
drop trigger if exists appointments_z_set_user_id on public.appointments;
drop trigger if exists appointments_zzzz_set_user_id on public.appointments;

create or replace function public.set_appointment_user_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

revoke all on function public.set_appointment_user_id() from public, anon, authenticated;

-- PostgreSQL runs same-kind triggers alphabetically. Running this last keeps
-- the owner correct even when the existing appointment validation trigger
-- also assigns user_id.
create trigger appointments_zzzz_set_user_id
  before insert on public.appointments
  for each row execute function public.set_appointment_user_id();

alter table public.appointments enable row level security;

-- Remove permissive legacy appointment policies, including unrestricted
-- authenticated access, and recreate only guest/customer/admin access.
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'appointments'
  loop
    execute format('drop policy %I on public.appointments', existing_policy.policyname);
  end loop;
end;
$$;

revoke all privileges on table public.appointments from public, anon, authenticated;

-- Customers need read access to their own rows and booking insert fields only.
-- Admin UI reads rows and updates status; RLS allows that only for app admins.
grant select, update (status) on public.appointments to authenticated;
grant insert (name, phone, email, service_id, design_id, appointment_date, time_slot, notes)
  on public.appointments to authenticated;
grant insert (name, phone, email, service_id, design_id, appointment_date, time_slot, notes)
  on public.appointments to anon;

create policy "Public can request appointments"
  on public.appointments
  for insert
  to anon
  with check (status = 'pending' and user_id is null);

create policy "Customers can request appointments"
  on public.appointments
  for insert
  to authenticated
  with check (status = 'pending' and user_id = (select auth.uid()));

create policy "Customers can read own appointments"
  on public.appointments
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Admins can manage appointments"
  on public.appointments
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

notify pgrst, 'reload schema';

commit;
