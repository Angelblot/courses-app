# DESIGN — Courses App

Document de design produit & UX. Deux parties :

- **Partie I — Itération en cours.** Spécification détaillée des 4 features
  tactiques : édition inline, catégories visuelles, typologie de marques pour le
  wizard, nutrition Open Food Facts. Tokens, flows, composants, data model.
- **Partie II — Cap stratégique.** Trois features phares (foyers partagés,
  suggestions récurrentes, comparateur de prix), architecture cible, plan de
  migration. Reprend le document précédent et sert de toile de fond.

---

## 0. Principes directeurs

Cinq règles non-négociables qui précèdent toute décision de design. Les reste
du document s'y plie.

1. **Mobile canapé.** Cible : utilisateur sur un téléphone, à une main, dans
   un contexte distrait. Toutes les interactions majeures doivent être
   atteignables au pouce, tester si on peut faire le parcours en 30 s.
2. **Zéro emoji, zéro AI slop.** Pas de 🛒 dans les titres, pas de gradients
   violet-rose, pas de confettis. Le style est premium-sobre : blanc cassé,
   lignes fines, typographie Inter, accents vert sapin (`#2D6A4F`) et corail
   (`#E07A5F`) utilisés avec parcimonie.
3. **Pas de déplacement de vue non demandé.** Ouvrir un mode édition, cocher
   une case, sauvegarder : rien de tout ça ne doit scroller ou refermer la
   section courante. Le désancrage visuel est un bug produit.
4. **Vraies images produit.** Open Food Facts (via EAN13) ou retailer,
   jamais de stock photo. Fallback : image muette + icône `package`, jamais
   un placeholder illustré qui imite un produit.
5. **États explicites.** Chaque composant qui fait un I/O a quatre
   variantes pensées et stylées : idle, loading, empty, error. Pas de
   spinner plein écran — on préserve la structure et on grise.

---

## 1. Design tokens (Partie I)

Les tokens ci-dessous sont la source de vérité. Ils existent déjà dans
`frontend/src/styles/global.css` sous forme de variables CSS ; les nouvelles
features les réutilisent sans en créer de nouveaux, sauf mention explicite.

### 1.1 Palette

| Token                      | Valeur     | Rôle                                               |
|----------------------------|------------|----------------------------------------------------|
| `--color-bg`               | `#FAFAF8`  | Fond d'app, très légèrement crème pour adoucir     |
| `--color-surface`          | `#FFFFFF`  | Cartes, bottom sheets, formulaires                 |
| `--color-surface-warm`     | `#F7F4EC`  | Surfaces secondaires (bandeau, aside)              |
| `--color-surface-sunken`   | `#F3F1EC`  | Inputs en idle, chips inactives                    |
| `--color-text`             | `#1A1A1A`  | Texte principal                                    |
| `--color-text-muted`       | `#6B6B6B`  | Meta, labels, descriptions                         |
| `--color-text-subtle`      | `#9A9A97`  | Placeholder, icônes inactives                      |
| `--color-border`           | `#E8E8E6`  | Séparateurs, bordures idle                         |
| `--color-border-strong`    | `#D8D6D2`  | Bordure focus, bordure carte élevée                |
| `--color-accent`           | `#2D6A4F`  | Action primaire, état sélectionné                  |
| `--color-accent-soft`      | `#E6EFE9`  | Fond de chip catégorie active, badges              |
| `--color-coral`            | `#E07A5F`  | Favoris, alertes douces (pas critiques)            |
| `--color-beige`            | `#F2E8CF`  | Catégorie « Épicerie » (voir §3.3)                 |
| `--color-success`          | `#40916C`  | Toast confirmé, Nutriscore A                       |
| `--color-danger`           | `#D62828`  | Suppression, Nutriscore E                          |
| `--color-warning`          | `#D97706`  | Nutriscore D, dépassement seuil nutrition          |

**Rationale.** Accent vert sapin plutôt que bleu corporate : rappel alimentaire
sans tomber dans le vert pomme cheap. Coral réservé aux favoris et aux
moments « humains » (fallback gentil, tip utilisateur) — jamais pour une action
destructive.

### 1.2 Espacements & rayons

Échelle spacing en base 4 : `--space-1` (4px) → `--space-16` (64px). Touches
tactiles : minimum 44 × 44 px (`--tap`). Rayons : `sm 8` / `md 12` / `lg 16` /
`xl 22` / `2xl 28` / `full 999`. Les cartes produit utilisent `lg`, les
chips catégories `full`, les bottom sheets `2xl` en haut uniquement.

### 1.3 Typographie

Inter via `-apple-system` fallback. Échelle : `xs 12 / sm 13 / base 15 / md 16 /
lg 18 / xl 22 / 2xl 28 / 3xl 32`. Tous les titres h1–h4 sont en `font-weight:
700` avec `letter-spacing: -0.01em`. Les labels d'input sont en `sm` muted.

### 1.4 Ombres et transitions

`--shadow-xs` à `--shadow-lg` — les cartes restent en `xs` ou `card` au repos,
`md` seulement pour les overlays (bottom sheet, toast). Transitions :
`--t-fast 140ms`, `--t-base 240ms`, `--t-slow 420ms` avec easing `ease-out`
pour les apparitions, `ease-std` pour les micro-interactions.

### 1.5 Nouveaux tokens introduits pour cette itération

Trois seuls ajouts, tous justifiés ci-dessous.

| Token                         | Valeur             | Introduit pour                            |
|-------------------------------|--------------------|-------------------------------------------|
| `--radius-pill`               | alias de `full`    | Lisibilité dans les chips catégorie       |
| `--color-nutri-a`             | `#2E7D32`          | Pastille Nutriscore A                     |
| `--color-nutri-b`             | `#76B028`          | Pastille Nutriscore B                     |
| `--color-nutri-c`             | `#F5B700`          | Pastille Nutriscore C                     |
| `--color-nutri-d`             | `#E67E22`          | Pastille Nutriscore D                     |
| `--color-nutri-e`             | `#C62828`          | Pastille Nutriscore E                     |

**Pas de nouveau token pour les catégories.** Chaque catégorie se représente
avec une icône line (`stroke: currentColor`) et une teinte de fond tirée de la
palette existante (`surface-warm`, `accent-soft`, `coral-soft`, `beige-soft`).
Voir §3.3.

---

## 2. Feature 1 — Édition inline des produits

### 2.1 Problème

Actuellement, cliquer « Éditer » sur une carte produit ouvre `ProductDetailModal`
(drawer plein-écran) qui fait perdre le contexte visuel. L'utilisateur
édite un produit en position 14 de la liste ; au retour, la vue se remet
en haut. Perte de repère systématique.

### 2.2 Proposition

Transformer la carte `ProductCard` en carte-formulaire **à la place**, sans
déplacement de la vue. Deux transitions seulement :

