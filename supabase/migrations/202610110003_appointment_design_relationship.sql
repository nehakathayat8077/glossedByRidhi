begin;

alter table public.appointments
  add column if not exists design_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint as constraint_row
    join unnest(constraint_row.conkey) as key_column(attnum) on true
    join pg_attribute as column_info
      on column_info.attrelid = constraint_row.conrelid
     and column_info.attnum = key_column.attnum
    where constraint_row.conrelid = 'public.appointments'::regclass
      and constraint_row.confrelid = 'public.designs'::regclass
      and constraint_row.contype = 'f'
      and column_info.attname = 'design_id'
  ) then
    alter table public.appointments
      add constraint appointments_design_id_fkey
      foreign key (design_id)
      references public.designs (id)
      on delete set null
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
      and constraint_row.confrelid = 'public.services'::regclass
      and constraint_row.contype = 'f'
      and column_info.attname = 'service_id'
  ) then
    alter table public.appointments
      add constraint appointments_service_id_fkey
      foreign key (service_id)
      references public.services (id)
      on delete set null
      not valid;
  end if;
end;
$$;

create index if not exists appointments_design_id_idx
  on public.appointments (design_id);

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

alter table public.appointments enable row level security;
revoke all privileges on table public.appointments from public, anon;
grant insert (name, phone, email, service_id, design_id, appointment_date, time_slot, notes)
  on public.appointments to anon;
grant select, insert, update, delete on public.appointments to authenticated;

-- Remove the project's pre-admin policy name if the earlier migration was
-- never applied; ordinary authenticated customers must not get broad access.
drop policy if exists "Authenticated users can manage appointments" on public.appointments;
drop policy if exists "Public can request appointments" on public.appointments;
drop policy if exists "Customers can request appointments" on public.appointments;
drop policy if exists "Admins can manage appointments" on public.appointments;

create policy "Public can request appointments"
  on public.appointments for insert to anon
  with check (status = 'pending' and customer_id is null);

create policy "Customers can request appointments"
  on public.appointments for insert to authenticated
  with check (status = 'pending' and customer_id = auth.uid());

create policy "Admins can manage appointments"
  on public.appointments for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

notify pgrst, 'reload schema';

commit;
