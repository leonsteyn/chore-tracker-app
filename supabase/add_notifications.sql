-- Migration: track which kid/week notifications have been sent
-- Prevents duplicate emails if the child reopens the app after finishing chores.
-- Run in Supabase Dashboard → SQL Editor → New Query

create table if not exists week_completions_notified (
  kid_id   text not null references kids(id) on delete cascade,
  week_key date not null,
  sent_at  timestamptz default now(),
  primary key (kid_id, week_key)
);

-- No RLS policies = no client access; only the service-role Netlify function can write here
alter table week_completions_notified enable row level security;