1. `idle` → `editing` : la carte garde sa hauteur (±4 px de padding
   supplémentaire), les champs métadonnées (brand, catégorie, quantité,
   unité) passent d'affichage à inputs inline, l'image reste au même endroit.
2. `editing` → `idle` : sauvegarde au blur du dernier champ *ou* bouton
   confirmation explicite ; la carte reprend son apparence, un micro-flash
   de 200 ms (`accent-soft`) confirme la mutation.

Le modal `ProductDetailModal` **reste** mais n'est plus le chemin d'édition —
il devient un « détail + historique » : fiche complète, historique prix,
données OFF (feature 4). Ouvert par tap sur le corps de la carte, pas sur le
bouton edit.

### 2.3 User flow

```
Liste produits (idle)
  │
  │  tap « éditer » sur carte i
  ▼
Carte i → mode editing (vue non scrollée)
  ├── focus auto sur champ "nom"
  ├── Tab cycle : nom → marque → catégorie → quantité → unité
  ├── Escape → cancel (pas de sauvegarde, retour idle)
  ├── blur hors carte → save si dirty, sinon cancel
  └── tap « check » → save explicite
      │
      ▼
    Optimistic update → carte repeint idle + flash accent-soft 200 ms
      │
      └── échec API → rollback + toast erreur inline dans la carte
```

**Points critiques.**

- Le scroll position de la liste est **verrouillé** pendant la transition.
  `scrollIntoView({ block: "nearest" })` uniquement si la carte éditée est
  hors viewport (cas rare mais possible si on arrive par keyboard nav).
- Si une autre carte est déjà en édition avec des modifs dirty, tap sur
  « éditer » d'une deuxième carte doit d'abord sauver (ou prompt) la première.
  Règle simple : save auto silencieux. Pas de modal « voulez-vous sauver ? ».
- Swipe Tinder préservé : en mode édition, le swipe reste armé sur les
  autres cartes mais désactivé sur la carte active.

### 2.4 Composant `ProductCardEditable`

Nouveau composant dans `frontend/src/components/products/`. Remplace
`ProductCard` quand `isEditing === true` plutôt que d'être un composant séparé
— mais en interne, c'est une branche de rendu distincte.

```jsx
<ProductCardEditable
  product={product}
  onSave={(patch) => updateProduct(product.id, patch)}
  onCancel={() => setEditingId(null)}
  onDelete={() => deleteProduct(product.id)}
  categories={uniqueCategories}   // pour le <CategorySelect/>
  autoFocusField="name"
/>
```

**Structure visuelle.**

```
┌────────────────────────────────────────────────────────────┐
│ [img 56×56]  [input name (font-weight 600)]  [× cancel]   │
│              [input brand — placeholder "Marque"]          │
│              [CategorySelect chip-style]                   │
│              [qty input 48px] [unit select] [✓ save]       │
└────────────────────────────────────────────────────────────┘
  fond: surface (même que carte idle) ; bordure: border-strong ; shadow: sm
  radius: lg ; padding: space-4 ; gap interne: space-2
```

**Inputs.** Taille `min-height: var(--tap)`, padding `12px 14px`, bordure
`1px solid var(--color-border)`, focus → `border: 1.5px solid var(--color-accent)`,
pas de shadow de focus (on reste sobre), simplement le changement de bordure.

**Sauvegarde.** Stratégie hybride :
- **Blur simple** d'un champ → debounce 400 ms → PATCH partiel.
- **Submit explicite** (`✓`) → PATCH immédiat + exit editing.
- **Pending state** : la carte reste en editing avec un spinner 12 px dans
  le bouton ✓, inputs disabled, pas d'overlay plein écran.

### 2.5 États

| État      | Visuel                                                               |
|-----------|----------------------------------------------------------------------|
| idle      | Carte standard `ProductCard`                                         |
| hover     | `shadow-sm`, border inchangée                                        |
| editing   | Carte-form, focus sur premier champ, bouton `×` et `✓`               |
| saving    | Inputs disabled, ✓ en spinner, opacité 0.9                           |
| saved     | Flash `accent-soft` 200 ms → retour idle                             |
| error     | Toast inline en bas de carte (`danger-soft`), carte reste en editing |
| deleting  | Fade out 220 ms + collapse de hauteur                                |

### 2.6 Accessibilité

- Le bouton « éditer » sur la carte idle annonce
  `aria-label="Éditer {nom du produit}"`.
- Entrée en editing : `role="form"` sur la carte, `aria-labelledby` pointant
  sur le champ nom.
- `aria-live="polite"` sur un span caché `#edit-status` pour annoncer
  « Produit enregistré » / « Erreur : … » aux lecteurs d'écran.
- `Escape` annule, `Enter` dans le dernier champ soumet, `Tab`/`Shift+Tab`
  cyclent entre les champs et restent dans la carte (focus trap léger).

### 2.7 Ce qu'on ne fait pas

- Pas d'édition multi-cartes simultanée — coûteux et confusionnant.
- Pas de champs avancés en inline (prix, EAN, notes long text) — ceux-là
  restent dans le détail modal. L'inline couvre 80 % des cas : renommer,
  reclasser, ajuster quantité.
- Pas d'undo toast type Gmail — le rollback sur erreur suffit, le coût
  d'implé n'est pas justifié à cette étape.

---

## 3. Feature 2 — Catégories avec visuels attractifs

### 3.1 Problème

Actuellement, `product.category` est un string libre affiché brut (`P.L.S.`,
`CHARCUT.TRAITEUR`, `FRUITS ET LEGUMES`). Aucune hiérarchie visuelle, pas de
filtre par catégorie, et les libellés en MAJUSCULES sont importés tels quels
de Carrefour. C'est laid et ça empêche de scanner la liste.

### 3.2 Proposition

Trois évolutions coordonnées :

1. **Normaliser** les catégories en un set canonique (9 catégories Carrefour
   + 1 "Autres"), avec un libellé humain affiché en capitale initiale
   uniquement. Le champ DB reste un string (pas de migration lourde) mais
   passe par une table de mapping côté backend.
2. **Iconographie line dédiée** par catégorie, dans le style Lucide (déjà
   utilisé via `Icon.jsx`). Ajout de 10 icônes au registry existant.
3. **UI filtrable** : une barre de chips catégorie horizontalement scrollable
   en haut de `ProductsPage`, chaque chip = icône + libellé + count. Chip
   sélectionnée filtre la liste ; par défaut aucune sélection (tout visible).

### 3.3 Taxonomie canonique

