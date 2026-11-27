-- CORRECTIF INVITATIONS ET PROPOSITIONS DE CHANTIERS
-- À exécuter une seule fois dans Supabase > SQL Editor.
-- Chaque membre actif peut proposer un chantier.
-- Le créateur est accepté automatiquement; les autres sont invités et doivent répondre.

grant select, insert, update on public.jobs to authenticated;
grant select, insert, update on public.job_participants to authenticated;

alter table public.jobs enable row level security;
alter table public.job_participants enable row level security;

drop policy if exists "jobs read team" on public.jobs;
create policy "jobs read team"
on public.jobs for select to authenticated
using (public.current_user_is_team_member());

drop policy if exists "jobs create team" on public.jobs;
create policy "jobs create team"
on public.jobs for insert to authenticated
with check (created_by = auth.uid() and public.current_user_is_team_member());

drop policy if exists "jobs creator update" on public.jobs;
create policy "jobs creator update"
on public.jobs for update to authenticated
using (created_by = auth.uid() and public.current_user_is_team_member())
with check (created_by = auth.uid() and public.current_user_is_team_member());

drop policy if exists "participants read team" on public.job_participants;
create policy "participants read team"
on public.job_participants for select to authenticated
using (public.current_user_is_team_member());

drop policy if exists "participants creator invite" on public.job_participants;
create policy "participants creator invite"
on public.job_participants for insert to authenticated
with check (
  public.current_user_is_team_member()
  and exists (
    select 1 from public.jobs j
    where j.id = job_id and j.created_by = auth.uid()
  )
);

drop policy if exists "participant self response" on public.job_participants;
create policy "participant self response"
on public.job_participants for update to authenticated
using (user_id = auth.uid() and public.current_user_is_team_member())
with check (user_id = auth.uid() and public.current_user_is_team_member());

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

notify pgrst, 'reload schema';
