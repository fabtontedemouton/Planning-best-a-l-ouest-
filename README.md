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
