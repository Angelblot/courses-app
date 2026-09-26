# Courses

## Application utilisée sur iPhone

L’application iPhone est dans `mobile/` (Expo, authentification et données
Supabase). Elle comprend le scan vers les favoris et l’envoi des listes à
l’extension Chrome du dossier `extension/`.

Ces dossiers ont été récupérés depuis `mobile/expo-scan`. Le dossier
`frontend/` est une refonte web sur l’ancienne API `backend/` ; ce n’est pas
le code exécuté par l’application iPhone, et il ne synchronise pas encore
ses données Supabase. Ne pas confondre une modification du site local avec
une mise à jour de l’application installée.

- [Restauration, corrections et validation](docs/restauration-iphone-extension.md)
- [Installation et utilisation de l’extension Chrome](extension/README.md)
- [Configuration iPhone](mobile/.env.example)

## Vérification locale

Dans `mobile/` : `npm ci`, puis `npx tsc --noEmit`.
À la racine : `node --test mobile/lib/*.test.mjs extension/lib.test.mjs`
et `node extension/test-matching.mjs`.
