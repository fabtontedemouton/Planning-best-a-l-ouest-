-- CORRECTIF GLOBAL DES DROITS - LES BEST À L'OUEST
-- À exécuter dans Supabase > SQL Editor, une seule fois.
-- Le profil Fabien est administrateur. Laurent et Kiki restent membres simples.

create or replace function public.current_user_is_team_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where user_id = auth.uid()
  );
$$;

create or replace function public.current_user_is_fabien()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where user_id = auth.uid()
      and user_id = 'bf1668e5-9738-4092-827e-2dd0f731daaf'::uuid
  );
$$;

revoke all on function public.current_user_is_team_member() from public;
revoke all on function public.current_user_is_fabien() from public;
grant execute on function public.current_user_is_team_member() to authenticated;
grant execute on function public.current_user_is_fabien() to authenticated;

-- Droits de lecture équipe sans policy récursive.
drop policy if exists "team read" on public.team_members;
drop policy if exists "team members read" on public.team_members;
create policy "team members read"
on public.team_members for select to authenticated
using (public.current_user_is_team_member());

-- Chaque téléphone ne peut créer/modifier que son propre profil.
drop policy if exists "team self insert" on public.team_members;
create policy "team self insert"
on public.team_members for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "team self update" on public.team_members;
create policy "team self update"
on public.team_members for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Lecture des disponibilités par toute l'équipe, écriture par Fabien seulement.
drop policy if exists "availability read team" on public.availability;
create policy "availability read team"
on public.availability for select to authenticated
using (public.current_user_is_team_member());

drop policy if exists "availability own write" on public.availability;
drop policy if exists "availability fabien manage" on public.availability;
drop policy if exists "availability fabien only" on public.availability;
create policy "availability fabien only"
on public.availability for all to authenticated
using (public.current_user_is_fabien())
with check (public.current_user_is_fabien());

-- Les membres de l'équipe peuvent consulter les chantiers.
drop policy if exists "jobs read team" on public.jobs;
create policy "jobs read team"
on public.jobs for select to authenticated
using (public.current_user_is_team_member());

-- Tous les membres peuvent proposer un chantier, mais ne peuvent modifier que leurs propres chantiers.
drop policy if exists "jobs create team" on public.jobs;
create policy "jobs create team"
on public.jobs for insert to authenticated
with check (created_by = auth.uid());

drop policy if exists "jobs creator update" on public.jobs;
create policy "jobs creator update"
on public.jobs for update to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

-- Participants : lecture équipe, invitations par le créateur du chantier,
-- réponse uniquement par la personne invitée.
drop policy if exists "participants read team" on public.job_participants;
create policy "participants read team"
on public.job_participants for select to authenticated
using (public.current_user_is_team_member());

drop policy if exists "participants creator invite" on public.job_participants;
create policy "participants creator invite"
on public.job_participants for insert to authenticated
with check (
  exists(select 1 from public.jobs j
         where j.id = job_id and j.created_by = auth.uid())
);

drop policy if exists "participant self response" on public.job_participants;
create policy "participant self response"
on public.job_participants for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Commentaires partagés : lecture équipe, création et modification par les membres.
drop policy if exists "day notes read team" on public.day_notes;
create policy "day notes read team"
on public.day_notes for select to authenticated
using (public.current_user_is_team_member());

drop policy if exists "day notes insert team" on public.day_notes;
create policy "day notes insert team"
on public.day_notes for insert to authenticated
with check (updated_by = auth.uid() and public.current_user_is_team_member());

drop policy if exists "day notes update team" on public.day_notes;
create policy "day notes update team"
on public.day_notes for update to authenticated
using (public.current_user_is_team_member())
with check (updated_by = auth.uid());

-- Permissions SQL nécessaires aux appels depuis l'application.
grant select, insert, update on public.team_members to authenticated;
grant select on public.availability to authenticated;
grant insert, update, delete on public.availability to authenticated;
grant select, insert, update on public.jobs to authenticated;
grant select, insert, update on public.job_participants to authenticated;
grant select, insert, update on public.day_notes to authenticated;