| Clé              | Libellé affiché        | Icône (Lucide)  | Teinte de fond          |
|------------------|------------------------|-----------------|-------------------------|
| `fruits_legumes` | Fruits & légumes       | `apple`         | `#E8F2DC` (vert tendre) |
| `pls`            | Produits laitiers      | `milk`          | `#F4ECE2` (crème)       |
| `charcuterie`    | Charcuterie & traiteur | `ham`           | `#F7E4DA` (rose pâle)   |
| `boissons`       | Boissons               | `cup-soda`      | `#E3EEF2` (bleu glacier)|
| `epicerie`       | Épicerie               | `package-2`     | `#F2E8CF` (beige)       |
| `droguerie`      | Droguerie              | `spray-can`     | `#ECE8F2` (lilas)       |
| `parfumerie`     | Hygiène                | `sparkles`      | `#F2E8EF` (rose poudré) |
| `maison`         | Maison                 | `home`          | `#ECEDE8` (gris vert)   |
| `surgeles`       | Surgelés               | `snowflake`     | `#E3ECF2` (bleu frais)  |
| `autre`          | Autres                 | `tag`           | `#F3F1EC` (sunken)      |

**Rationale des teintes.** Chaque teinte est désaturée à ~15 % de saturation
maximum pour rester premium. La chip active passe sur `accent` (fond vert
sapin plein, texte blanc) — l'association catégorie/teinte n'est utilisée
que pour la *chip au repos* et la *pastille dans la carte produit*, jamais
comme couleur de fond de section.

**Pas de teinte violent, pas de gradient.** Un test simple : une catégorie
posée à côté d'une autre ne doit jamais ressembler à un marketing landing.

### 3.4 Composant `CategoryChipBar`

Nouveau composant dans `frontend/src/components/products/`.

```jsx
<CategoryChipBar
  categories={catalog}              // [{key, label, icon, count}]
  activeKey={activeCategoryKey}     // string | null
  onChange={(key) => setFilter(key)}
/>
```

**Layout.** `flex` horizontal, `overflow-x: auto`, `scroll-snap-type: x
mandatory`, `gap: var(--space-2)`, `padding: var(--space-2) var(--space-4)`.
Scrollbar masquée (webkit), inertie iOS activée. La barre colle en sticky
sous le header `ProductsPage` (`top: 56px`) avec un fade-out en bas pour la
transition vers la liste.

**Chip.**

```
┌────────────────────────┐
│ [icon 16] Fruits (12)  │    idle: bg teinte catégorie, text muted
└────────────────────────┘

┌────────────────────────┐
│ [icon 16] Fruits (12)  │    active: bg accent, text contrast
└────────────────────────┘
```

- Padding `8px 14px`, `border-radius: var(--radius-full)`, `font-size: sm`,
  `font-weight: 500`.
- Hauteur cible `36 px` — sous le `--tap` de 44 px : on compense en élargissant
  la zone cliquable via `::before` qui déborde verticalement de 4 px.
- Transition `background var(--t-fast), color var(--t-fast)`.

### 3.5 Intégration dans la carte produit

Sur chaque `ProductCard`, remplacer le texte brut de catégorie (ligne
`item__meta`) par une mini-chip :

```
┌─────────────────────────────────────────────────┐
│ [img]  Coca-Cola Zéro            [prix ↑]       │
│        [chip Boissons]  ·  Pack 6×33 cl         │
└─────────────────────────────────────────────────┘
```

La mini-chip reprend l'icône et la teinte de catégorie mais sans count
(c'est l'info locale). Taille `14 × taille sm`. Tap sur la mini-chip :
filtre la liste par cette catégorie (shortcut utile depuis une liste mixte).

### 3.6 Filtrage & état

- Source unique : query param `?category=fruits_legumes` dans l'URL, pour
  partager un lien filtré et préserver l'état au reload.
- Store Zustand `productsStore` reçoit `activeCategory` et expose un
  `filteredProducts` dérivé.
- Reset visible : si `activeCategory !== null`, une pill « × Tout afficher »
  s'insère en premier dans la `CategoryChipBar`.

### 3.7 Migration des données existantes

Pas de migration schema. On ajoute :

- Une table `category_aliases` (clé `label_raw` → `key_canonical`) seedée
  avec les libellés Carrefour actuels (`P.L.S.` → `pls`, etc.).
- Un endpoint `GET /api/categories` qui renvoie `[{key, label, icon, count}]`
  prêt pour la chip bar.
- Le champ `products.category` reste un libre string ; un *helper* backend
  retourne `category_key` et `category_label` via le mapping au moment de la
  sérialisation Pydantic. Si pas de mapping : fallback `autre`.

**Rationale.** Faire une vraie migration vers un FK catégorie est tentant
mais coûte trois jours et bloque l'itération. Le mapping en lecture est
réversible, suffisant pour l'UI, et on pourra consolider plus tard si
besoin.

### 3.8 Accessibilité

- Chaque chip annonce `aria-label="Filtrer par {label}, {count} produits"`.
- Chip active : `aria-pressed="true"`.
- La `CategoryChipBar` a `role="toolbar"` + `aria-label="Filtres catégorie"`.
- Navigation clavier : flèches gauche/droite pour parcourir, Enter pour
  sélectionner, Escape pour reset.

### 3.9 Ce qu'on ne fait pas

- **Pas de photos de catégorie.** Image de pommes pour « Fruits » ressemble
  à un template Canva. Icône line suffit.
- **Pas de grille pleine page catégories.** On refuse un écran « choisis
  ta catégorie » avant les produits — c'est une friction inutile, le filtre
  suffit.
- **Pas de multi-select** dans cette itération. Un seul filtre actif à la
  fois ; le besoin de multi-filter est rare et alourdit la barre.

---

## 4. Feature 3 — Typologie de marques pour wizard & scraping

### 4.1 Problème

Le wizard va générer une liste puis la pousser vers Playwright pour remplir
le panier Carrefour / Leclerc / Auchan. Mais chaque produit a une
**typologie de marque** qui conditionne la requête à faire :

- **Marque commune (`common`)** : Coca-Cola, Nutella, Activia. Existe dans
  tous les drives → on cherche par nom + marque exacts.
- **Marque distributeur (`store_brand`)** : Carrefour Bio, Leclerc Marque
  Repère, Auchan Premier Prix. → chez Carrefour on cherche la version
  Carrefour, chez Auchan la version Auchan. Sinon équivalent générique.
- **Générique / sans marque (`generic`)** : œufs frais, tomates, baguette.
  → on cherche le produit par nom et caractéristique (bio, calibre), sans
  marque.

Sans cette typologie, le scraper risque de chercher « Œufs Carrefour » chez
Auchan → 0 résultat, fallback hasardeux, panier incomplet.

### 4.2 Data model

Ajout d'une colonne sur `products`.

```sql
ALTER TABLE products
  ADD COLUMN brand_type TEXT NOT NULL DEFAULT 'common'
    CHECK (brand_type IN ('common', 'store_brand', 'generic'));

ALTER TABLE products
  ADD COLUMN store_brand_affinity TEXT  -- 'carrefour', 'leclerc', 'auchan', NULL
    DEFAULT NULL;
```

