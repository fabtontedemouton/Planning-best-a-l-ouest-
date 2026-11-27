-- RATTACHEMENT DU PLANNING AU COMPTE FABIEN ACTUEL
-- Projet : PLANNING PARTAGE - LES BEST A L'OUEST
--
-- Compte actuellement utilise sur le telephone :
--   bf1668e5-9738-4092-827e-2dd0f731daaf
-- Ancien compte principal contenant 26 disponibilites :
--   bb960439-df3d-491d-9adc-26c31914a3e1
--
-- Cette migration :
-- 1) conserve le compte actuel du telephone comme compte Fabien administrateur ;
-- 2) copie les disponibilites des anciens comptes nommes Fabien vers ce compte ;
-- 3) conserve les anciens comptes dans team_members mais les desactive ;
-- 4) rattache les references de chantiers/participants/commentaires au compte actuel ;
-- 5) lie les droits administrateur a l'identifiant unique, et non au simple prenom.
--
-- A executer UNE SEULE FOIS dans Supabase > SQL Editor.
-- La transaction annule tout si une etape echoue.

begin;

do $$
declare
  v_target uuid := 'bf1668e5-9738-4092-827e-2dd0f731daaf';
begin
  if not exists (
    select 1 from public.team_members
    where user_id = v_target and active is distinct from false
  ) then
    raise exception 'Le compte Fabien actuel bf1668e5-9738-4092-827e-2dd0f731daaf est absent ou inactif. Migration annulee.';
  end if;

  -- Normaliser le nom du compte actuellement utilise.
  update public.team_members
  set display_name = 'Fabien', active = true
  where user_id = v_target;

  -- Copier toutes les disponibilites des anciens comptes Fabien.
  -- En cas de doublon sur une meme date, la ligne deja presente sur le
  -- compte cible est prioritaire. Sinon l'ancien compte principal bb960... passe en premier.
  insert into public.availability (user_id, day, status, note)
  select
    v_target,
    a.day,
    a.status,
    coalesce(a.note, '')
  from public.availability a
  join public.team_members tm on tm.user_id = a.user_id
  where lower(trim(tm.display_name)) = 'fabien'
    and tm.user_id <> v_target
  order by
    case when tm.user_id = 'bb960439-df3d-491d-9adc-26c31914a3e1'::uuid then 0 else 1 end,
    a.day
  on conflict (user_id, day) do nothing;

  -- Conserver les liens historiques vers le bon compte.
  update public.jobs
  set created_by = v_target
  where created_by in (
    select user_id from public.team_members
    where lower(trim(display_name)) = 'fabien' and user_id <> v_target
  );

  -- Eviter une collision sur la contrainte unique (job_id, user_id).
  update public.job_participants p
  set user_id = v_target
  where p.user_id in (
    select user_id from public.team_members
    where lower(trim(display_name)) = 'fabien' and user_id <> v_target
  )
  and not exists (
    select 1 from public.job_participants p2
    where p2.job_id = p.job_id and p2.user_id = v_target
  );

  update public.day_notes
  set updated_by = v_target
  where updated_by in (
    select user_id from public.team_members
    where lower(trim(display_name)) = 'fabien' and user_id <> v_target
  );

  -- Les anciens doublons restent conserves pour l'historique, mais ne peuvent
  -- plus se connecter comme membres actifs.
  update public.team_members
  set active = false
  where lower(trim(display_name)) = 'fabien'
    and user_id <> v_target;
end $$;

-- Fonction centrale de controle des droits.
create or replace function public.current_user_is_fabien()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = 'bf1668e5-9738-4092-827e-2dd0f731daaf'::uuid;
$$;

create or replace function public.is_fabien()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = 'bf1668e5-9738-4092-827e-2dd0f731daaf'::uuid;
$$;

revoke all on function public.current_user_is_fabien() from public;
revoke all on function public.is_fabien() from public;
grant execute on function public.current_user_is_fabien() to authenticated;
grant execute on function public.is_fabien() to authenticated;

-- Politique d'ecriture des disponibilites : Fabien uniquement.
drop policy if exists "availability own write" on public.availability;
drop policy if exists "availability fabien manage" on public.availability;
drop policy if exists "availability fabien only" on public.availability;
create policy "availability fabien only"
on public.availability
for all
to authenticated
using (public.current_user_is_fabien())
with check (public.current_user_is_fabien());

grant select on public.availability to authenticated;
grant insert, update, delete on public.availability to authenticated;

notify pgrst, 'reload schema';

commit;
