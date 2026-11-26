# LES BEST À L'OUEST — Planning

Version Android/Capacitor. Le logo complet de la mascotte est intégré directement dans `index.html` : il ne dépend plus d'un chemin d'image séparé et ne peut donc plus afficher le texte alternatif à cause d'un fichier absent.

## Icônes Android
- `resources/icon.png` : icône carrée 1024×1024 utilisée par `@capacitor/assets`.
- `resources/splash.png` : visuel de démarrage 2732×2732.
- `icon-512.png` : icône web/PWA.

## Compilation
Le workflow `.github/workflows/android-apk.yml` construit un APK debug à chaque push sur `main` ou manuellement via Actions. L'APK est disponible dans les Artifacts du run.

## Supabase
`config.js` contient l'URL du projet et la clé publique publishable fournie. Ne jamais y mettre une clé `service_role`.

**À noter :** la compilation génère les ressources Android à partir de `resources/`. L'icône ne changera sur le téléphone qu'après installation du nouvel APK. Le fonctionnement réel de l'authentification et de la synchronisation doit être validé avec un test multi-comptes sur l'URL hébergée autorisée dans Supabase.


## Droits de modification des disponibilités
Seul le membre dont le nom affiché est exactement « Fabien » peut modifier les couleurs et disponibilités. Laurent et Kiki peuvent proposer des chantiers et répondre à leurs invitations. Exécuter `AUTORISATIONS_FABIEN_SEUL.sql` dans Supabase SQL Editor pour appliquer également cette règle côté base de données.


## Version consolidée - rôles et disponibilités
1. Exécuter `CORRECTIF_FINAL_DROITS_SUPABASE.sql` dans Supabase SQL Editor.
2. Remplacer le contenu du dépôt GitHub par le contenu de ce dossier.
3. Relancer le workflow Android puis installer le nouvel APK.
4. Le compte dont le profil porte exactement le nom `Fabien` peut seul modifier les couleurs et disponibilités.
5. Laurent et Kiki peuvent proposer des chantiers, inviter des tondeurs et répondre aux invitations. Ils ne peuvent pas modifier les disponibilités.
Le profil personnel est chargé séparément au démarrage pour éviter que le rôle administrateur dépende de l'affichage de la liste d'équipe.


## Équipe et accès
- Fabien reste l'administrateur des couleurs et disponibilités.
- Laurent, Kiki et les autres tondeurs peuvent proposer des chantiers et répondre aux invitations.
- Un nouveau tondeur rejoint depuis son propre téléphone en saisissant son prénom et un PIN à 4 chiffres. Le PIN est conservé localement sur ce téléphone ; il ne s'agit pas d'un compte avec mot de passe serveur.
- La liste de l'équipe n'affiche désormais qu'une seule carte par nom. Les anciens profils de test en double restent en base pour préserver les historiques et invitations.
- Pour l'icône téléphone, installer le nouvel APK Android. Pour une version navigateur, utiliser le menu Chrome > Ajouter à l'écran d'accueil.


## Retirer un tondeur depuis l'application
Exécuter `RETIRER_MEMBRE_EQUIPE.sql` dans Supabase SQL Editor. Dans Équipe, Fabien voit ensuite un bouton « Retirer » sur chaque autre profil actif. Le retrait est une désactivation réversible (`active=false`) : les disponibilités, chantiers, invitations et historiques ne sont pas supprimés. Le compte retiré ne peut plus ouvrir le planning. Fabien ne peut pas retirer son propre compte.
