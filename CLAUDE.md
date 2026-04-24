# courses-app — Contexte Claude Code

## Projet
Application mobile-first de gestion de courses pour la famille. Permet de générer automatiquement des paniers drive (Carrefour, Leclerc) depuis des recettes et une checklist hebdomadaire.

## Stack
- **Backend** : FastAPI + SQLite (app.db) — port 8000
- **Frontend** : React + Vite + Tailwind — port 5174
- **Base données** : SQLite avec 65 produits Carrefour, table `purchase_lines`, `product_drives`, `drive_configs`
- **Objectif migration** : Supabase (auth + DB) + Vercel (deploy) + GitHub (versionning)

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
# Backend
cd ~/courses-app/backend && uvicorn app.main:app --reload --port 8000

# Frontend  
cd ~/courses-app/frontend && npm run dev

# Build frontend
cd ~/courses-app/frontend && npm run build

# DB shell
sqlite3 ~/courses-app/backend/app.db
```

## Fichiers clés
- `backend/app/main.py` — FastAPI app, routes enregistrées
- `backend/app/models/` — SQLAlchemy models
- `backend/app/routes/` — endpoints API
- `frontend/src/pages/` — pages principales
- `frontend/src/components/` — composants réutilisables
- `PRODUCT_BRIEF.md` — brief produit complet (source de vérité)
- `DESIGN.md` — architecture et propositions fonctionnelles
