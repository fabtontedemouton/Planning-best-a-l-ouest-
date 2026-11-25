# PLANNING — Les Best à l'Ouest

## APK Android
Le dépôt contient l'application et un workflow GitHub Actions qui compile un APK Android debug à chaque push sur `main` ou manuellement.

### Récupérer l'APK
1. Ouvre l'onglet **Actions** du dépôt GitHub.
2. Choisis **Construire APK Android**.
3. Appuie sur **Run workflow** si le lancement automatique n'a pas démarré.
4. Attends la coche verte de réussite.
5. Ouvre l'exécution terminée et télécharge l'artefact `planning-best-a-l-ouest-debug-apk`.
6. Décompresse l'archive téléchargée et installe `app-debug.apk` sur ton Android.

## Important : Supabase n'est pas encore configuré
L'APK peut être compilé et installé maintenant. En revanche, les comptes, les enregistrements, les commentaires partagés et la synchronisation entre téléphones ne fonctionneront pas tant que le projet Supabase n'aura pas été créé et que `config.js` n'aura pas reçu son URL et sa clé publique anon/publishable. Ne mets jamais la clé `service_role` dans l'application.

## Fonctions de l'interface
- Planning sur 30 ou 45 jours.
- Commentaires par journée et par chantier.
- Chantiers avec plusieurs tondeurs.
- Invitations et réponses.
- Horaires individuels ; valeurs de départ prévues pour Fabien : chantier à partir de 08:00 et départ au plus tard à 18:00.

## Type d'APK
Le workflow produit un APK debug pour installation et essais. Ce n'est pas encore un APK signé pour publication sur le Play Store.


## Identité visuelle
Le logo complet `logo-best-a-l-ouest.png` est affiché en grand dans l’en-tête de toutes les vues. L’icône Android est générée depuis `resources/icon.png` avec `@capacitor/assets` pendant le workflow GitHub Actions.