Et une table de correspondance pour la recherche cross-drive :

```sql
CREATE TABLE product_equivalents (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  drive_name TEXT NOT NULL,                  -- 'carrefour' | 'leclerc' | ...
  search_query TEXT NOT NULL,                -- requête à envoyer
  expected_brand TEXT,                       -- contrôle de l'equivalent
  expected_ean13 TEXT,                       -- si connu, match fort
  last_confirmed_at TIMESTAMP,
  UNIQUE (product_id, drive_name)
);
```

**Rationale.** `brand_type` est l'info de base, `store_brand_affinity`
indique si la MDD est rattachée à un magasin (ex : produit seedé depuis
Carrefour = affinité Carrefour). `product_equivalents` stocke la requête
scraping par magasin avec un contrôle léger (brand attendue, EAN si on
l'a obtenu). Cette table se remplit progressivement : manuellement au
départ, auto-remplie au fur et à mesure que le scraper trouve le bon
résultat.

### 4.3 Stratégie de recherche par typologie

Logique déterministe dans un service `SearchStrategyService`.

| brand_type     | store_brand_affinity | Drive cible    | Requête envoyée                       |
|----------------|----------------------|----------------|---------------------------------------|
| `common`       | *                    | Carrefour      | `{name} {brand}`                      |
| `common`       | *                    | Leclerc        | `{name} {brand}`                      |
| `store_brand`  | `carrefour`          | Carrefour      | `{name} Carrefour`                    |
| `store_brand`  | `carrefour`          | Leclerc        | `{name}` (sans marque, équivalent)    |
| `store_brand`  | `leclerc`            | Carrefour      | `{name}`                              |
| `generic`      | *                    | Carrefour      | `{name}` (+ attributs : bio, calibre) |
| `generic`      | *                    | Leclerc        | `{name}`                              |

Un override par `product_equivalents` est toujours prioritaire sur la règle
générique ci-dessus. Si un equivalent est stocké et `last_confirmed_at`
< 30 jours, on l'utilise sans passer par la règle.

### 4.4 UX wizard — étape « typologies »

Nouvelle micro-étape dans le flow wizard, entre « recap liste » et « lancer
la génération ». Elle n'apparaît **que si** au moins un produit de la liste
a un `brand_type` non défini *ou* pas d'`equivalent` pour le drive cible.

```
┌─────────────────────────────────────────────────────────────┐
│  WizardStepper [Liste · Vérif · Génération]                 │
│                                                              │
│  Quelques produits ont besoin d'un coup d'œil                │
│  Confirme comment les chercher sur Carrefour Drive.          │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ [img] Œufs frais bio × 6                             │    │
│  │ Typologie : Générique (sans marque) ▾                │    │
│  │ Chercher sur Carrefour : "œufs frais bio × 6"   ✎   │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ [img] Nutella pâte à tartiner 400 g                  │    │
│  │ Typologie : Marque commune ▾                         │    │
│  │ Chercher : "Nutella pâte à tartiner 400 g"      ✎   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  [Tout est bon, lancer le scraping]       [Retour]           │
└─────────────────────────────────────────────────────────────┘
```

**Interaction.**

- La typologie est un select tri-options (commune / distributeur / générique).
  Changer la valeur met à jour la requête aperçue en temps réel.
- La requête est éditable (icône `pencil` 14 px) — override manuel stocké
  dans `product_equivalents` dès la soumission.
- Bouton principal : « Tout est bon, lancer le scraping » en `accent` plein.
- Si la liste est longue (> 10 produits à confirmer), la page propose un
  toggle « ne montrer que les incertains » (cachés par défaut : ceux déjà
  confirmés dans les 30 derniers jours).

**Règle d'inférence au défaut.** Quand on crée un produit :
- Si `brand` contient l'un de `["Carrefour", "Leclerc", "Auchan", ...]` →
  `brand_type = store_brand` + `store_brand_affinity = brand.lower()`.
- Sinon si `brand` est vide → `brand_type = generic`.
- Sinon → `brand_type = common`.

L'utilisateur peut toujours corriger dans l'étape wizard ou dans la fiche
produit (nouveau champ dans `ProductForm`).

### 4.5 Composants nouveaux / modifiés

| Composant                        | Emplacement                                  | Rôle                           |
|----------------------------------|----------------------------------------------|--------------------------------|
| `BrandTypeSelect` (nouveau)      | `components/products/BrandTypeSelect.jsx`    | Select commun/distrib/générique|
| `WizardBrandTypologyStep` (new)  | `components/wizard/BrandTypologyStep.jsx`    | Étape wizard ci-dessus         |
| `ProductForm` (modifié)          | `components/products/ProductForm.jsx`        | Ajout select + affinité        |
| `SearchStrategyService` (new)    | `backend/app/services/search_strategy.py`    | Logique §4.3                   |

### 4.6 Contrat API

```http
GET  /api/wizard/plan?list_id=123&drive=carrefour
→ 200 [{ product_id, name, brand_type, search_query, confidence: 'high'|'low' }]

PATCH /api/products/{id}
     { brand_type, store_brand_affinity }

PUT  /api/products/{id}/equivalents
     { drive_name, search_query, expected_brand?, expected_ean13? }
```

`confidence: 'low'` quand aucun equivalent n'est confirmé < 30 jours ou que
`brand_type` est NULL (pré-migration). Le frontend se sert de ce champ pour
décider quoi afficher dans l'étape wizard.

### 4.7 États

| État                          | Visuel / comportement                         |
|-------------------------------|------------------------------------------------|
| Aucun produit à confirmer     | Étape skippée, on passe direct à la génération |
| 1–5 produits à confirmer      | Liste complète visible                         |
| > 10 produits à confirmer     | Filtre « incertains uniquement » actif par déf |
| User a modifié la requête     | Badge `modifié` coral soft + save on next      |
| API error sur PATCH           | Toast inline, pas de blocage du flow           |

### 4.8 Accessibilité

- Le select `BrandTypeSelect` est un `<select>` natif (pas un menu custom)
  pour la compatibilité lecteur d'écran et l'UX mobile.
- Chaque carte produit a un `aria-label` complet `"Œufs frais bio, typologie
  générique, requête Carrefour œufs frais bio"`.
- Le bouton « éditer requête » (`✎`) a `aria-label="Modifier la requête de
  recherche pour {name} chez {drive}"`.

### 4.9 Ce qu'on ne fait pas

- **Pas de matching ML.** Tentant d'entraîner un modèle pour inférer
  brand_type depuis (name, brand) — mais la règle heuristique couvre > 95 %,
  le reste est confirmé par l'utilisateur. Pas le bon ROI maintenant.
- **Pas de scraping sonde pour détecter automatiquement la dispo dans
  chaque drive.** On alimente `product_equivalents` au fil de l'usage
  réel (quand le scraper trouve, on enregistre). Éviter le bruit.

---

## 5. Feature 4 — Données nutritionnelles via Open Food Facts

### 5.1 Problème

Les produits n'ont aucune info nutritionnelle. L'utilisateur ne peut pas
arbitrer entre deux yaourts, ni se rendre compte qu'il a accumulé 400 g de
sucre dans la liste de la semaine.

### 5.2 Proposition

- Récupérer la donnée OFF par EAN13 dès qu'un produit en a un, la stocker
  dans une table dédiée, rafraîchir au max 1×/30 jours.
- Afficher un **badge Nutriscore** dans la carte produit (mini, coin bas-droit
  de l'image).
- Afficher la **fiche nutrition** dans `ProductDetailModal` (étendu).
- Ajouter un **bandeau hebdo** en haut de la page liste : *« Cette semaine :
  12 g sucre/jour en moyenne. Dépassement OMS (25 g) : non. »* avec tap =
  détail par nutriment.

### 5.3 Source de données — Open Food Facts

Endpoint : `https://world.openfoodfacts.org/api/v2/product/{ean13}.json`.
User-Agent obligatoire : `courses-app/1.0 (contact@ai-optimiz.com)`.

**Champs consommés** (chemin JSON → notre colonne) :

| Chemin OFF                             | Colonne `nutrition_facts`  |
|----------------------------------------|----------------------------|
| `product.nutriscore_grade`             | `nutriscore` (a–e)         |
| `product.nutriments.energy-kcal_100g`  | `kcal_per_100`             |
| `product.nutriments.proteins_100g`     | `proteins_per_100`         |
| `product.nutriments.carbohydrates_100g`| `carbs_per_100`            |
| `product.nutriments.sugars_100g`       | `sugars_per_100`           |
| `product.nutriments.fat_100g`          | `fat_per_100`              |
| `product.nutriments.saturated-fat_100g`| `saturated_fat_per_100`    |
| `product.nutriments.salt_100g`         | `salt_per_100`             |
| `product.nutriments.fiber_100g`        | `fiber_per_100`            |
| `product.image_nutrition_url`          | `image_nutrition_url`      |
| `product.ingredients_text_fr`          | `ingredients_text`         |
| `product.allergens_tags` (liste)       | `allergens` (JSON array)   |

**Robustesse.**

- Si OFF renvoie `status: 0` (produit inconnu) → on insère une ligne
  `nutrition_facts` avec `source_status = 'not_found'` pour ne pas re-query
  toutes les 5 s.
- Rate limit OFF : 100 req/min anon. On fait un worker asynchrone (Phase 4
  de la migration) avec un backoff et un cap à 30 req/min par précaution.
- Timeout 5 s, retry 2× avec backoff exponentiel.

### 5.4 Data model

```sql
CREATE TABLE nutrition_facts (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ean13 TEXT NOT NULL,
  nutriscore TEXT,                       -- 'a' | 'b' | 'c' | 'd' | 'e' | NULL
  kcal_per_100 REAL,
  proteins_per_100 REAL,
  carbs_per_100 REAL,
  sugars_per_100 REAL,
  fat_per_100 REAL,
  saturated_fat_per_100 REAL,
  salt_per_100 REAL,
  fiber_per_100 REAL,
  image_nutrition_url TEXT,
  ingredients_text TEXT,
  allergens_json TEXT,                   -- JSON array stringifié (SQLite)
  source_status TEXT NOT NULL,           -- 'ok' | 'not_found' | 'error'
  fetched_at TIMESTAMP NOT NULL,
  UNIQUE (product_id)
);
CREATE INDEX idx_nutri_ean ON nutrition_facts(ean13);
```

**Politique de refresh.** Un champ calculé côté service : si
`fetched_at > now - 30 days` → on sert le cache. Sinon → on planifie une
re-fetch (non bloquante). L'UI affiche toujours la dernière version connue.

### 5.5 Composants

| Composant                     | Rôle                                              |
|-------------------------------|---------------------------------------------------|
| `NutriscoreBadge`             | Pastille 24 × 14 px, lettre + fond (a–e)          |
| `NutritionFacts` (section)    | Grille 2 colonnes dans `ProductDetailModal`       |
| `WeeklyNutritionBanner`       | Bandeau haut de `ListsPage` — 1 métrique clé + CTA|
| `NutritionDetailSheet`        | Bottom sheet avec détail hebdo par nutriment      |

### 5.6 `NutriscoreBadge`

```
┌────┐
│ A  │    fond #2E7D32, texte blanc, font-weight 800, font-size 11
└────┘

┌────┐
│ D  │    fond #E67E22, texte blanc
└────┘
```

Position sur la `ProductCard` : en overlay dans l'angle bas-droit de
l'image 56 × 56, avec 4 px d'offset et une ombre `shadow-xs`. Si pas de
score connu : pas de badge (jamais de `?` ni de gris — on préfère l'absence).

### 5.7 Fiche nutrition dans `ProductDetailModal`

Étendue existante du modal. Ajout d'une section sous l'historique prix.

```
┌───────────────────────────────────────────────────┐
│ Nutrition (pour 100 g)                            │
│                                                   │
│  [Nutriscore A]     123 kcal                      │
│                                                   │
│  Protéines ────────────  8.2 g                    │
│  Glucides ─────────────  14.0 g                   │
│    dont sucres ─ warning   11.3 g                 │
│  Lipides ──────────────  2.1 g                    │
│    dont saturés          0.8 g                    │
│  Sel ──────────────────  0.4 g                    │
│  Fibres ───────────────  1.9 g                    │
│                                                   │
│  Dernière mise à jour : il y a 8 jours · OFF      │
└───────────────────────────────────────────────────┘
```

**Interactions.**

- Tap sur `OFF` → lien externe vers la fiche complète openfoodfacts.org.
- Ligne « dont sucres » avec pastille `warning` si `sugars_per_100 > 10`,
  `danger` si `> 22.5` (seuils Nutri-Score sugars).
- Si `source_status = 'not_found'` : section collapsed avec CTA
  « Chercher manuellement ce produit sur Open Food Facts » (lien
  `https://world.openfoodfacts.org/cgi/search.pl?search_terms={name}`).

### 5.8 Bandeau hebdo — consommation agrégée

Pas une feature anxiogène, donc règles strictes :

- **1 seul chiffre mis en avant** par semaine, en rotation : sucres, sel,
  saturés. Pas de dashboard surchargé.
- **Seuil de référence OMS** cité explicitement : *« OMS recommande
  < 25 g de sucre libre/jour »*. Source visible au tap.
- **Ton factuel, pas moraliste** : *« 18 g sucre/jour en moyenne. En dessous
  du seuil OMS. »* — jamais « bravo ! » ni emoji.

```
┌────────────────────────────────────────────────────┐
│ Cette semaine · sucres                             │
│ 18 g/jour en moyenne · OMS : < 25 g/jour           │
│ [barre de progression sur surface-warm]     [>]    │
└────────────────────────────────────────────────────┘
 padding: space-4 ; radius: lg ; background: surface-warm
 bordure: 1px solid border ; shadow: none
```

Calcul : agrégation `purchase_lines` × `quantity_ordered` × taille portion
nutrition / 7 jours. Honnête sur l'approximation : tooltip explique qu'on
suppose 1 portion/jour/personne, et qu'on ne mesure pas la consommation
réelle.

### 5.9 Backfill & sync

- **One-shot backfill.** Script `scripts/fetch_off_nutrition.py` aligné sur
  `fetch_off_images.py` : itère les 65 produits avec EAN, log, rate-limit.
- **Sync au create/update.** Dans `ProductService.create()` et `.update()`,
  si `ean13` a changé et non vide → enqueue job `fetch_nutrition(product_id)`.
- **Refresh lazy.** Quand un utilisateur ouvre le détail d'un produit, si
  `fetched_at > 30 jours` → enqueue un refresh non bloquant ; l'UI affiche
  la donnée existante.

### 5.10 Accessibilité

- `NutriscoreBadge` : `aria-label="Nutriscore {lettre}, {interprétation}"`
  (A = « très bon », E = « à limiter »).
- Les lignes de nutrition sont un `<dl>` sémantique (dt = label, dd = valeur
  + unité), pas une table, pour une lecture naturelle au screen reader.
- Contrast ratio des badges Nutriscore testé AA minimum sur fond blanc et
  sur image (overlay 8 % noir si image très claire).

### 5.11 Ce qu'on ne fait pas

- **Pas de calcul calorique personnalisé** (besoin métabolique, activité…).
  On sort du produit courses vers coach nutrition : hors scope.
- **Pas de recommandation de substituts.** « Remplacer par ce produit
  moins sucré » est une feature tentante mais impossible sans catalogue
  nettoyé. À repousser.
- **Pas de scanner code-barres mobile pour l'instant.** Le navigateur
  mobile peut le faire via `BarcodeDetector`, mais la demande vient en
  Feature 4-bis, pas ici.

---

## 6. Data model — récapitulatif des évolutions

Synthèse des changements introduits par les 4 features.

### Ajouts de colonnes

```sql
-- Feature 3
ALTER TABLE products ADD COLUMN brand_type TEXT NOT NULL DEFAULT 'common';
ALTER TABLE products ADD COLUMN store_brand_affinity TEXT DEFAULT NULL;
```

### Nouvelles tables

```sql
-- Feature 2
CREATE TABLE category_aliases (
  label_raw TEXT PRIMARY KEY,
  key_canonical TEXT NOT NULL
);

-- Feature 3
CREATE TABLE product_equivalents (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  drive_name TEXT NOT NULL,
  search_query TEXT NOT NULL,
  expected_brand TEXT,
  expected_ean13 TEXT,
  last_confirmed_at TIMESTAMP,
  UNIQUE (product_id, drive_name)
);

-- Feature 4
CREATE TABLE nutrition_facts (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  ean13 TEXT NOT NULL,
  nutriscore TEXT,
  kcal_per_100 REAL, proteins_per_100 REAL, carbs_per_100 REAL,
  sugars_per_100 REAL, fat_per_100 REAL, saturated_fat_per_100 REAL,
  salt_per_100 REAL, fiber_per_100 REAL,
  image_nutrition_url TEXT, ingredients_text TEXT, allergens_json TEXT,
  source_status TEXT NOT NULL,
  fetched_at TIMESTAMP NOT NULL
);
CREATE INDEX idx_nutri_ean ON nutrition_facts(ean13);
```

### Migrations Alembic

Ordre suggéré (une révision par feature) :

1. `20260425_01_brand_type.py` — ajout colonnes `brand_type` +
   `store_brand_affinity`, backfill via règle heuristique §4.4 (marques
   Carrefour/Leclerc → `store_brand`, brand vide → `generic`).
2. `20260425_02_product_equivalents.py` — création table.
3. `20260425_03_category_aliases.py` — création + seed des 9 mappings
   Carrefour actuels.
4. `20260425_04_nutrition_facts.py` — création table.

Rollback sûr : `DROP TABLE` + `ALTER TABLE DROP COLUMN` (SQLite 3.35+
supporte DROP COLUMN). Les données nutrition et equivalents sont
reconstructibles depuis OFF et heuristique.

---

## 7. Accessibilité & responsive

### 7.1 Cibles techniques

- **Conformité** : WCAG 2.1 AA sur tous les parcours critiques (édition,
  filtrage catégorie, wizard typologies, lecture nutrition).
- **Contrast ratio** : 4.5:1 texte sur fond, 3:1 texte large et
  éléments graphiques non textuels. Tous les badges Nutriscore et chips
  catégorie sont validés.
- **Target size** : minimum 44 × 44 px pour toute cible tap (`--tap`).
  Les chips catégorie à 36 px étendent leur zone cliquable via padding
  virtuel `::before` +4 px vertical.
- **Focus visible** : bordure 1.5 px `--color-accent` + outline 2 px offset
  sur tous les éléments focusables. Pas de `outline: none` sauf si
  remplacé par un anneau visible équivalent.

### 7.2 Lecteurs d'écran

- Annonces `aria-live` :
  - `polite` pour les toasts, la sauvegarde inline (Feature 1), le refresh
    nutrition (Feature 4).
  - `assertive` uniquement pour les erreurs bloquantes (auth expirée,
    scraper échoué).
- `aria-pressed` sur les chips catégorie actives (Feature 2).
- `aria-expanded` sur le `ProductDetailModal` depuis le tap carte.
- `<dl>` sémantique pour les valeurs nutrition.

### 7.3 Responsive

L'app est mobile-first avec un `max-width: 440 px` (`--container-max`).
Seule adaptation tablette/desktop : au-dessus de 768 px, l'app passe en
layout 2 colonnes :

- Colonne gauche : navigation latérale (remplace la bottom nav).
- Colonne droite : contenu scrollable (max 640 px).

**Pas de layout desktop dédié.** L'app reste pensée pour le mobile et se
centre sur grand écran avec un fond `surface-sunken` autour. Rationale : le
volume d'usage desktop est négligeable (validé par le brief).

Breakpoints utilisés :

- `≥ 640 px` : padding container passe de 20 → 24 px.
- `≥ 768 px` : navigation latérale activée.
- `≥ 1024 px` : aucune nouvelle transformation, juste un max-content-width
  légèrement plus généreux pour la carte produit (560 px) dans les pages
  riches comme `ProductDetailModal`.

### 7.4 Gestes & interactions

- **Swipe Tinder préservé** — accepté et rejeté restent sur la sélection
  produits. Jamais ajouté à d'autres contextes sans besoin clair.
- **Pull-to-refresh** activé sur `ListsPage` et `ProductsPage` — recharge
  la source + rafraîchit les nutriscore en lazy.
- **Long press** : pas utilisé. Gêne avec la sélection texte sur mobile.
- **Bottom sheet** pour toute action secondaire ou détail — jamais de modal
  centré.

### 7.5 Réductions de mouvement

Respect de `prefers-reduced-motion: reduce` — dans ce cas :
- Les transitions d'édition inline passent de 240 ms à 0 ms (switch
  immédiat).
- Le flash de confirmation `accent-soft` disparaît au profit d'un simple
  swap d'icône.
- Les animations de SwipeStack restent (c'est le cœur de l'UX swipe),
  mais la durée est réduite de 50 %.

---

## 8. Roadmap d'implémentation (4 features tactiques)

Ordre optimal pour livrer par paliers visibles.

| Palier | Feature | Livrable minimal          | Dépend de         |
|--------|---------|---------------------------|-------------------|
| P1     | F2 — catégories visuelles (chips + icônes + mini-chip carte) | catalog endpoint + UI | — |
| P2     | F1 — édition inline                                          | `ProductCardEditable` + rollback | P1 |
| P3     | F4 — Nutriscore badge + section modal                        | migration + backfill OFF | — (parallèle P1) |
| P4     | F4 — bandeau hebdo + détail nutriment                        | agrégations           | P3 |
| P5     | F3 — brand_type + equivalents (sans UI wizard)               | migrations + service  | — (parallèle P1) |
| P6     | F3 — étape wizard typologies                                 | composants wizard     | P5 |

F2 en premier : c'est le changement le plus visible, base pour F1
(la carte se reconstruit dans les deux cas). F3 et F4 peuvent partir en
parallèle. F3-wizard en dernier parce qu'il bloque la génération scraping
et demande F5 stable.

---

## Partie II — Cap stratégique

*Partie préservée du document de design antérieur. Sert de contexte
pour les 4 features tactiques ci-dessus. Non modifiée par l'itération
courante, sauf mise en cohérence des renvois aux paragraphes §1–§8.*

### II.1 Trois fonctionnalités phares

#### II.1.1 Comptes utilisateurs et listes partagées en temps réel

**Problème.** Aujourd'hui l'app est mono-utilisateur (SQLite locale, pas
d'authentification). En pratique les courses sont un acte partagé : couple,
colocation, famille. Forcer un seul compte empêche deux personnes d'ajouter
des articles en parallèle.

**Proposition.**
- Authentification par email + magic link (simple, sans mot de passe côté UX).
- Concept de **Household** (foyer) : un utilisateur appartient à 1..N foyers,
  les produits / listes / drives appartiennent à un foyer, pas à un
  utilisateur.
- Sync temps réel côté client : WebSocket par foyer, diffuse
  `list.item.added`, `list.item.checked`, `list.item.removed`. Les stores
  Zustand appliquent les events reçus comme des mutations locales idempotentes.
- Résolution de conflits simple : last-write-wins sur `checked`, accumulation
  sur `quantity` (deux ajouts = +1 chacun).

**Impact produit.** Fait passer l'app d'un outil perso à un outil de foyer —
scénario dominant des courses. Débloque aussi le partage de drives (un drive
payé par un membre, utilisé par tous).

#### II.1.2 Suggestions intelligentes « ce que tu achètes d'habitude »

**Problème.** L'utilisateur coche « favori » à la main, mais en réalité la
majorité des achats sont **récurrents avec une période** (pain tous les
2 jours, lessive tous les mois). L'ajout manuel aux listes est friction.

**Proposition.**
- Enregistrer chaque `list.item.checked` dans une table `purchase_events`
  (product_id, user_id, date).
- Calculer en batch (job nightly ou au moment de créer une liste) une
  **cadence** par produit : médiane des intervalles entre achats sur les
  90 derniers jours.
- Lors de la création d'une nouvelle liste, proposer : « Tu achètes du pain
  tous les 2 jours, dernier achat il y a 3 jours → ajouter ? ». L'utilisateur
  accepte en un tap.
- Afficher un **score de confiance** : au moins 3 achats, écart-type < 50 %
  de la moyenne.
- Fallback : si pas assez de données, retomber sur le système actuel
  (favoris manuels).

**Impact produit.** Réduit la création de liste à « je vérifie ce que l'app
propose » au lieu de « je pense à tout ce dont j'ai besoin ». C'est le moment
clé où l'app devient indispensable.

#### II.1.3 Comparateur de prix multi-drives avec historique

**Problème.** L'app sait ajouter des articles à un drive, mais l'utilisateur
n'a aucun signal sur **où faire ses courses** ni sur les **variations de
prix**. Les drives promettent tous « les meilleurs prix ».

**Proposition.**
- Lors de chaque `add-to-cart`, capturer le prix observé
  (`ListItem.price_found` existe déjà) et l'écrire dans `price_history`
  (product_id, drive_name, price, date).
- Nouveau job Playwright périodique (1×/semaine sur les 50 produits les plus
  achetés du foyer) : simple recherche, pas d'ajout au panier, récupère le
  prix.
- UI **« Comparer »** sur un produit : graphique d'évolution + prix actuel
  dans chaque drive configuré.
- UI **« Liste optimisée »** : pour une liste donnée, l'app calcule le coût
  total par drive et recommande le moins cher (avec fallback si indisponible).

**Impact produit.** Transforme l'app en assistant d'achat au lieu d'un simple
formulaire de saisie. Lève l'objection « pourquoi j'utiliserais ça plutôt que
le site Carrefour directement ? ».

### II.2 Architecture scalable

#### II.2.1 Principes directeurs

1. **Séparation stricte des couches** : routes (HTTP) → services (règles
   métier) → repositories (accès données) → modèles (SQLAlchemy). Le refactor
   backend en cours applique déjà ce découpage.
2. **Stateless API** : toute la persistance dans Postgres + Redis. Aucune
   dépendance au filesystem local. Ça rend l'app scalable horizontalement.
3. **Tâches asynchrones** : toute opération > 500 ms (scraping Playwright,
   calcul de suggestions, sync drive) passe par une queue. L'API HTTP reste
   rapide.
4. **Contrats explicites** : schémas Pydantic côté API, OpenAPI généré,
   types générés côté frontend (à terme TypeScript).
5. **Observabilité dès le départ** : logs structurés JSON, métriques
   Prometheus, traces OpenTelemetry. Sans ça, le debug du scraping en prod
   est impossible.

#### II.2.2 Topologie cible

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

#### II.2.3 Composants et choix

| Composant        | Techno                                  | Raison |
|------------------|-----------------------------------------|--------|
| API              | FastAPI + SQLAlchemy async              | Continuité avec l'existant, typage fort, perf correcte |
| DB               | Postgres 16                             | SQLite suffit en mono-user, pas pour multi-tenant. RLS pour l'isolation par foyer |
| Cache / pub-sub  | Redis                                   | Broker de queue + pub-sub pour WebSocket + cache prix |
| Queue            | Arq (ou Celery)                         | Jobs asynchrones pour scraping, suggestions, jobs cron |
| Scraper          | Playwright dédié                        | Isolé de l'API — un crash Chromium ne tue pas le serveur. Pool de proxies résidentiels pour contourner les captchas |
| Frontend         | React + Vite + Zustand                  | Déjà en place. TS à introduire plus tard |
| Realtime         | FastAPI WebSocket + Redis pub-sub       | Simple à opérer, scale horizontalement via Redis |
| Auth             | Magic link (email) ou OAuth             | Pas de mot de passe à gérer, UX mobile-friendly |
| Observabilité    | OpenTelemetry + Grafana/Loki/Tempo      | Stack open-source, corrèle logs/metrics/traces |
| CI/CD            | GitHub Actions → registre GHCR → déploi | En place après le refactor |

#### II.2.4 Modèle de données — ajouts stratégiques

Tables introduites **en plus** des §6 (features tactiques) :

- `users` (id, email, created_at, last_login_at)
- `households` (id, name)
- `household_members` (household_id, user_id, role)
- `auth_tokens` (token_hash, user_id, expires_at) — pour magic links
- `purchase_events` (id, household_id, product_id, list_item_id, event_at)
- `price_history` (id, product_id, drive_config_id, price, observed_at)
- `jobs` (id, type, payload, status, attempts, last_error)

Les tables existantes (`products`, `shopping_lists`, `list_items`,
`drive_configs`, ainsi que les nouvelles `nutrition_facts`,
`product_equivalents`) gagneront une colonne `household_id` (FK NOT NULL) et
une politique RLS Postgres.

#### II.2.5 Frontières et points de tension

- **Scraping fragile.** Mitigation : quota strict par drive, retry
  exponentiel, feature-flag pour désactiver un drive cassé sans redéployer,
  alertes sur taux d'échec.
- **Chiffrement des credentials drive.** Fernet déjà en place, la clé doit
  venir d'un secret manager (AWS KMS, GCP KMS, Doppler) et jamais être en
  dur dans l'image.
- **Coût du scraping à grande échelle.** Playwright consomme ~300 Mo/RAM
  par worker. À 1 000 foyers × 1/semaine ça reste gérable ; au-delà,
  mutualiser (cacher les prix observés par d'autres foyers du même magasin).

### II.3 Plan de migration

**Phase 0 — Fondations.** Fait.

**Phase 1 — Prod-readiness (2 semaines).** Postgres + Alembic + secrets
+ logs structurés + déploiement GHCR + TypeScript frontend.

**Phase 2 — Multi-utilisateur (3 semaines).** Tables users / households,
auth magic link, middleware `current_user`, RLS Postgres, WebSocket
`/ws/households/{id}`.

**Phase 3 — Suggestions (2 semaines).** Table `purchase_events`,
`SuggestionService`, endpoint `GET /api/lists/{id}/suggestions`, bandeau UI.

**Phase 4 — Jobs asynchrones + comparateur prix (3 semaines).** Arq,
worker dédié, `price_history`, job `observe_prices`, UI historique.
**Dépendance F4.** Le worker Arq de cette phase sert aussi à ingérer la
nutrition OFF en arrière-plan (voir §5.9).

**Phase 5 — Robustesse scraping (continu).** Captures d'écran sur échec,
classification d'erreurs, feature-flags par drive, dashboard taux de succès.

### II.4 Ce qu'on ne fait **pas** (encore)

- Application mobile native — la PWA suffit tant que les volumes ne le
  justifient pas.
- Recommandations cross-foyers — nécessite ~1 000 foyers actifs.
- Paiement in-app — hors périmètre produit.
- Mode offline complet (type CRDT) — chantier à part.

---

## Annexe A — Inventaire des nouveaux composants

| Composant                    | Fichier prévu                                          | Feature |
|------------------------------|--------------------------------------------------------|---------|
| `ProductCardEditable`        | `frontend/src/components/products/ProductCardEditable.jsx` | F1      |
| `CategoryChipBar`            | `frontend/src/components/products/CategoryChipBar.jsx` | F2      |
| `CategoryMiniChip`           | `frontend/src/components/products/CategoryMiniChip.jsx`| F2      |
| `BrandTypeSelect`            | `frontend/src/components/products/BrandTypeSelect.jsx` | F3      |
| `WizardBrandTypologyStep`    | `frontend/src/components/wizard/BrandTypologyStep.jsx` | F3      |
| `NutriscoreBadge`            | `frontend/src/components/nutrition/NutriscoreBadge.jsx`| F4      |
| `NutritionFacts`             | `frontend/src/components/nutrition/NutritionFacts.jsx` | F4      |
| `WeeklyNutritionBanner`      | `frontend/src/components/nutrition/WeeklyBanner.jsx`   | F4      |
| `NutritionDetailSheet`       | `frontend/src/components/nutrition/DetailSheet.jsx`    | F4      |
| `SearchStrategyService`      | `backend/app/services/search_strategy.py`              | F3      |
| `NutritionService`           | `backend/app/services/nutrition.py`                    | F4      |
| `fetch_off_nutrition.py`     | `backend/scripts/fetch_off_nutrition.py`               | F4      |

---

## Annexe B — Tests UX à faire tourner avant merge

Checklist rapide pour chaque feature.

**F1 — Édition inline.**
- [ ] Éditer le produit en position 14 d'une liste de 30 → la vue ne bouge pas.
- [ ] Tab cycle bloqué dans la carte en édition.
- [ ] Escape annule sans sauver ; blur sauvegarde silencieusement.
- [ ] Erreur API → rollback et carte reste en editing.
- [ ] VoiceOver annonce « Produit enregistré ».

**F2 — Catégories.**
- [ ] Chip bar scrolle horizontalement, snap actif.
- [ ] Filtre reflété dans l'URL (`?category=…`).
- [ ] Tap sur mini-chip d'une carte filtre la liste.
- [ ] Contrast ratio des 10 chips validé AA.

**F3 — Typologies.**
- [ ] Étape wizard skippée si tout est confirmé.
- [ ] Changer la typologie met à jour la requête aperçue.
- [ ] Override manuel persisté dans `product_equivalents`.
- [ ] Produit sans marque heuristisé `generic` à la création.

**F4 — Nutrition.**
- [ ] Nutriscore sur la carte pour les produits avec EAN OFF connu.
- [ ] Fiche complète dans `ProductDetailModal`.
- [ ] Bandeau hebdo affiche un seul nutriment, avec seuil OMS.
- [ ] `source_status = 'not_found'` ne re-query pas pendant 30 jours.
- [ ] Lien externe vers fiche OFF fonctionne.

---

*Fin du document.*
