# Publier sur TestFlight via Xcode Cloud

Même mécanique que le projet `cerveau-os` : Apple compile sur son
infrastructure, avec un Xcode supporté. **L'Xcode installé sur le Mac
n'intervient jamais** — c'est précisément ce qui débloque la situation ici,
la bêta locale étant refusée à l'envoi.

Inclus dans l'Apple Developer Program : 25 heures de calcul par mois, sans
supplément et sans quota EAS.

## Ce qui est déjà en place dans le dépôt

| | |
|---|---|
| Projet Xcode | `mobile/ios/Courses.xcworkspace`, généré par `expo prebuild` |
| Schéma partagé | `Courses` — indispensable, sans quoi Xcode Cloud ne voit rien à compiler |
| Script d'amorçage | `mobile/ios/ci_scripts/ci_post_clone.sh` |
| Identité | `com.coursesapp.mobile`, version 1.0.0 |
| Conformité chiffrement | déclarée dans `app.json` |

`Pods/` et `build/` ne sont pas versionnés : le script les régénère.

## Ce qu'il te reste à faire, dans App Store Connect

La configuration du workflow vit chez Apple, pas dans le dépôt — comme pour
`cerveau-os`, où seul `xcshareddata/xcodecloud/manifest.json` en témoigne.

1. **App Store Connect → Xcode Cloud → Créer un workflow**, en le rattachant au
   dépôt GitHub `Angelblot/courses-app`.
2. **Démarrage** : branche `mobile/expo-scan` (ou `main` après fusion), en
   restreignant aux fichiers de `mobile/` pour ne pas compiler à chaque
   changement de l'extension ou du backend.
3. **Action** : Archive, plateforme iOS, schéma **`Courses`**.
4. **Post-action** : TestFlight Internal Testing, groupe interne.
5. **Variables d'environnement du workflow** — l'étape à ne pas manquer :

   | Nom | Valeur |
   |---|---|
   | `EXPO_PUBLIC_SUPABASE_URL` | `https://qmymwicsgilhoihtfdjm.supabase.co` |
   | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_PueJWmalqhZO0ctPu95GKQ_EaAgVulr` |

   Ces valeurs sont lues **au moment où le bundle JavaScript est fabriqué**,
   pendant la compilation. Sans elles, l'archivage réussit et l'application
   plante au lancement — vérifié : le bundle se construit sans broncher quand
   la configuration manque. Elles sont publiques par conception, le
   cloisonnement reposant sur RLS.

## Après un changement de configuration native

Le projet `ios/` est désormais versionné : on quitte la génération native
continue d'Expo. Toute modification d'`app.json` touchant un greffon, une
permission ou l'icône exige de régénérer le projet :

```bash
cd /Users/angel-assistant/app-saas/courses-app/mobile && npx expo prebuild -p ios --clean
```

Puis committer `ios/`. Une modification purement JavaScript ou TypeScript n'en
a pas besoin.

Attention si tu lances `pod install` à la main : CocoaPods plante en formatant
ses propres erreurs quand la locale n'est pas UTF-8, ce qui masque le vrai
message. Préfixe par `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`.
