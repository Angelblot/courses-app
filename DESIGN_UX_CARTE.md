# DESIGN UX — Carte Produit (ProductCard)

> **Amélioration de la carte produit** pour le parcours mobile-first (viewport 390×844).
> Livrable pour Claude Code : spec UX complète avec hiérarchie, maquette textuelle et priorisation.
> Référence : `frontend/src/components/products/ProductCard.jsx`, `ProductCardEditable.jsx`, `GrammageBottomSheet.jsx`

---

## 1. Problèmes identifiés

### 1.1 Icônes trop petites en tactile mobile

**État actuel :** Les 3 boutons d'action (favori ⭐, édition ✏️, suppression 🗑️) utilisent `Icon size={16}` dans `ProductCard.jsx` (lignes 249–257). Les boutons sont en variant `ghost` avec `padding: 8px 12px` depuis le CSS global (ligne 208), mais les icônes à 16px créent une zone tactile réelle bien inférieure à 44px.

**Où :** `ProductCard.jsx` lignes 242–258 — `<div className="item__actions">`

**Impact :** Sur mobile (390×844), tapoter l'icône favori ou supprimer est imprécis. L'utilisateur doit viser soigneusement, ce qui casse le flow "canapé".

### 1.2 Badge "Poids ?" ambigu

**État actuel :** Un badge inline `<span>` style chip gris (`#F3F1EC`) avec le texte "Poids ?" apparaît dans `item__meta` (ligne 196–217). Au clic, un `GrammageBottomSheet` s'ouvre avec deux champs : "Poids (en grammes)" et "Volume (en ml)".

**Problème :**
- L'utilisateur ne comprend pas la différence entre `default_quantity` + `unit` (déjà affiché en meta : "1 boîte", "200 g") et le grammage enregistré séparément.
- "Poids ?" est un libellé interrogatif peu clair — on ne sait pas ce qu'on va remplir.
- La bottom sheet demande "Poids (en grammes)**"** et "Volume (en ml)", mais ne montre pas la valeur actuelle de `default_quantity`/`unit` pour établir le lien.

### 1.3 Marque et catégorie au même niveau visuel

**État actuel :** Dans `ProductCardEditable.jsx` lignes 187–226, les champs `brand` et `category` sont côte à côte dans une `gridTemplateColumns: 1fr 1fr`. Même poids visuel, même style d'input.

**Problème :** Marque (texte libre) et catégorie (sélection) sont deux concepts différents mais visuellement identiques. L'utilisateur peut confondre les deux champs, surtout que la catégorie n'a pas d'icône ou de label distinctif.

### 1.4 Disposition des tags / badges sous-optimale

**État actuel :** Les badges drive et le CategoryMiniChip sont empilés sous `item__meta` (lignes 219–240) sans regroupement logique. La tendance de prix (`PriceTrendBadge`) flotte à côté du titre (lignes 181–186).

**Problème :** Pas de hiérarchie claire. Les infos (marque, quantité, grammage manquant, tendance prix, catégorie, drives) s'accumulent linéairement. L'utilisateur ne scanne pas facilement la carte.

---

## 2. Structure du composant redessinée

### 2.1 Hiérarchie verticale (3 zones distinctes)

```
┌─────────────────────────────────────┐
│  ZONE 1 : Identité                  │
│  [Image]  Nom du produit            │
│           Marque · Quantité         │
├─────────────────────────────────────┤
│  ZONE 2 : Métadonnées               │
│  [Catégorie] [Tendance] [Drives]    │
│  [Grammage] si manquant             │
├─────────────────────────────────────┤
│  ZONE 3 : Actions                   │
│  [☆ Favori]  [✎ Éditer]  [🗑 Suppr] │
└─────────────────────────────────────┘
```

### 2.2 Comportement des zones

