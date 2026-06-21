-- ─────────────────────────────────────────────────────────────────────────────
-- Chore Tracker – Supabase schema
-- Run once in: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Tables ───────────────────────────────────────────────────────────────────

-- User profiles (extends auth.users)
create table if not exists profiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  name      text not null,
  role      text not null check (role in ('parent', 'child')),
  family_id uuid,
  kid_id    text
);

-- One family per parent (id == parent uid, same pattern as before)
create table if not exists families (
  id         uuid primary key,
  parent_uid uuid not null references auth.users(id) on delete cascade
);

-- Kids are rows, not an embedded array
create table if not exists kids (
  id        text primary key,
  family_id uuid not null references families(id) on delete cascade,
  name      text not null,
  color     text not null,
  email     text
);

create table if not exists chores (
  id        uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  kid_id    text not null references kids(id) on delete cascade,
  text      text not null,
  frequency text not null default 'once'
);

-- Replaces the weeklyCompletions map. family_id is denormalized for realtime filtering.
create table if not exists chore_completions (
  id          uuid primary key default gen_random_uuid(),
  chore_id    uuid    not null references chores(id) on delete cascade,
  family_id   uuid    not null references families(id) on delete cascade,
  week_key    date    not null,
  day_of_week integer not null,
  unique (chore_id, week_key, day_of_week)
);

-- 2. Realtime ─────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table kids;
alter publication supabase_realtime add table chores;
alter publication supabase_realtime add table chore_completions;

-- 3. Row Level Security ───────────────────────────────────────────────────────
alter table profiles          enable row level security;
alter table families          enable row level security;
alter table kids              enable row level security;
alter table chores            enable row level security;
alter table chore_completions enable row level security;

-- profiles: read and create own only — no update so a child cannot change their role
create policy "Own profile read"   on profiles for select using (auth.uid() = id);
create policy "Own profile create" on profiles for insert with check (auth.uid() = id);

-- families
create policy "Family create" on families
  for insert with check (auth.uid() = id);

create policy "Family read" on families
  for select using (
    exists (select 1 from profiles where id = auth.uid() and family_id = families.id)
  );

create policy "Family update" on families
  for update using (auth.uid() = parent_uid);

-- kids: any family member reads; only parent writes
create policy "Kids read" on kids
  for select using (
    exists (select 1 from profiles where id = auth.uid() and family_id = kids.family_id)
  );

create policy "Kids parent manage" on kids
  for all using (
    exists (
      select 1 from profiles
      where id = auth.uid() and family_id = kids.family_id and role = 'parent'
    )
  );

-- chores: any family member reads; only parent writes
create policy "Chores read" on chores
  for select using (
    exists (select 1 from profiles where id = auth.uid() and family_id = chores.family_id)
  );

create policy "Chores parent manage" on chores
  for all using (
    exists (
      select 1 from profiles
      where id = auth.uid() and family_id = chores.family_id and role = 'parent'
    )
  );

-- chore_completions: any member reads; parent manages everything; child only their own chores
create policy "Completions read" on chore_completions
  for select using (
    exists (select 1 from profiles where id = auth.uid() and family_id = chore_completions.family_id)
  );

create policy "Completions parent manage" on chore_completions
  for all using (
    exists (
      select 1 from profiles
      where id = auth.uid() and family_id = chore_completions.family_id and role = 'parent'
    )
  );

create policy "Completions child own chores" on chore_completions
  for all
  using (
    exists (
      select 1 from profiles p
      join chores c on c.id = chore_completions.chore_id and c.kid_id = p.kid_id
      where p.id = auth.uid() and p.role = 'child'
        and p.family_id = chore_completions.family_id
    )
  )
  with check (
    exists (
      select 1 from profiles p
      join chores c on c.id = chore_completions.chore_id and c.kid_id = p.kid_id
      where p.id = auth.uid() and p.role = 'child'
        and p.family_id = chore_completions.family_id
    )
  );

-- 4. Atomic toggle function ───────────────────────────────────────────────────
-- Used instead of a read-then-write so two simultaneous taps don't race.
create or replace function toggle_chore_day(
  p_chore_id    uuid,
  p_family_id   uuid,
  p_week_key    date,
  p_day_of_week integer
) returns void
language plpgsql
as $$
begin
  if exists (
    select 1 from chore_completions
    where chore_id = p_chore_id
      and week_key  = p_week_key
      and day_of_week = p_day_of_week
  ) then
    delete from chore_completions
    where chore_id  = p_chore_id
      and week_key  = p_week_key
      and day_of_week = p_day_of_week;
  else
    insert into chore_completions (chore_id, family_id, week_key, day_of_week)
    values (p_chore_id, p_family_id, p_week_key, p_day_of_week);
  end if;
end;
$$;

grant execute on function toggle_chore_day to authenticated;
