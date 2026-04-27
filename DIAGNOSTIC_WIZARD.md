# DIAGNOSTIC WIZARD — 3 bugs sur l'étape 2

**Date** : 2026-04-27
**Dernier commit** : `eee2e04` (fix: ux recette integree dans carte swipe + grammage correct)
**Commit précédent** : `4c39123` (fix: scoring substitution + separation recette/quotidien)
**Fichiers analysés** (sans modification) :
- `frontend/src/components/wizard/DailyChecklist.jsx`
- `frontend/src/components/wizard/RecipeUsageBanner.jsx`
- `frontend/src/components/wizard/ProductSubstitutionSheet.jsx`
- `frontend/src/components/wizard/RecipeIngredientsSection.jsx`
- `frontend/src/stores/wizardStore.js`
- `frontend/src/lib/unitConverter.js`
- `backend/app/services/product_resolver.py`
- `backend/app/routes/resolver.py`

---

## Problème A : "Tes recettes" n'affiche aucun ingrédient

### Symptôme
La section "Tes recettes" s'affiche (titre + sous-titre) mais ne montre aucun ingrédient / produit lié aux recettes. Le bandeau "Pour ta recette" n'apparaît sur aucune carte swipe non plus.

### Cause racine

**1. Le bandeau `RecipeUsageBanner` ne s'affiche pas car `getRecipeUsage()` ne produit aucun `breakdown` valide pour les produits de la checklist quotidienne.**

La cause est une **rupture de la chaîne de matching nom** dans `getRecipeUsage()` (wizardStore.js, lignes 175-246).

La fonction `getRecipeUsage` tente de matcher un produit de la checklist (ex: "Lardons fumés" — produit favori) avec les ingrédients des recettes sélectionnées via 3 mécanismes :

1. **`matchById`** (ligne 179-182) : compare `ing.product_id` avec `productId`. ÉCHEC : les produits de la checklist quotidienne sont des produits du catalogue, tandis que les ingrédients des recettes ont un `product_id` qui pointe vers leur propre référence — sauf si le produit favori EST exactement celui référencé par l'ingrédient (cas rare).

2. **`matchByName`** (ligne 183-191) : compare les noms normalisés. **ÉCHEC** dans la majorité des cas car la condition `isConvertible(ing.unit, prod)` (ligne 188) bloque le matching si l'unité de l'ingrédient n'est pas convertible avec l'unité du produit. Si l'ingrédient est en "g" et que le produit est en "unité" **sans grammage_g**, `isConvertible()` retourne `false` → pas de match.

3. **`matchByCategory`** (ligne 195-215) : compare catégorie + grammage/volume identiques. ÉCHEC si les grammages diffèrent entre le produit favori et celui lié à l'ingrédient.

**2. Le bandeau `RecipeUsageBanner` n'apparaît pas sur les cartes swipe, même quand un match existe** : Le composant `RecipeUsageBanner` (RecipeUsageBanner.jsx, ligne 12) retourne `null` si `recipeUsage.breakdown` est vide. Comme le breakdown est vide (aucun match), le bandeau ne s'affiche pas.

**3. La section "Tes recettes" est devenue vide** : Dans le commit `eee2e04`, `RecipeIngredientsSection` a été supprimé du render (DailyChecklist.jsx, ligne 268-277). Elle est remplacée par un simple header `<h2>Tes recettes</h2>` + `<p>`. **L'ancien composant `RecipeIngredientsSection` qui listait les produits liés aux recettes n'est plus appelé nulle part.** Le fichier existe toujours mais n'est importé par aucun composant.

### Chaîne de la rupture

```
Sélection recette (wizardStore.selectedRecipes)
 → recipes chargées (recipesStore)
 → getRecipeUsage() appelé pour chaque produit favori
    → matchById échoue (product_id ≠)
    → matchByName échoue (isConvertible bloque)
    → matchByCategory échoue (grammage ≠)
    → breakdown = [] → retour vide
 → RecipeUsageBanner reçoit breakdown vide → null
 → Aucun bandeau "Pour ta recette" affiché
 → La section "Tes recettes" n'affiche qu'un titre vide
```

