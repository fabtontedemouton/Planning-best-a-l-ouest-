create extension if not exists pgcrypto;

create table if not exists public.team_members(
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null,
 created_at timestamptz default now(),
 earliest_start time not null default '07:00',
 latest_finish time not null default '19:00'
);
alter table public.team_members add column if not exists earliest_start time not null default '07:00';
alter table public.team_members add column if not exists latest_finish time not null default '19:00';
create table if not exists public.availability(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.team_members(user_id) on delete cascade,
 day date not null,
 status text not null check(status in('available','limited','unavailable')),
 note text default '',
 unique(user_id,day)
);
create table if not exists public.jobs(
 id uuid primary key default gen_random_uuid(),
 created_by uuid not null references public.team_members(user_id),
 title text not null,
 day date not null,
 start_time time not null,
 end_time time not null,
 note text default '',
 status text not null default 'scheduled' check(status in('scheduled','cancelled')),
 created_at timestamptz default now(),
 check(start_time<end_time)
);
create table if not exists public.job_participants(
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null references public.jobs(id) on delete cascade,
 user_id uuid not null references public.team_members(user_id) on delete cascade,
 status text not null default 'invited' check(status in('invited','accepted','declined')),
 responded_at timestamptz,
 unique(job_id,user_id)
);

alter table public.team_members enable row level security;
alter table public.availability enable row level security;
alter table public.jobs enable row level security;
alter table public.job_participants enable row level security;

drop policy if exists "team read" on public.team_members;
create policy "team read" on public.team_members for select to authenticated using(exists(select 1 from public.team_members x where x.user_id=auth.uid()));
drop policy if exists "team self insert" on public.team_members;
create policy "team self insert" on public.team_members for insert to authenticated with check(user_id=auth.uid());
drop policy if exists "team self update" on public.team_members;
create policy "team self update" on public.team_members for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

drop policy if exists "availability read team" on public.availability;
create policy "availability read team" on public.availability for select to authenticated using(exists(select 1 from public.team_members x where x.user_id=auth.uid()));
drop policy if exists "availability own write" on public.availability;
create policy "availability own write" on public.availability for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

drop policy if exists "jobs read team" on public.jobs;
create policy "jobs read team" on public.jobs for select to authenticated using(exists(select 1 from public.team_members x where x.user_id=auth.uid()));
drop policy if exists "jobs create team" on public.jobs;
create policy "jobs create team" on public.jobs for insert to authenticated with check(created_by=auth.uid());
drop policy if exists "jobs creator update" on public.jobs;
create policy "jobs creator update" on public.jobs for update to authenticated using(created_by=auth.uid()) with check(created_by=auth.uid());

drop policy if exists "participants read team" on public.job_participants;
create policy "participants read team" on public.job_participants for select to authenticated using(exists(select 1 from public.team_members x where x.user_id=auth.uid()));
drop policy if exists "participants creator invite" on public.job_participants;
create policy "participants creator invite" on public.job_participants for insert to authenticated with check(
 exists(select 1 from public.jobs j where j.id=job_id and j.created_by=auth.uid())
);
drop policy if exists "participant self response" on public.job_participants;
create policy "participant self response" on public.job_participants for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

-- Pas de limite de participants : chaque personne invitée possède sa ligne.
-- Seuls les participants ayant accepté sont marqués en chantier dans leur calendrier.
-- Les autres membres de l'équipe ne sont jamais bloqués par ce chantier.


-- Commentaire partagé par journée (un commentaire éditable par journée)
create table if not exists public.day_notes(
 day date primary key,
 comment text not null default '',
 updated_by uuid not null references public.team_members(user_id),
 updated_at timestamptz not null default now()
);
alter table public.day_notes enable row level security;
drop policy if exists "day notes read team" on public.day_notes;
create policy "day notes read team" on public.day_notes for select to authenticated
 using(exists(select 1 from public.team_members x where x.user_id=auth.uid()));
drop policy if exists "day notes insert team" on public.day_notes;
create policy "day notes insert team" on public.day_notes for insert to authenticated
 with check(updated_by=auth.uid() and exists(select 1 from public.team_members x where x.user_id=auth.uid()));
drop policy if exists "day notes update team" on public.day_notes;
create policy "day notes update team" on public.day_notes for update to authenticated
 using(exists(select 1 from public.team_members x where x.user_id=auth.uid()))
 with check(updated_by=auth.uid());

-- Activer les changements en direct Supabase Realtime sur les tables suivies.
do $$
begin
  alter publication supabase_realtime add table public.team_members;
exception when duplicate_object then null;
when undefined_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.availability;
exception when duplicate_object then null;
when undefined_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.jobs;
exception when duplicate_object then null;
when undefined_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.job_participants;
exception when duplicate_object then null;
when undefined_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.day_notes;
exception when duplicate_object then null;
when undefined_object then null;
end $$;
