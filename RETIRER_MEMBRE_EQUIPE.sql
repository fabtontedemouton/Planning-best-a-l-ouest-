-- Retrait sécurisé des membres de l'équipe (désactivation réversible).
-- À exécuter dans Supabase > SQL Editor avant de publier le nouvel APK.

alter table public.team_members
  add column if not exists active boolean not null default true;

-- Les fonctions de contrôle ne comptent que les membres actifs.
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
      and coalesce(active,true) = true
  );
$$;

revoke all on function public.current_user_is_team_member() from public;
grant execute on function public.current_user_is_team_member() to authenticated;

-- Les membres peuvent modifier leur nom, mais pas réactiver eux-mêmes un compte.
revoke update on public.team_members from authenticated;
grant update (display_name) on public.team_members to authenticated;

create or replace function public.remove_team_member(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.team_members
    where user_id = auth.uid()
      and lower(trim(display_name)) = 'fabien'
      and coalesce(active,true) = true
  ) then
    raise exception 'Seul Fabien peut retirer un membre.';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Tu ne peux pas retirer ton propre compte.';
  end if;

  if not exists (
    select 1 from public.team_members
    where user_id = target_user_id and coalesce(active,true) = true
  ) then
    raise exception 'Ce membre est introuvable ou déjà retiré.';
  end if;

  update public.team_members
  set active = false
  where user_id = target_user_id;
end;
$$;

revoke all on function public.remove_team_member(uuid) from public;
grant execute on function public.remove_team_member(uuid) to authenticated;

-- Les comptes désactivés ne peuvent plus consulter l'équipe.
drop policy if exists "team members read" on public.team_members;
create policy "team members read"
on public.team_members for select to authenticated
using (
  coalesce(active,true) = true
  and public.current_user_is_team_member()
);

-- Seuls les membres actifs peuvent lire les tables partagées.
drop policy if exists "availability read team" on public.availability;
create policy "availability read team"
on public.availability for select to authenticated
using (public.current_user_is_team_member());

drop policy if exists "jobs read team" on public.jobs;
create policy "jobs read team"
on public.jobs for select to authenticated
using (public.current_user_is_team_member());

drop policy if exists "participants read team" on public.job_participants;
create policy "participants read team"
on public.job_participants for select to authenticated
using (public.current_user_is_team_member());

drop policy if exists "day notes read team" on public.day_notes;
create policy "day notes read team"
on public.day_notes for select to authenticated
using (public.current_user_is_team_member());
