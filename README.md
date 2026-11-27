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


## Pack final - calendrier, menu et icône Android
- Calendrier affiché mois par mois avec navigation précédente/suivante.
- Menu hamburger en haut à gauche, en superposition, qui se ferme après sélection ou clic extérieur.
- Rôles et retrait réversible des membres via `remove_team_member` (exécuter `RETIRER_MEMBRE_EQUIPE.sql` dans Supabase).
- Icône Android native générée depuis le logo officiel dans `assets/` avec `@capacitor/assets`. Le workflow exécute `npx capacitor-assets generate --android` avant la synchronisation Capacitor.
- Icône PWA 192/512 et manifest inclus.
Pour reconstruire l'APK, remplacer les fichiers du dépôt par le contenu du dossier, vérifier que `RETIRER_MEMBRE_EQUIPE.sql` a été exécuté dans Supabase, puis lancer le workflow Android. Android peut conserver l'ancienne icône en cache : après installation du nouvel APK, si l'icône ne change pas, supprimer le raccourci de l'écran d'accueil et le recréer, ou désinstaller l'ancienne application après vérification des données synchronisées.


## Correctif ciblé : couleurs et icône Android
- Les couleurs du calendrier lisent et écrivent désormais toujours sur le compte Fabien principal `bb960439-df3d-491d-9adc-26c31914a3e1`, identifié dans la requête Supabase de l'utilisateur. Cela évite qu'un ancien profil Fabien en doublon soit choisi.
- Le workflow Android réécrit explicitement les icônes `mipmap-*`, les icônes adaptatives Android 8+ et les références de l'AndroidManifest après `cap sync`, avec le logo officiel. Cela évite de conserver l'icône générique Capacitor.
- Après compilation, installer le nouvel APK. Android peut garder le raccourci précédent en cache : supprimer l'ancien raccourci et ajouter le nouveau si nécessaire.


## Correctif workflow icône Android
Le workflow ne supprime plus `assets/` au début de la compilation. Il recrée aussi `assets/icon-foreground.png` depuis `logo-best-a-l-ouest.png` après le nettoyage, avant la génération Capacitor et avant la copie dans les dossiers mipmap Android. Cela évite que le foreground requis soit effacé avant utilisation.


## Couleur bleue des chantiers
La pastille « Chantier validé » de la légende est bleue. Toute journée comportant un chantier non annulé est affichée en bleu dans le calendrier mensuel, avec les participants acceptés indiqués dans la case. La création d'un chantier déclenche le rafraîchissement du calendrier.


## Contrôle renforcé de l'icône Android
Le workflow force les attributs `android:icon` et `android:roundIcon` dans la balise application, échoue si les ressources natives sont absentes, puis inspecte les métadonnées de l'APK compilé avec `aapt dump badging`. Cela permet de vérifier le manifeste et l'icône déclarée dans l'APK au lieu de seulement vérifier les PNG sources.


## Correctif propositions et invitations
- Un chantier n'est bleu que lorsque tous ses participants ont accepté.
- Les invitations restent visibles dans « Mes invitations » avec les boutons Accepter / Indisponible.
- Le compteur « demandes à voir » est cliquable et ouvre directement les invitations; un badge est également affiché dans le menu.
- Une nouvelle invitation déclenche un message dans l'application lorsque le téléphone est connecté au planning.
- Les propositions affichent séparément les participants acceptés, en attente et indisponibles.
- Exécuter `CORRECTIF_INVITATIONS_CHANTIERS.sql` une seule fois dans Supabase avant de tester les invitations.

## Correction du compte Fabien (important)
Avant d'installer cette version, executer une seule fois `CORRECTIF_COMPTE_FABIEN_UNIQUE.sql`
dans Supabase > SQL Editor. Cette migration rattache les disponibilites des anciens profils
Fabien au compte actuel du telephone (`bf1668e5-9738-4092-827e-2dd0f731daaf`), desactive
les doublons sans les supprimer et reserve les droits administrateur a ce seul identifiant.
