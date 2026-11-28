MISE A JOUR - ACCES PARTAGE BEST A L'OUEST

Fichiers modifies :
- app.js : chaque membre connecté modifie uniquement ses propres disponibilités.
  Le calendrier affiche les disponibilités et les chantiers auxquels le membre
  connecté participe/ a accepté. Les contrôles ne dépendent plus d'un compte Fabien.
- ACCES_EQUIPE_PARTAGE.sql : migration RLS à exécuter dans Supabase SQL Editor.

REGLES DES CHANTIERS CONSERVEES :
- Tous les membres actifs peuvent créer un chantier.
- Le créateur est inscrit comme accepté automatiquement.
- Les autres participants choisis reçoivent une invitation avec le statut invited.
- Chaque invité répond uniquement pour son propre compte : accepted ou declined.
- Un chantier n'est confirmé que lorsque toutes les lignes participants sont accepted.
- Les participants sont choisis explicitement lors de la création du chantier.

ORDRE DE DEPLOIEMENT :
1. Faire une sauvegarde du projet et de la base Supabase.
2. Dans Supabase SQL Editor, exécuter ACCES_EQUIPE_PARTAGE.sql une seule fois.
3. Remplacer les fichiers du projet par ceux de cette archive et recompiler l'APK.
4. Installer la nouvelle version sans réinitialiser Supabase ni effacer les données de l'application.

SECURITE :
- L'accès n'est pas public : il reste réservé aux utilisateurs authentifiés et membres actifs.
- Un membre ne peut écrire que sa propre disponibilité.
- Un invité ne peut répondre qu'à sa propre invitation.
- Le créateur ne peut pas accepter/refuser à la place des invités.
