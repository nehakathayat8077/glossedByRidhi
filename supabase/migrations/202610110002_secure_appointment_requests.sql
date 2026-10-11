begin;

alter table public.appointments
  add column if not exists customer_id uuid references auth.users(id) on delete set null,
  add column if not exists design_id uuid references public.designs(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists appointments_one_active_booking_per_slot
  on public.appointments (appointment_date, time_slot)
  where status <> 'cancelled';

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

revoke all on function public.prepare_appointment_request() from public;
drop trigger if exists appointments_prepare_request on public.appointments;
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
drop trigger if exists appointments_touch_updated_at on public.appointments;
create trigger appointments_touch_updated_at
  before update on public.appointments
  for each row execute function public.touch_appointment_updated_at();

alter table public.appointments enable row level security;
revoke all privileges on table public.appointments from anon;
revoke insert on table public.appointments from anon;
revoke insert (name, phone, email, service_id, appointment_date, time_slot, notes)
  on public.appointments from anon;
grant insert (name, phone, email, service_id, design_id, appointment_date, time_slot, notes)
  on public.appointments to anon;

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

commit;
