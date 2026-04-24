# DESIGN — Courses App

Ce document accompagne le refactor : il propose trois fonctionnalités à forte valeur
produit, décrit une architecture scalable pour accueillir ces évolutions, et trace un
plan de migration incrémental depuis la version actuelle.

---

## 1. Trois fonctionnalités proposées

### 1.1 Comptes utilisateurs et listes partagées en temps réel

**Problème.** Aujourd'hui l'app est mono-utilisateur (SQLite locale, pas
d'authentification). En pratique les courses sont un acte partagé : couple, colocation,
famille. Forcer un seul compte empêche deux personnes d'ajouter des articles en parallèle.

**Proposition.**
- Authentification par email + magic link (simple, sans mot de passe côté UX).
- Concept de **Household** (foyer) : un utilisateur appartient à 1..N foyers, les
  produits / listes / drives appartiennent à un foyer, pas à un utilisateur.
- Sync temps réel côté client : WebSocket par foyer, diffuse `list.item.added`,
  `list.item.checked`, `list.item.removed`. Les stores Zustand appliquent les events
  reçus comme des mutations locales idempotentes.
- Résolution de conflits simple : last-write-wins sur `checked`, accumulation sur
  `quantity` (deux ajouts = +1 chacun).

**Impact produit.** Fait passer l'app d'un outil perso à un outil de foyer — scénario
dominant des courses. Débloque aussi le partage de drives (un drive payé par un membre,
utilisé par tous).

---

### 1.2 Suggestions intelligentes « ce que tu achètes d'habitude »

**Problème.** L'utilisateur coche « favori » à la main, mais en réalité la majorité des
achats sont **récurrents avec une période** (pain tous les 2 jours, lessive tous les mois).
L'ajout manuel aux listes est friction.

**Proposition.**
- Enregistrer chaque `list.item.checked` dans une table `purchase_events`
  (product_id, user_id, date).
- Calculer en batch (job nightly ou au moment de créer une liste) une **cadence**
  par produit : médiane des intervalles entre achats sur les 90 derniers jours.
- Lors de la création d'une nouvelle liste, proposer : « Tu achètes du pain tous les
  2 jours, dernier achat il y a 3 jours → ajouter ? ». L'utilisateur accepte en un tap.
- Afficher un **score de confiance** : au moins 3 achats, écart-type < 50 % de la moyenne.
- Fallback : si pas assez de données, retomber sur le système actuel (favoris manuels).

**Impact produit.** Réduit la création de liste à « je vérifie ce que l'app propose »
au lieu de « je pense à tout ce dont j'ai besoin ». C'est le moment clé où l'app
devient indispensable.

---

### 1.3 Comparateur de prix multi-drives avec historique

**Problème.** L'app sait ajouter des articles à un drive, mais l'utilisateur n'a aucun
signal sur **où faire ses courses** ni sur les **variations de prix**. Les drives
promettent tous « les meilleurs prix ».

**Proposition.**
- Lors de chaque `add-to-cart`, capturer le prix observé (`ListItem.price_found` existe
  déjà) et l'écrire dans `price_history` (product_id, drive_name, price, date).
- Nouveau job Playwright périodique (1×/semaine sur les 50 produits les plus achetés
  du foyer) : simple recherche, pas d'ajout au panier, récupère le prix.
- UI **« Comparer »** sur un produit : graphique d'évolution + prix actuel dans chaque
  drive configuré.
- UI **« Liste optimisée »** : pour une liste donnée, l'app calcule le coût total par
  drive et recommande le moins cher (avec fallback si indisponible).

**Impact produit.** Transforme l'app en assistant d'achat au lieu d'un simple formulaire
de saisie. Lève l'objection « pourquoi j'utiliserais ça plutôt que le site Carrefour
directement ? ».

---

## 2. Architecture scalable

### 2.1 Principes directeurs

1. **Séparation stricte des couches** : routes (HTTP) → services (règles métier) →
   repositories (accès données) → modèles (SQLAlchemy). Le refactor backend en cours
   applique déjà ce découpage.
2. **Stateless API** : toute la persistance dans Postgres + Redis. Aucune dépendance
   au filesystem local. Ça rend l'app scalable horizontalement.
3. **Tâches asynchrones** : toute opération > 500 ms (scraping Playwright, calcul de
   suggestions, sync drive) passe par une queue. L'API HTTP reste rapide.
4. **Contrats explicites** : schémas Pydantic côté API, OpenAPI généré, types générés
   côté frontend (à terme TypeScript).
5. **Observabilité dès le départ** : logs structurés JSON, métriques Prometheus,
   traces OpenTelemetry. Sans ça, le debug du scraping en prod est impossible.

### 2.2 Topologie cible

```
                     ┌────────────────┐
                     │  CDN / Vercel  │  (frontend statique)
                     └───────┬────────┘
                             │
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway / Ingress                    │
└───────┬──────────────────────────────────────┬──────────────┘
        │                                      │
        │                                      │ WebSocket
        ▼                                      ▼
┌──────────────────┐                 ┌──────────────────┐
│   API FastAPI    │  ◄── Redis ──►  │   Realtime WS    │
│  (N replicas)    │      (pub/sub)  │   (N replicas)   │
└────┬─────┬───────┘                 └──────────────────┘
     │     │
     │     │ jobs
     │     ▼
     │  ┌──────────────────┐
     │  │   Task queue     │   Celery / RQ / Arq
     │  │  (Redis broker)  │
     │  └────────┬─────────┘
     │           │
     │           ▼
     │  ┌──────────────────┐
     │  │ Scraper workers  │   Playwright + rotating proxies
     │  │   (N replicas)   │
     │  └──────────────────┘
     │
     ▼
┌──────────────────┐
│    Postgres      │   (primary + read-replicas)
│  + row-level     │
│  security        │
└──────────────────┘
```

### 2.3 Composants et choix

| Composant | Techno | Raison |
|---|---|---|
| API | FastAPI + SQLAlchemy async | Continuité avec l'existant, typage fort, perf correcte |
| DB | Postgres 16 | SQLite suffit en mono-user, pas pour multi-tenant. RLS pour l'isolation par foyer |
| Cache / pub-sub | Redis | Broker de queue + pub-sub pour WebSocket + cache prix |
| Queue | Arq (ou Celery) | Jobs asynchrones pour scraping, suggestions, jobs cron |
| Scraper | Playwright dédié | Isolé de l'API — un crash Chromium ne tue pas le serveur. Pool de proxies résidentiels pour contourner les captchas |
| Frontend | React + Vite + Zustand | Déjà en place après ce refactor. TS à introduire plus tard |
| Realtime | FastAPI WebSocket + Redis pub-sub | Simple à opérer, scale horizontalement via Redis |
| Auth | Magic link (email) ou OAuth | Pas de mot de passe à gérer, UX mobile-friendly |
| Observabilité | OpenTelemetry + Grafana/Loki/Tempo | Stack open-source, corrèle logs/metrics/traces |
| CI/CD | GitHub Actions → registre GHCR → déploiement | En place après ce refactor |

### 2.4 Modèle de données (évolutions)

Nouvelles tables par rapport à aujourd'hui :

- `users` (id, email, created_at, last_login_at)
- `households` (id, name)
- `household_members` (household_id, user_id, role)
- `auth_tokens` (token_hash, user_id, expires_at) — pour magic links
- `purchase_events` (id, household_id, product_id, list_item_id, event_at) — alimente les suggestions
- `price_history` (id, product_id, drive_config_id, price, observed_at)
- `jobs` (id, type, payload, status, attempts, last_error) — registre des jobs async pour debug

Les tables existantes (`products`, `shopping_lists`, `list_items`, `drive_configs`)
gagnent une colonne `household_id` (FK NOT NULL) et une politique RLS Postgres.

### 2.5 Frontières et points de tension

- **Scraping fragile** : c'est le risque produit principal. Mitigation : quota strict
  par drive, retry exponentiel, feature-flag pour désactiver un drive cassé sans
  redéployer, alertes sur taux d'échec.
- **Chiffrement des credentials drive** : Fernet déjà en place, la clé doit venir d'un
  secret manager (AWS KMS, GCP KMS, Doppler) et jamais être en dur dans l'image.
- **Coût du scraping à grande échelle** : Playwright consomme ~300 Mo/RAM par worker.
  À N=1000 foyers qui scrapent toutes les semaines, ça reste gérable ; au-delà il
  faudra mutualiser (cacher les prix observés par d'autres foyers du même magasin).

---

## 3. Plan de migration

L'idée est d'avancer en **petits paliers déployables**, chacun fournissant de la
valeur, sans jamais casser le chemin critique (ajouter/voir ses courses).

### Phase 0 — Fondations (FAIT par ce refactor)

- Backend découpé en routes / services / repositories / schemas.
- Tests `pytest` couvrant health, produits, listes, drives, sécurité.
- Frontend découpé : stores Zustand, pages, composants réutilisables, design system
  mobile-first avec CSS variables.
- Dockerfile multi-stage + docker-compose avec volume de données.
- CI GitHub Actions : lint/tests backend, build frontend, build image Docker + smoke
  test du endpoint `/health`.

**État après phase 0 :** une image déployable, un pipeline vert, un code refactorable
sans peur.

### Phase 1 — Prod-readiness (2 semaines)

Objectif : pouvoir faire tourner l'app pour un premier user-test externe.

1. **Postgres** derrière `DATABASE_URL`. Migration Alembic. Les tests CI lancent un
   service Postgres éphémère.
2. **Secrets** : `ENCRYPTION_KEY` sourcée depuis un secret store, plus jamais par défaut.
3. **Logs structurés** (structlog) + endpoint `/metrics` Prometheus.
4. **Déploiement** : image poussée sur GHCR à chaque merge sur `main`, déploiement
   manuel (Fly.io / Railway / VPS).
5. **TypeScript** sur le frontend, `zod` pour les schémas API côté client (dérivés de
   l'OpenAPI via `openapi-typescript`).

### Phase 2 — Multi-utilisateur (3 semaines)

Objectif : fonctionnalité 1.1 (comptes + foyers partagés).

1. Tables `users`, `households`, `household_members`. Colonne `household_id` sur les
   tables existantes, backfill en une migration (toutes les données existantes → un
   foyer « default » appartenant à l'unique utilisateur créé).
2. Auth magic link (endpoint `POST /auth/request-link`, `GET /auth/callback`).
3. Middleware FastAPI d'injection de `current_user` + `current_household`.
4. RLS Postgres activé pour toutes les tables scopées.
5. Frontend : écran de login, sélecteur de foyer dans la navigation.
6. WebSocket `GET /ws/households/{id}` diffusant les events de mutation. Stores
   Zustand s'abonnent aux events pour refléter les changements en temps réel.

### Phase 3 — Suggestions (2 semaines)

Objectif : fonctionnalité 1.2.

1. Table `purchase_events`, alimentée sur chaque mutation `checked=true`.
2. Service `SuggestionService.compute(household_id) -> [Suggestion]` : calcul à la
   demande, résultat caché 1 h dans Redis.
3. Endpoint `GET /api/lists/{id}/suggestions`.
4. UI : bandeau au-dessus d'une liste vide avec propositions cliquables.

### Phase 4 — Jobs asynchrones + comparateur prix (3 semaines)

Objectif : fonctionnalité 1.3.

1. Introduire **Arq** (ou Celery) + worker séparé dans le `docker-compose` et le
   déploiement.
2. Déplacer le scraping drive actuel (ajout au panier) dans un job : l'API renvoie
   immédiatement un `job_id`, le frontend suit l'avancement via polling ou
   WebSocket.
3. Nouveau job `observe_prices(household_id)` programmé toutes les semaines.
4. Table `price_history`, endpoint `GET /api/products/{id}/prices`.
5. UI : modal « Historique prix » sur un produit, bandeau « meilleur drive pour
   cette liste ».

### Phase 5 — Robustesse scraping (continu)

Sur toute la durée : captures d'écran sur échec, classification des erreurs (captcha,
login invalide, sélecteur cassé), feature-flags par drive, tableau de bord du taux
de succès. C'est un travail incrémental, pas une phase bornée.

---

## 4. Ce qu'on ne fait **pas** (encore)

Il est au moins aussi important de nommer ce qu'on remet à plus tard :

- Application mobile native — la PWA suffit tant que les volumes d'usage ne le
  justifient pas.
- Recommandations cross-foyers (« les gens qui achètent X achètent Y ») — nécessite
  un volume de données qu'on n'aura pas avant ~1000 foyers actifs.
- Paiement in-app — hors périmètre produit, les drives gèrent leur propre checkout.
- Mode offline complet — le PWA/sw.js actuel est assez pour le cas d'usage « je remplis
  ma liste dans les allées du magasin sans réseau », mais une vraie résolution de
  conflits offline-first (type CRDT) est un chantier à part.

Ces choix peuvent changer, mais les graver ici évite qu'ils se glissent dans les
phases 1–4 et les fassent déraper.