| Zone | Rôle | Tap |
|------|------|-----|
| Zone 1 (body) | Ouvrir les détails / historique | `onViewDetails(product)` |
| Zone 2 | Infos secondaires, aucun tap global | Tap sur catégorie → filtre, Tap sur grammage → bottom sheet |
| Zone 3 | Actions destructrices / favorites | Tap stoppé par `e.stopPropagation()` |

---

## 3. Spécifications détaillées par élément

### 3.1 Image produit

- **Taille :** 48×48px (inchangé)
- **Bordure :** `1px solid var(--color-border)`, `border-radius: var(--radius-md)` (12px)
- **Fallback :** Icône `package` à 20px, fond `var(--color-surface-warm)`
- **Position :** Alignée en haut de la carte (pas centrée verticalement), ancrée à la Zone 1

### 3.2 Nom du produit

- **Style :** `font-size: var(--font-size-md)` (15px), `font-weight: 600`, `color: var(--color-text)`
- **Comportement :** `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`
- **Zone :** Zone 1, à droite de l'image

### 3.3 Marque + Quantité (Meta line)

- **Format :** `Marque · 1 boîte` ou `1 kg` ou `200 g`
- **Style :** `font-size: var(--font-size-sm)` (13px), `color: var(--color-text-muted)`
- **Position :** Sous le nom, même ligne si possible
- **Règle :** Si `brand` est vide, afficher seulement la quantité

### 3.4 Badge "Poids ?" → "Grammage manquant"

#### Nouveau design

**État visible :** Uniquement si `product.grammage_g == null && product.volume_ml == null`.

**Nouveau libellé :** `Grammage` avec un icône `scale` (balance) — pas de point d'interrogation.

**Style :**
```css
display: inline-flex;
align-items: center;
gap: 6px;
padding: 6px 12px;          /* ← plus grand pour le tactile */
border-radius: 999px;
font-size: 13px;
font-weight: 500;
background: var(--color-surface-sunken);  /* #F3F1EC */
color: var(--color-text-muted);
cursor: pointer;
/* min-height: 36px — zone tactile >= 44px avec le padding */
line-height: 1.4;
```

**Zone :** Zone 2, en tant que badge indépendant.

**Comportement au clic :** Ouvre `GrammageBottomSheet` révisée (voir section 6).

#### GrammageBottomSheet révisée

**Titre :** `Ajouter le grammage de [produit]`

**Texte explicatif :**
```
Le grammage permet de calculer les bonnes quantités dans les recettes.
La quantité affichée par défaut ("1 boîte", "200 g") vient de l'emballage standard.
Le grammage est le poids ou volume précis du produit.
```

**Deux champs au lieu d'un overlay ou :**
- `Poids net (g)` — input numérique, placeholder "Ex: 200"
- `Volume net (ml)` — input numérique, placeholder "Ex: 330"

**Aide supplémentaire :** Afficher la valeur actuelle de `default_quantity` + `unit` en grisé :
```
*Ce produit est actuellement noté "1 boîte". Tu peux préciser son poids pour les recettes.*
```

### 3.5 Catégorie (CategoryMiniChip)

**État actuel inchangé :** Mini-puce avec icône + label, fond teinté par `categoryTint(categoryKey)`.

**Nouvelle position :** Zone 2, premier élément de la ligne de métadonnées.

**Nouvelle taille :** Padding minimum `6px 12px` pour zone tactile ≥ 44px. Icône dans la chip à `14px` (actuellement 12px).

**Comportement :** Tap → filtre la liste par cette catégorie.

### 3.6 Tendance de prix (PriceTrendBadge)

**État actuel :** Badge inline à côté du titre (ligne 185).

**Nouvelle position :** Zone 2, après la catégorie.

**Style inchangé :** `font-size: 11px`, `font-weight: 600`, `padding: 4px 10px`, `border-radius: 999px`.

**Nouveauté :** Le badge devient cliquable → ouvre `PriceHistoryChart` (bottom sheet avec historique des prix). Ajouter `cursor: pointer` et `aria-label` approprié.

