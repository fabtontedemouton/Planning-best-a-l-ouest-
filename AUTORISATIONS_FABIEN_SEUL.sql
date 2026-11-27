-- Autorisations des disponibilités : seul le compte de Fabien peut les modifier.
-- À exécuter dans Supabase SQL Editor avec le nom de membre exactement "Fabien".
create or replace function public.is_fabien()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members
    where user_id = auth.uid()
      and user_id = 'bf1668e5-9738-4092-827e-2dd0f731daaf'::uuid
  );
$$;

revoke all on function public.is_fabien() from public;
grant execute on function public.is_fabien() to authenticated;

drop policy if exists "availability own write" on public.availability;
drop policy if exists "availability fabien manage" on public.availability;
create policy "availability fabien manage"
on public.availability
for all
to authenticated
using (public.is_fabien())
with check (public.is_fabien());

-- La lecture reste accessible aux membres de l'équipe (politique existante).
