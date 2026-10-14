begin;

create table if not exists public.customer_store_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cart jsonb not null default '[]'::jsonb
    check (jsonb_typeof(cart) = 'array'),
  wishlist jsonb not null default '[]'::jsonb
    check (jsonb_typeof(wishlist) = 'array')
);

alter table public.customer_store_state enable row level security;

revoke all privileges on public.customer_store_state from public, anon, authenticated;
grant select, insert, update on public.customer_store_state to authenticated;

drop policy if exists "Customers can manage own store state" on public.customer_store_state;
drop policy if exists "Customers can read own store state" on public.customer_store_state;
drop policy if exists "Customers can insert own store state" on public.customer_store_state;
drop policy if exists "Customers can update own store state" on public.customer_store_state;
create policy "Customers can read own store state"
  on public.customer_store_state
  for select
  to authenticated
  using (user_id = (select auth.uid()));
create policy "Customers can insert own store state"
  on public.customer_store_state
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));
create policy "Customers can update own store state"
  on public.customer_store_state
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

notify pgrst, 'reload schema';

commit;
