# PLANNING — Les Best à l'Ouest (V3)

## Inclus dans cette archive
- Interface mobile et logo intégré (icône 512 × 512).
- Planning à 30 ou 45 jours.
- Disponibilités par tondeur.
- Commentaire partagé par journée.
- Commentaire/consignes sur chaque chantier.
- Création de chantier avec plusieurs participants, sans limite fixée par l'interface.
- Invitations acceptées/refusées.
- Synchronisation en direct via Supabase Realtime (abonnement aux changements des tables).

## Installation / mise à jour
1. Garder le même dépôt GitHub et remplacer le contenu du dossier `app` avec celui de cette archive.
2. Garder le projet Supabase existant.
3. Dans Supabase SQL Editor, exécuter le fichier `supabase/schema.sql` COMPLET uniquement si c'est une première installation.
   - Si la base V2 existe déjà, exécuter seulement le bloc ajouté à la fin du fichier à partir de `-- Commentaire partagé par journée`.
   - Ne pas réexécuter aveuglément le schéma complet sur une base déjà utilisée.
4. Configurer `app/config.js` avec l'URL Supabase et la clé anon/public.
5. Vérifier dans Supabase Authentication que l'URL GitHub Pages est autorisée.
6. Déployer GitHub Pages depuis le dossier configuré dans le dépôt.

## Ajouter un tondeur
- Créer son compte dans Supabase Auth.
- Ajouter son `user_id` et son nom dans `public.team_members`.
- Les comptes doivent être membres de la même équipe (la V3 utilise une seule équipe commune).

## Important : limites à connaître
Cette archive est une version source prête à connecter/déployer, pas une application déjà hébergée ni validée en production.
La synchronisation Realtime est implémentée côté interface et les tables sont ajoutées à la publication Realtime dans le SQL, mais elle doit être vérifiée dans votre projet Supabase réel.
Les conflits de réservation simultanés ne sont pas encore protégés par une transaction serveur ; les participants doivent donc vérifier les disponibilités avant confirmation.
Les commentaires par journée sont un champ partagé unique par date (la dernière sauvegarde remplace le précédent commentaire), pas un fil de discussion.
Les commentaires de chantier sont conservés dans le champ `jobs.note`.
Les contraintes horaires individuelles sont affichées comme règle d'organisation, mais le contrôle automatique strict des horaires dans la base n'est pas encore activé.
