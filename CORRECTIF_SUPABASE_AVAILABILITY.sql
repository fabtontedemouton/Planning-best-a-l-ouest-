-- Correctif RLS pour l'enregistrement des disponibilités.
-- À exécuter dans Supabase > SQL Editor, connecté au projet Planning.

alter table public.availability enable row level security;

drop policy if exists "availability own write" on public.availability;
create policy "availability own write"
on public.availability
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select, insert, update, delete
on table public.availability
to authenticated;
