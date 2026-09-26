# courses-app — Contexte Claude Code

## Projet
Application mobile-first de gestion de courses pour la famille. Permet de générer automatiquement des paniers drive (Carrefour, Leclerc) depuis des recettes et une checklist hebdomadaire.

## Stack
- **Application** : Expo SDK 57 / React Native / expo-router / TypeScript — `mobile/`
- **Données et authentification** : Supabase (Postgres, RLS, Realtime, Storage, Edge Functions)
- **Extension Chrome** : Manifest V3, remplit les paniers drive — `extension/`
- **Livraison iOS** : Xcode Cloud vers TestFlight (voir `mobile/XCODE_CLOUD.md`)

Le backend FastAPI et le front web React ont été retirés le 22/08/2026, une fois
toutes leurs données reprises dans Supabase. L'application mobile et l'extension
parlent directement à Supabase. Leur code reste consultable dans l'historique
git ; `DESIGN.md` en décrit l'architecture.

Le projet Vercel « courses » est **en pause depuis le 24/08/2026**. Il construisait
le front web par `cd frontend && npm install`, et échouait donc à chaque push
depuis son retrait. La pause est réversible : rien n'est supprimé, ni
l'historique ni les adresses `frontend-*.vercel.app`. Il n'y a aujourd'hui aucun
livrable web — l'application est distribuée par TestFlight.

## Workflow agents (RESPECTER CET ORDRE)

### 1. PM Agent — avant tout développement
Avant de coder une nouvelle feature, raisonner en Product Manager :
- Quelle est la vraie douleur utilisateur ?
- Quel est le parcours idéal (mobile, canapé, 30 secondes max) ?
- Quels sont les critères d'acceptation ?
- Y a-t-il des edge cases critiques (multi-utilisateur, offline, erreur scraper) ?

### 2. UX Agent — avant de toucher au code UI
Avant tout composant, raisonner en UX Designer :
- Mobile-first absolu (l'utilisateur est sur canapé, smartphone)
- Interactions simples : swipe, tap, bottom-sheet — pas de menus profonds
- Référence Dribbble / designs premium (jamais "cheap")
- Proposer la structure des composants et les états (loading, empty, error)

### 3. Dev Agent — implémentation
Après validation PM + UX :
- Respecter les conventions ci-dessous
- Tests sur les fonctions critiques (scraper, calcul quantités, génération panier)
- Screenshots à chaque étape UI notable

## Conventions UI (NON NÉGOCIABLES)
- **Zéro emoji dans l'interface** — jamais, ça fait cheap/IA
- **Thème clair premium** — fond blanc/crème, accents sobres (pas dark mode par défaut)
- **Vraies images produits** — Open Food Facts API ou retailer, jamais de stock photos génériques
- **Typographie** — Inter ou system-ui, hiérarchie claire
- **Composants** — bottom-sheet pour les actions mobiles, pas de modals centrés
- **Feedback** — toujours : loading states, messages d'erreur humains, confirmations discrètes

## Conventions code
- Python : 4 espaces, type hints, docstrings Google style
- TypeScript/JSX : 2 espaces, composants fonctionnels, hooks custom pour la logique
- Nommage : snake_case Python, camelCase JS, PascalCase composants
- API routes : `/api/{ressource}` — RESTful strict
- Pas de `console.log` en production, pas de `print()` debug laissés
- Commits : `feat:`, `fix:`, `refactor:`, `chore:` — en français ou anglais OK

## Fonctionnalités prioritaires (ordre)
1. **Wizard de génération de liste** — parcours recettes → checklist rayon par rayon → génération paniers
2. **Import recettes** — parsing titre/ingrédients, ajustement nb personnes, fusion quantités
3. **Auto-génération paniers drive** — scraper Playwright Carrefour + Leclerc en parallèle
4. **Comparatif prix** — tableau côte à côte Carrefour vs Leclerc, produits manquants
5. **Multi-utilisateur** — partage foyer, sync temps réel WebSocket

## Contexte utilisateur
- Usage principal : mobile sur canapé, commande mensuelle en famille
- Pain point #1 : devoir tout resaisir sur les sites Carrefour/Leclerc
- L'app DOIT générer les paniers automatiquement — c'est la raison d'être du produit
- Le wizard doit être fluide : "est-ce que tu as déjà X ?" — réponse en 1 tap

## Commandes utiles
```bash
# Application mobile
cd mobile && npx expo start

# Tests de l'app mobile — EXIGE Node >= 22
# Node 20 échoue sur ERR_UNKNOWN_FILE_EXTENSION : il ne charge pas les .ts.
# La version par défaut de la machine est la 20, d'où le `nvm use`.
cd mobile && nvm use 22 && node --test lib/*.test.mjs
```

## Workflow d'autonomie
- Claude Code travaille en complète autonomie après lancement — pas de micro-management
- Utiliser `--dangerously-skip-permissions` et `--max-turns 30` pour les tâches complexes
- Ne pas hésiter à explorer, itérer, et utiliser `/compact` si le contexte est plein
- En cas de blocage technique, chercher une solution par soi-même avant de demander

## Fichiers clés
- `mobile/app/` — écrans, routés par expo-router
- `mobile/lib/` — logique pure et testée : rayons, unités, consolidation, typologie,
  analyse des recettes importées. Aucun import de Supabase ni de React Native,
  pour rester exécutable sous `node --test`.
- `mobile/stores/` — accès aux données Supabase
- `extension/` — extension Chrome, et `extension/test-matching.mjs`
- `supabase/migrations/` — schéma, numérotées et jouées dans l'ordre
- `supabase/functions/` — fonctions Edge
- `PRODUCT_BRIEF.md` — brief produit complet (source de vérité)
- `DESIGN.md` — architecture du front web retiré, conservée pour référence
- `docs/superpowers/specs/` et `docs/superpowers/plans/` — conceptions courantes
