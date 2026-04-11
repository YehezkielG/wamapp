-- RLS policies for public.notifications
--
-- This policy scopes access by device_id.
-- Source: JWT claim `device_id` only.
--
-- If the token does not include `device_id`, access will be denied.

create or replace function public.current_request_device_id()
returns uuid
language sql
stable
security invoker
as $$
  select nullif(auth.jwt() ->> 'device_id', '')::uuid;
$$;

alter table public.notifications enable row level security;
alter table public.notifications force row level security;

drop policy if exists "notifications_select_own_device" on public.notifications;
drop policy if exists "notifications_insert_own_device" on public.notifications;
drop policy if exists "notifications_update_own_device" on public.notifications;
drop policy if exists "notifications_delete_own_device" on public.notifications;

create policy "notifications_select_own_device"
on public.notifications
for select
to authenticated
using (device_id = public.current_request_device_id());

create policy "notifications_insert_own_device"
on public.notifications
for insert
to authenticated
with check (device_id = public.current_request_device_id());

create policy "notifications_update_own_device"
on public.notifications
for update
to authenticated
using (device_id = public.current_request_device_id())
with check (device_id = public.current_request_device_id());

create policy "notifications_delete_own_device"
on public.notifications
for delete
to authenticated
using (device_id = public.current_request_device_id());-- RLS policies for public.notifications
--
-- This policy scopes access by device_id.
-- Preferred source: JWT claim `device_id`.
-- Fallback: request header `x-device-id` or `device_id`.
--
-- If your client uses anonymous access, make sure it sends a trusted device_id
-- via JWT claim or request header. Otherwise the policies will deny access.

create or replace function public.current_request_device_id()
returns uuid
language sql
stable
security invoker
as $$
  select nullif(
    coalesce(
      auth.jwt() ->> 'device_id',
      current_setting('request.headers', true)::jsonb ->> 'x-device-id',
      current_setting('request.headers', true)::jsonb ->> 'device_id'
    ),
    ''
  )::uuid;
$$;

alter table public.notifications enable row level security;
alter table public.notifications force row level security;

drop policy if exists "notifications_select_own_device" on public.notifications;
drop policy if exists "notifications_insert_own_device" on public.notifications;
drop policy if exists "notifications_update_own_device" on public.notifications;
drop policy if exists "notifications_delete_own_device" on public.notifications;

create policy "notifications_select_own_device"
on public.notifications
for select
to anon
using (device_id = public.current_request_device_id());

create policy "notifications_insert_own_device"
on public.notifications
for insert
to anon
with check (device_id = public.current_request_device_id());

create policy "notifications_update_own_device"
on public.notifications
for update
to anon
using (device_id = public.current_request_device_id())
with check (device_id = public.current_request_device_id());

create policy "notifications_delete_own_device"
on public.notifications
for delete
to anon
using (device_id = public.current_request_device_id());