### 3.7 Badges Drive

**État actuel inchangé :** Badges `badge badge--primary` avec libellé drive.

**Nouvelle position :** Zone 2, après la tendance de prix.

### 3.8 Boutons d'action (Zone 3)

**Nouveau design :** Les boutons passent en variant `icon` (qui utilise `width: var(--tap); height: var(--tap);` soit 44×44px) au lieu de `ghost`.

**Changement dans le CSS :**
```css
.btn--icon {
  padding: 0;
  width: var(--tap);         /* 44px */
  height: var(--tap);        /* 44px */
  min-height: auto;
  border-radius: var(--radius-full);
}
```

**Taille des icônes :** `size={20}` (actuellement 16) — meilleure lisibilité dans le cercle de 44px.

**Ordre des boutons :** Favori | Éditer | Supprimer (inchangé)

**États :**
- **Favori :** Si `product.favorite === true`, icône remplie avec `color: var(--color-coral)` (#E07A5F). Sinon icône outline avec `color: var(--color-text-muted)`.
- **Éditer :** Visible seulement si `onEdit` est passé en props.
- **Supprimer :** Toujours visible si `onDelete` est passé.

---

## 4. Hiérarchie visuelle — maquette textuelle

### 4.1 Mode Idle (affichage normal)

```
┌──────────────────────────────────────────────────┐
│ ┌──────┐  Nom du produit                    [☆]  │
│ │  img │  Carrefour · 1 boîte               [✎]  │
│ └──────┘                                       [🗑] │
│ [Fruits & Légumes] [prix stable] [Carrefour]      │
│ [Grammage]                                          │
└──────────────────────────────────────────────────┘
```

### 4.2 Mode Idle — sans marque, sans grammage

```
┌──────────────────────────────────────────────────┐
│ ┌──────┐  Lait demi-écrémé                   [☆]  │
│ │  img │  1 L                                 [✎]  │
│ └──────┘                                       [🗑] │
│ [Produits laitiers] [prix en hausse] [Carrefour]   │
└──────────────────────────────────────────────────┘
```

### 4.3 Mode Édition (ProductCardEditable)

```
┌──────────────────────────────────────────────────┐
│ ┌──────┐  ┌────────────────────────────┐      [✕]  │
│ │  img │  │ Nom du produit (input)     │      [✓]  │
│ └──────┘  └────────────────────────────┘           │
│           ┌──────────────────┐ ┌───────────────┐   │
│           │ Marque (input)   │ │ Catégorie (select)│
│           └──────────────────┘ └───────────────┘   │
│           ┌────────┐ ┌──────────────┐              │
│           │ Qté    │ │ Unité (select)│              │
│           └────────┘ └──────────────┘              │
│  [Ajouter le grammage → lien ouvrant bottom sheet]  │
└──────────────────────────────────────────────────┘
```

---

## 5. Maquette ligne par ligne (mobile 390×844)

### 5.1 ProductCard (idle)

```
Ligne 0: <article class="item item--with-image item--clickable">
Ligne 1:   <AsyncImage class="item__image" />          // 48×48px, border-radius md
Ligne 2:   <div class="item__body">
Ligne 3:     <div class="item__body__header">           // flex row, gap 8px, flex-wrap
Ligne 4:       <div class="item__title">                // flex:1, text-overflow ellipsis
Ligne 5:         {product.name}
Ligne 6:       </div>
Ligne 7:     </div>
Ligne 8:     <div class="item__meta">                   // font-size sm, color muted
Ligne 9:       {brand} · {qty} {unit}
Ligne 10:      {purchase_count > 0 && " · N achats"}
Ligne 11:    </div>
Ligne 12:    <div class="item__badges">                 // NOUVEAU: conteneur badges
Ligne 13:      <CategoryMiniChip />                      // padding 6px 12px, icon 14px
Ligne 14:      {trend && <PriceTrendBadge trend={trend} />}
Ligne 15:      {driveNames.map(d => <span class="badge badge--primary">{d}</span>)}
Ligne 16:    </div>
Ligne 17:    {grammageManquant &&
Ligne 18:      <div class="item__grammage">
Ligne 19:        <GrammageChip onClick={ouvrir bottom sheet} />
Ligne 20:      </div>
Ligne 21:    }
Ligne 22:  </div>
Ligne 23:  <div class="item__actions">
Ligne 24:    <Button variant="icon" aria-label="Favori" size={20}>
Ligne 25:      <Icon name="star" size={20} />
Ligne 26:    </Button>
Ligne 27:    {onEdit &&
Ligne 28:      <Button variant="icon" aria-label="Éditer">
Ligne 29:        <Icon name="edit" size={20} />
Ligne 30:      </Button>
Ligne 31:    }
Ligne 32:    <Button variant="icon" aria-label="Supprimer">
Ligne 33:      <Icon name="trash" size={20} />
Ligne 34:    </Button>
Ligne 35:  </div>
Ligne 36:  {showGrammageSheet && <GrammageBottomSheet v2 />}
Ligne 37: </article>
```

### 5.2 ProductCardEditable (édition)

```
Ligne 0: <article class="item item--with-image item--editing">
Ligne 1:   <AsyncImage class="item__image" />
Ligne 2:   <div class="item__body" style="flex-direction: column; gap: 8px;">
Ligne 3:     <input class="input input--inline"
Ligne 4:            value={form.name} placeholder="Nom du produit" />
Ligne 5:     <div class="edit-grid edit-grid--2col">          // NOUVEAU: labels
Ligne 6:       <div class="edit-field">
Ligne 7:         <label class="edit-label">Marque</label>
Ligne 8:         <input class="input input--inline"
Ligne 9:                value={form.brand} placeholder="Marque" />
Ligne 10:      </div>
Ligne 11:      <div class="edit-field">
Ligne 12:        <label class="edit-label">Catégorie</label>
Ligne 13:        <select class="input input--inline"
Ligne 14:                value={form.category}>
Ligne 15:          <option>Catégorie...</option>
Ligne 16:        </select>
Ligne 17:      </div>
Ligne 18:    </div>
Ligne 19:    <div class="edit-grid edit-grid--qty">            // NOUVEAU
Ligne 20:      <div class="edit-field">
Ligne 21:        <label class="edit-label">Qté</label>
Ligne 22:        <input class="input input--inline" type="number"
Ligne 23:               value={form.default_quantity} />
Ligne 24:      </div>
Ligne 25:      <div class="edit-field">
Ligne 26:        <label class="edit-label">Unité</label>
Ligne 27:        <select class="select select--inline"
Ligne 28:                value={form.unit}>
Ligne 29:        </select>
Ligne 30:      </div>
Ligne 31:    </div>
Ligne 32:    {grammageManquant &&
Ligne 33:      <button class="edit-grammage-link"
Ligne 34:              onClick={ouvrir bottom sheet}>
Ligne 35:        + Ajouter le grammage
Ligne 36:      </button>
Ligne 37:    }
Ligne 38:  </div>
Ligne 39:  <div class="item__actions">
Ligne 40:    <Button variant="icon" aria-label="Annuler">
Ligne 41:      <Icon name="x" size={20} />
Ligne 42:    </Button>
Ligne 43:    <Button variant="primary" aria-label="Enregistrer">
Ligne 44:      <Icon name="check" size={20} />
Ligne 45:    </Button>
Ligne 46:  </div>
Ligne 47: </article>
```

---

## 6. Grammage supprimé — fusion dans Quantité/Unité

### Problème identifié
Le badge "Poids ?" / "Grammage" est **redondant** avec les champs `Qté` + `Unité` déjà présents dans le formulaire d'édition. 
- `Qté = 1` + `Unité = unité` → ça veut déjà dire "1 pièce"
- `Qté = 1` + `Unité = g` → ça veut dire "1 gramme"... mais en vrai c'est "200 g" (grammage)
- La confusion vient du fait que `default_quantity * unit` sert à la fois pour le nombre d'unités (3 bières) ET pour le poids (200g de parmesan)

### Décision : SUPPRIMER le badge "Poids ?" / "Grammage"
- Le champ `grammage_g` et `volume_ml` sont abandonnés dans l'UI
- À la place, l'utilisateur choisit simplement la Qté + Unité qui décrit le conditionnement réel
- **Exemple Lardons fumés** : Qté=2, Unité=unité (car il prend 2 paquets de lardons). Pas besoin de grammage.
- **Exemple Parmesan râpé** : Qté=1, Unité=unité (car il prend 1 boîte). Le grammage n'est pas nécessaire pour l'utilisateur final.
- Le grammage est un détail technique qui sert uniquement au calcul de conversion dans les recettes — on peut le gérer automatiquement côté backend via les données Open Food Facts ou le deviner depuis le nom.

### Changements dans le formulaire d'édition
- Supprimer le bouton/badge "Poids ?" / "Grammage" et sa bottom sheet associée
- Dans le formulaire d'édition, les champs `Qté` et `Unité` suffisent
- Le grammage (grammage_g, volume_ml) reste dans le modèle backend mais n'est plus affiché ni éditable dans l'UI

```
┌─────────────────────────────────────┐
│ ─── (handle)                        │
│                                     │
│ Grammage de [produit]               │
│                                     │
│ Le grammage permet de calculer les  │
│ bonnes quantités dans les recettes. │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Poids net (g)       placeholder │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ Volume net (ml)    placeholder  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Actuellement : "1 boîte"            │
│                                     │
│ ┌──────────┐  ┌──────────────────┐  │
│ │ Annuler  │  │  Enregistrer     │  │
│ └──────────┘  └──────────────────┘  │
└─────────────────────────────────────┘
```

---

## 7. Mobilité — zones tactiles

### 7.1 Règle : toutes les zones interactives ≥ 44×44px

| Élément | Taille actuelle | Taille cible | Changement |
|---------|----------------|--------------|------------|
| Bouton favori | ~32×32px (icon 16px + ghost padding) | **44×44px** | Passer en `variant="icon"`, icône 20px |
| Bouton éditer | ~32×32px | **44×44px** | Idem |
| Bouton supprimer | ~32×32px | **44×44px** | Idem |
| CategoryMiniChip | ~auto (padding 2px 8px) | **≥ 44px height** | Padding vertical 10px minimum |
| Badge Grammage | ~24px height (padding 1px 8px) | **≥ 36px height** | Padding 6px 12px, min-height 36px |
| PriceTrendBadge | ~24px height | **≥ 36px height** | Padding 4px 10px |
| Badge drive | ~24px height | **≥ 36px height** | Padding 6px 12px |

### 7.2 Espacement entre les actions

`gap: 8px` entre les boutons d'action (actuellement 4px) pour éviter les faux taps.

---

## 8. CSS additions / modifications

### 8.1 Nouveaux sélecteurs à ajouter

```css
/* Badge Grammage (remplace l'inline style actuel) */
.item__grammage-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  background: var(--color-surface-sunken);
  color: var(--color-text-muted);
  cursor: pointer;
  min-height: 36px;
  line-height: 1.4;
  transition: background var(--t-fast);
}
.item__grammage-badge:hover {
  background: var(--color-border);
}

/* Conteneur badges (Zone 2) */
.item__badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 8px;
  align-items: center;
}

/* Labels d'édition (ProductCardEditable) */
.edit-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.edit-field {
  display: flex;
  flex-direction: column;
}

.edit-grid--2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.edit-grid--qty {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 8px;
}

/* Lien grammage dans le mode édition */
.edit-grammage-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-accent);
  background: var(--color-accent-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--t-fast);
  border: none;
}
.edit-grammage-link:hover {
  background: var(--color-accent-soft);
  opacity: 0.8;
}
```

### 8.2 Modifications CSS existantes

```css
/* item__actions : plus d'espacement */
.item__actions {
  display: flex;
  gap: 8px;              /* ← 4px → 8px */
  flex-shrink: 0;
}

/* CategoryMiniChip : zone tactile plus grande */
.category-mini-chip {
  padding: 8px 12px;      /* ← était plus petit */
  font-size: 13px;
  min-height: 36px;
}
.category-mini-chip .icon {
  width: 14px;            /* ← 12px → 14px */
  height: 14px;
}
```

---

## 9. Nouveaux composants à créer

| Composant | Fichier | Rôle |
|-----------|---------|------|
| `GrammageChip` | `GrammageChip.jsx` | Badge cliquable "Grammage" avec icône, utilisé en idle + édition |
| *(GrammageBottomSheet v2)* | Modifier l'existant | Ajouter le texte explicatif + référence à `default_quantity`/`unit` |

---

## 10. Ordre de priorité des changements

### P0 — Critique (douloureux immédiatement)

| # | Changement | Fichiers | Effort |
|---|-----------|----------|--------|
| 1 | **Boutons d'action :** passer en `variant="icon"` avec `size={20}`, icônes 20px | `ProductCard.jsx` lignes 242–258 | 10 min |
| 2 | **Catégorie + badges :** créer `item__badges` container, repositionner CategoryMiniChip en Zone 2 | `ProductCard.jsx` lignes 219–240 | 15 min |

### P1 — Important (améliore significativement l'UX)

| # | Changement | Fichiers | Effort |
|---|-----------|----------|--------|
| 3 | **Badge Grammage :** remplacer l'inline style par un composant `GrammageChip` dédié avec icône + meilleur libellé | `ProductCard.jsx` + nouveau fichier | 20 min |
| 4 | **Labels dans ProductCardEditable :** ajouter `<label>` au-dessus des champs marque/catégorie | `ProductCardEditable.jsx` lignes 187–226 | 15 min |

### P2 — Amélioration continue

| # | Changement | Fichiers | Effort |
|---|-----------|----------|--------|
| 5 | **GrammageBottomSheet v2 :** ajouter texte explicatif + référence à la quantité actuelle | `GrammageBottomSheet.jsx` | 15 min |
| 6 | **Taille des chips :** uniformiser les zones tactiles des badges (≥ 36px height) | CSS global | 10 min |
| 7 | **Espacement actions :** `gap: 8px` entre boutons | CSS global ligne 310 | 2 min |
| 8 | **PriceTrendBadge cliquable :** ouvrir historique des prix | `ProductCard.jsx` | 15 min |

---

## 11. Tests de régression

Après implémentation, vérifier :

1. **Mode idle** : La carte affiche image, nom, meta, badges, actions
2. **Mode édition** : Les labels marque/catégorie sont visibles et distincts
3. **Grammage manquant** : Le badge apparaît → bottom sheet s'ouvre → sauvegarde → badge disparaît
4. **Grammage présent** : Le badge ne s'affiche pas, `(200g)` apparaît en petit dans meta
5. **Zone tactile** : Tous les boutons sont ≥ 44×44px (vérifier au devtools sur 390×844)
6. **Pas de régression** : Le wizard utilise aussi ProductCard — vérifier qu'il n'est pas cassé
7. **Édition auto-save** : Le debounce 400ms + flash 220ms fonctionne toujours
8. **Catégorie sur mini-chip** : Le clic filtre bien la liste
9. **Pas d'emoji** : Aucun emoji dans l'interface (convention UI stricte)
