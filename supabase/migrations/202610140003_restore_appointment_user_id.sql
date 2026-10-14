begin;

do $$
declare
  admin_definition text;
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'public.is_admin() is missing; inspect the current admin authorization before applying this migration.';
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
    raise exception 'public.is_admin() does not match the expected trusted app_metadata admin check; inspect it before applying.';
  end if;
end;
$$;

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

comment on column public.appointments.user_id is
  'Authenticated customer owner; NULL for guest and unassigned historical appointments.';

create index if not exists appointments_user_id_created_at_idx
  on public.appointments (user_id, created_at desc);

-- Do not guess owners for historical rows; their user_id stays NULL.
-- Keep the existing booking-validation trigger, and replace only ownership triggers.
drop trigger if exists appointments_assign_user_id on public.appointments;
drop trigger if exists appointments_set_owner on public.appointments;
drop trigger if exists appointments_set_user_id on public.appointments;

create or replace function public.set_appointment_user_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  new.user_id := auth.uid();
  return new;
end;
$$;

revoke all on function public.set_appointment_user_id() from public, anon, authenticated;

create trigger appointments_set_user_id
  before insert on public.appointments
  for each row execute function public.set_appointment_user_id();

alter table public.appointments enable row level security;

-- Remove permissive legacy policies, including the reported unrestricted
-- authenticated policy, then restore the intended guest, customer, and admin access.
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
grant select, insert, update, delete on public.appointments to authenticated;
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
