begin;

-- The existing appointment RLS policies control which rows each user may
-- update; column privileges limit authenticated updates to the status field.
revoke update on table public.appointments from public, anon, authenticated;
grant update (status) on table public.appointments to authenticated;

notify pgrst, 'reload schema';

commit;
