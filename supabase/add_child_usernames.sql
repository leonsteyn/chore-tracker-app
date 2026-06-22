-- Migration: add username-based child login
-- Run in Supabase Dashboard → SQL Editor if you already ran schema.sql

-- Add username column to kids
alter table kids add column if not exists username text unique;

-- Public lookup table — maps a child's chosen username to their internal auth email.
-- Readable by anyone (unauthenticated) so the login form can resolve usernames
-- before a session exists. The auth_email is an internal fake address never shown to users.
create table if not exists child_usernames (
  username   text primary key,
  kid_id     text references kids(id) on delete cascade,  -- auto-cleans when kid is deleted
  auth_email text not null unique
);

alter table child_usernames enable row level security;

create policy "Public username lookup" on child_usernames
  for select using (true);

-- Parents can delete entries (handled automatically via CASCADE, but allows manual cleanup)
create policy "Parent delete" on child_usernames
  for delete using (
    exists (
      select 1 from kids k
      join profiles p on p.id = auth.uid() and p.family_id = k.family_id and p.role = 'parent'
      where k.id = child_usernames.kid_id
    )
  );

alter publication supabase_realtime add table child_usernames;
