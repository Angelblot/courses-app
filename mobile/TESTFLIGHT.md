# Publier sur TestFlight

Le projet est prêt : `expo-doctor` passe ses 21 contrôles, l'icône et
l'identifiant de bundle sont en place, `eas.json` définit les profils.

Il reste deux étapes que **tu dois faire toi-même** : elles demandent des
identifiants — compte Expo, puis compte Apple — et personne d'autre que toi
n'a à les saisir.

## 1. Se connecter à Expo

```bash
cd mobile && npx eas-cli login
```

Crée un compte sur expo.dev si tu n'en as pas. Le niveau gratuit suffit pour
des compilations occasionnelles ; elles passent par une file d'attente qui
peut durer un moment aux heures chargées.

## 2. Compiler et envoyer

```bash
cd mobile && npx eas-cli build --platform ios --profile production
```

EAS demande alors tes identifiants Apple et génère lui-même le certificat de
distribution et le profil de provisionnement. Réponds oui quand il propose de
les gérer pour toi — c'est le chemin le plus simple, et les clés restent chez
Expo, pas dans le dépôt.

La compilation dure une quinzaine de minutes. Ensuite :

```bash
npx eas-cli submit --platform ios --latest
```

L'application apparaît dans App Store Connect au bout de quelques minutes de
traitement, puis dans TestFlight.

## Ce qui est déjà réglé

| Réglage | Valeur |
|---|---|
| Nom | Courses |
| Identifiant de bundle | `com.coursesapp.mobile` |
| Version | 1.0.0, numéro de build incrémenté automatiquement |
| Icône | panier, 1024×1024, aux couleurs du thème |
| Écran de lancement | fond crème `#FAFAF8` |
| Apparence | claire forcée — sans quoi la barre d'état devient illisible sur un iPhone en mode sombre |
| Permission caméra | « L'appareil photo sert à scanner le code-barres de tes produits. » |

## À savoir avant de lancer

**L'identifiant de bundle est définitif.** `com.coursesapp.mobile` est un
choix par défaut : change-le maintenant si tu préfères autre chose, il devient
difficile à modifier une fois l'application déposée.

**Les variables d'environnement doivent être fournies à EAS.** `mobile/.env`
n'est pas versionné, donc la compilation dans le nuage ne le verra pas.
Déclare-les avant la première compilation :

```bash
npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://qmymwicsgilhoihtfdjm.supabase.co --environment production --visibility plaintext
npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value sb_publishable_PueJWmalqhZO0ctPu95GKQ_EaAgVulr --environment production --visibility plaintext
```

Ces deux valeurs sont publiques par conception — elles partent de toute façon
dans le paquet iOS, et le cloisonnement repose sur RLS, pas sur leur secret.

**Vérifie d'abord dans Expo Go.** Une compilation ratée coûte quinze minutes ;
`npx expo start` en coûte zéro.