### Préconisation

**Dans `getRecipeUsage()` (wizardStore.js, ligne 188) :**
- Assouplir la condition `isConvertible(ing.unit, prod)` en la déplaçant **après** le match de nom. Actuellement, elle bloque le matching avant même que le nom soit comparé. On pourrait :
  - Faire un matchByName **sans** la condition `isConvertible` en première passe (pour détecter les correspondances sémantiques)
  - Ajouter un fallback de matching par **catégorie + rayon** quand le nom correspond partiellement mais que la conversion d'unité échoue
- Si l'ingrédient et le produit partagent des mots-clés communs (ex: "lardons" dans "Lardons fumés" et "lardons" dans l'ingrédient), le match devrait passer même si l'unité diffère

**Alternative plus robuste** : Ajouter un quatrième mode de matching `matchByCategoryFallback` qui ne requiert que la catégorie soit identique (sans grammage strict).

---

## Problème B : Section recette toujours en haut de l'écran

### Symptôme
La section "Tes recettes" s'affiche en haut de la page, comme une section séparée AVANT la section "Ton quotidien". L'utilisateur voulait qu'elle disparaisse complètement de la vue globale et que l'info recette soit uniquement intégrée **dans** chaque carte swipe du composant `ProductSwipeCard`.

### Cause racine

**Dans `DailyChecklist.jsx` (lignes 269-278), le commit `eee2e04` a remplacé l'appel à `<RecipeIngredientsSection>` par un header statique `<div className="recipe-ingredients-header">` mais ne l'a pas supprimé.**

Lignes exactes (état actuel du fichier) :

```jsx
      {/* Section: Daily Checklist — l'info recette est DANS chaque carte swipe */}
      {hasSelectedRecipes && (
        <div className="recipe-ingredients-header">
          <h2 className="recipe-ingredients-header__title">
            Tes recettes
          </h2>
          <p className="recipe-ingredients-header__subtitle">
            Les ingredients necessaires sont indiques dans chaque fiche produit
          </p>
        </div>
      )}
```

**Ce bloc persiste dans le render alors que l'intention du commit `eee2e04` était de supprimer la section recette de la vue globale.**

Le diff entre `4c39123` et `eee2e04` confirme que le développeur a :
1. ✅ Supprimé l'import de `RecipeIngredientsSection`
2. ✅ Supprimé l'appel `<RecipeIngredientsSection>`
3. ❌ **Ajouté un header statique "Tes recettes" à la place** — sans supprimer le bloc conditionnel

Or, l'information recette est maintenant portée par `RecipeUsageBanner` à l'intérieur de `ProductSwipeCard` (ligne 92). Le header global "Tes recettes" est donc **redondant** et doit être supprimé.

### Préconisation

**Dans `DailyChecklist.jsx`, supprimer les lignes 269-278** (le bloc `{hasSelectedRecipes && (<div className="recipe-ingredients-header">...)}`). 

L'information "Tes recettes" est déjà contextuelle : chaque carte swipe affiche son propre `RecipeUsageBanner` qui dit "Pour ta recette : 200g · Pâtes Carbonara". Un header global n'apporte aucune valeur et prend de la place inutilement.

---

## Problème C : Nombre d'alternatives toujours faux

### Symptôme
Le bouton "✦ 3 alternatives" (ou un autre nombre) sur les cartes swipe affiche un compte qui ne correspond ni au nombre réel de produits candidats retournés par l'API, ni à ce que l'utilisateur voit dans la bottom sheet.

### Cause racine

**Le nombre affiché `subCount` (DailyChecklist.jsx, ligne 36 et 87) provient de `recipeUsage.substitutionCount` — qui est calculé côté frontend dans `getRecipeUsage()` — et non du nombre de candidats retournés par l'API backend.**

**Détail du calcul dans `getRecipeUsage()` (wizardStore.js, lignes 220-243) :**

