# Application iPhone et extension Chrome

Le 8 septembre 2026, récupération des dossiers `mobile/`, `extension/` et
`supabase/` depuis `origin/mobile/expo-scan`, commit
`880ec1c132c588c798ff2cc7fd4d720ff075d52e`.

La branche `main` utilisée pour la refonte web était antérieure à la migration
Expo/Supabase. Ses dossiers `frontend/` et `backend/` ne remplacent pas
l’application iPhone et ne partagent pas ses données. Ne pas publier le web
en prétendant mettre à jour l’application iPhone.

## Parcours conservés

- Onglet Scan natif Expo Camera, fiche Open Food Facts et confirmation d’ajout aux favoris.
- Saisie des produits inconnus et file de scans hors ligne conservée sur l’appareil.
- Catalogue, recettes, compte et foyer sur Supabase avec authentification existante.
- Ma liste → Supabase `cart_jobs` → extension Chrome → suivi dans l’application.
- Paiement effectué par l’utilisateur sur le drive.

## Corrections locales

- Accès « Scanner un produit » directement depuis Produits.
- Un produit déjà présent peut redevenir favori après scan, sans écraser son nom ou sa photo.
- La reprise des scans hors ligne applique la même règle.
- Refus définitif de caméra : bouton vers les réglages de l’iPhone.
- Instructions de connexion à l’extension à l’étape d’envoi.

## Vérification et livraison

Validation locale : 194 tests réussis, 71 vérifications de correspondance
réussies, TypeScript sans erreur et export JavaScript iOS réussi.

`npm ci` puis `npx tsc --noEmit` dans `mobile/`.
Tests : `node --test mobile/lib/*.test.mjs extension/lib.test.mjs` et
`node extension/test-matching.mjs` depuis la racine.
Export iOS : `npx expo export --platform ios` depuis `mobile/`.

La configuration de production iOS existante est conservée (`mobile/eas.json`
et `mobile/ios/`). Les variables `EXPO_PUBLIC_SUPABASE_URL` et
`EXPO_PUBLIC_SUPABASE_ANON_KEY` doivent désigner le même projet que l’extension,
conformément à `mobile/.env.example`.

La récupération des sources et l’export JavaScript ne mettent pas à jour le
binaire déjà installé sur l’iPhone. Une compilation iOS signée puis une
distribution par le canal habituel restent nécessaires. Le scan caméra réel
et le remplissage d’un panier connecté doivent encore être vérifiés sur les
appareils ; les tests locaux ne prouvent pas leur fonctionnement de bout en bout.
