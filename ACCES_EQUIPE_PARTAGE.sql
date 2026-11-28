-- ACCES PARTAGE POUR TOUS LES MEMBRES ACTIFS
-- Chaque membre peut modifier SES disponibilites. Les autres les consultent.
-- Tous les membres peuvent proposer un chantier et inviter des participants.
-- Chaque invite repond uniquement pour son propre compte.

-- Disponibilites : lecture equipe, ecriture uniquement sur sa propre fiche.
DROP POLICY IF EXISTS "availability own write" ON public.availability;
DROP POLICY IF EXISTS "availability fabien manage" ON public.availability;
DROP POLICY IF EXISTS "availability fabien only" ON public.availability;
DROP POLICY IF EXISTS "availability self write" ON public.availability;
DROP POLICY IF EXISTS "availability read team" ON public.availability;

CREATE POLICY "availability read team"
ON public.availability FOR SELECT TO authenticated
USING (public.current_user_is_team_member());

CREATE POLICY "availability self write"
ON public.availability FOR ALL TO authenticated
USING (user_id = auth.uid() AND public.current_user_is_team_member())
WITH CHECK (user_id = auth.uid() AND public.current_user_is_team_member());

-- Tous les membres actifs peuvent consulter et proposer des chantiers.
DROP POLICY IF EXISTS "jobs read team" ON public.jobs;
CREATE POLICY "jobs read team" ON public.jobs FOR SELECT TO authenticated
USING (public.current_user_is_team_member());

DROP POLICY IF EXISTS "jobs create team" ON public.jobs;
CREATE POLICY "jobs create team" ON public.jobs FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND public.current_user_is_team_member());

DROP POLICY IF EXISTS "jobs creator update" ON public.jobs;
CREATE POLICY "jobs creator update" ON public.jobs FOR UPDATE TO authenticated
USING (created_by = auth.uid() AND public.current_user_is_team_member())
WITH CHECK (created_by = auth.uid() AND public.current_user_is_team_member());

-- Tous les membres voient les invitations; seul le créateur invite,
-- et chaque participant ne peut répondre que pour lui-même.
DROP POLICY IF EXISTS "participants read team" ON public.job_participants;
CREATE POLICY "participants read team" ON public.job_participants FOR SELECT TO authenticated
USING (public.current_user_is_team_member());

DROP POLICY IF EXISTS "participants creator invite" ON public.job_participants;
CREATE POLICY "participants creator invite" ON public.job_participants FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_is_team_member()
  AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.created_by = auth.uid())
);

DROP POLICY IF EXISTS "participant self response" ON public.job_participants;
CREATE POLICY "participant self response" ON public.job_participants FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND public.current_user_is_team_member())
WITH CHECK (user_id = auth.uid() AND public.current_user_is_team_member());

-- Commentaires de journée : lecture et modification par les membres actifs.
DROP POLICY IF EXISTS "day notes read team" ON public.day_notes;
CREATE POLICY "day notes read team" ON public.day_notes FOR SELECT TO authenticated
USING (public.current_user_is_team_member());

DROP POLICY IF EXISTS "day notes insert team" ON public.day_notes;
CREATE POLICY "day notes insert team" ON public.day_notes FOR INSERT TO authenticated
WITH CHECK (updated_by = auth.uid() AND public.current_user_is_team_member());

DROP POLICY IF EXISTS "day notes update team" ON public.day_notes;
CREATE POLICY "day notes update team" ON public.day_notes FOR UPDATE TO authenticated
USING (public.current_user_is_team_member())
WITH CHECK (updated_by = auth.uid() AND public.current_user_is_team_member());

GRANT SELECT, INSERT, UPDATE ON public.availability TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.job_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.day_notes TO authenticated;

NOTIFY pgrst, 'reload schema';