```jsx
      if (!matchById && !matchByName && !matchByCategory && ing.product_id != null && product) {
        const linkedProduct = allProducts.find(
          (p) => String(p.id) === String(ing.product_id)
        );
        if (linkedProduct && linkedProduct.id !== product.id) {
          const cat1 = (product.category || '').trim().toLowerCase();
          const cat2 = (linkedProduct.category || '').trim().toLowerCase();
          if (cat1 !== cat2) return; // ← EARLY RETURN (ligne 230)
          if (!substitutionIngredient) {
            substitutionIngredient = { ... };
          }
          substitutionCount++;  // ← LIGNE 241 : incrémenté pour CHAQUE ingrédient
          hasSubstitutions = true;
        }
      }
```

**Problème double :**

1. **`substitutionCount` compte les ingrédients, pas les produits.** Chaque ingrédient de recette dont le `product_id` lié est différent du produit courant ET de même catégorie incrémente `substitutionCount`. Si une recette a 3 ingrédients "substituables" (ex: lardons, crème, parmesan pour les pâtes carbonara), `substitutionCount` sera **3**, alors que l'API ne retournera que les **top 3** candidats pour **un seul** de ces ingrédients (le premier qui a défini `substitutionIngredient`).

2. **Seul le premier ingrédient substituable est utilisé** (ligne 232 : `if (!substitutionIngredient)`), mais `substitutionCount` continue de s'incrémenter pour tous les autres. Donc le compteur affiche "✦ 3 alternatives" mais la bottom sheet n'en montre que l'API `limit=3` pour un seul ingrédient — incohérence totale.

**Décalage API vs affichage :**
- Le backend retourne `limit=3` candidats max (resolver.py, ligne 36 + product_resolver.py, ligne 279)
- `substitutionCount` est un compteur local frontend qui n'a **aucun rapport** avec le nombre réel de candidats
- Le frontend n'affiche jamais le nombre de candidats retournés par l'API — il affiche `substitutionCount`

### Préconisation

**Solution 1 (recommandée) :** Afficher le nombre réel de candidats une fois qu'ils sont chargés. Dans `ProductSubstitutionSheet`, le nombre de candidats est `candidates.length`. On pourrait passer ce nombre via un callback `onCandidatesLoaded` ou directement l'utiliser dans le bouton de la carte swipe après chargement.

**Solution 2 (correctif rapide) :** Dans `getRecipeUsage()`, remplacer `substitutionCount` (qui compte les ingrédients) par soit :
- `1` (toujours, puisque un seul ingrédient de substitution est retenu)
- `0` (ne pas afficher le nombre avant que l'API réponde)

**Solution 3 (idéale) :** Déplacer le comptage depuis `getRecipeUsage()` vers une logique asynchrone qui interroge l'API et affiche le nombre réel de candidats. Mais cela nécessite une refonte plus large.

### Préconisation prioritaire

**Correction minimale :** Dans `DailyChecklist.jsx`, ligne 87, remplacer `{subCount} alternative{subCount > 1 ? 's' : ''}` par `Alternatives` (sans nombre fixe). Le nombre exact sera connu seulement après ouverture de la bottom sheet.

**Correction complète :** Dans `wizardStore.js`, ligne 241, remplacer `substitutionCount++` par une logique qui ne compte que le nombre d'**options de substitution distinctes** pour le produit courant, ou simplement fixer `substitutionCount = 1` (puisque un seul ingrédient de substitution est utilisé).

---

## Résumé des actions correctives

| Bug | Fichier | Ligne(s) | Action |
|-----|---------|----------|--------|
| A — "Tes recettes" vide | `wizardStore.js` | 188 | Assouplir `isConvertible()` dans le matching nom |
| A — Bandeau absent | `wizardStore.js` | 175-246 | Ajouter un fallback de matching par catégorie seule |
| B — Header recette persistant | `DailyChecklist.jsx` | 269-278 | Supprimer le bloc `{hasSelectedRecipes && (...)}` |
| C — Nombre alternatives faux | `wizardStore.js` | 241 | Remplacer `substitutionCount++` par `substitutionCount = 1` |
| C — Nombre alternatives faux | `DailyChecklist.jsx` | 87 | Remplacer le compteur par un libellé statique "Alternatives" |

**Note :** Aucun fichier n'a été modifié. Ce diagnostic est purement analytique.
