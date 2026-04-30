import { useEffect, useMemo, useState } from 'react';
import { useProductsStore } from '../../stores/productsStore.js';
import { useRecipesStore } from '../../stores/recipesStore.js';
import {
  useWizardStore,
  getRecipeIngredientMatches,
} from '../../stores/wizardStore.js';
import { Card } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import { Counter } from '../ui/Counter.jsx';
import { Icon } from '../ui/Icon.jsx';
import { EmptyState } from '../ui/EmptyState.jsx';
import { AsyncImage } from '../ui/AsyncImage.jsx';
import { ProductSubstitutionSheet } from './ProductSubstitutionSheet.jsx';
import {
  convertToProductQty,
  formatIngredientQty,
  normalizeUnit,
} from '../../lib/unitConverter.js';

const PRODUCT_ICONS = ['package', 'bag', 'shopping-bag', 'box'];
function iconForProduct(p) {
  const key = String(p.id ?? p.name ?? '')
    .split('')
    .reduce((a, c) => a + c.charCodeAt(0), 0);
  return PRODUCT_ICONS[key % PRODUCT_ICONS.length];
}

function suggestedPackCount(group, product) {
  if (!product) return 1;
  const { qty } = convertToProductQty(group.totalQty, group.unit, product);
  return Math.max(1, qty || 1);
}

// Convertit (qty, unit) vers une unité de base ('g' ou 'ml') si possible.
function toBaseUnit(qty, unit) {
  const u = (unit || '').trim().toLowerCase();
  if (u === 'g' || u === 'gr' || u === 'gramme' || u === 'grammes') {
    return { value: qty, unit: 'g' };
  }
  if (u === 'kg' || u === 'kilo' || u === 'kilos' || u === 'kilogramme' || u === 'kilogrammes') {
    return { value: qty * 1000, unit: 'g' };
  }
  if (u === 'ml' || u === 'millilitre' || u === 'millilitres') {
    return { value: qty, unit: 'ml' };
  }
  if (u === 'cl' || u === 'centilitre' || u === 'centilitres') {
    return { value: qty * 10, unit: 'ml' };
  }
  if (u === 'l' || u === 'litre' || u === 'litres') {
    return { value: qty * 1000, unit: 'ml' };
  }
  return null;
}

// Calcule la couverture du besoin recette par la quantité produit choisie.
function computeCoverage(group, product, qty) {
  if (!product) return null;
  const base = toBaseUnit(group.totalQty, group.unit);

  if (product.grammage_g && base && base.unit === 'g') {
    return {
      packagingValue: product.grammage_g,
      packagingUnit: 'g',
      totalInBase: base.value,
      coveredAmount: qty * product.grammage_g,
      shortfall: Math.max(0, base.value - qty * product.grammage_g),
    };
  }
  if (product.volume_ml && base && base.unit === 'ml') {
    return {
      packagingValue: product.volume_ml,
      packagingUnit: 'ml',
      totalInBase: base.value,
      coveredAmount: qty * product.volume_ml,
      shortfall: Math.max(0, base.value - qty * product.volume_ml),
    };
  }
  // Cas dénombrable : 1 unité produit = 1 unité ingrédient
  if (
    normalizeUnit(group.unit) === 'unité'
    && normalizeUnit(product.unit || 'unité') === 'unité'
  ) {
    return {
      packagingValue: 1,
      packagingUnit: 'unité',
      totalInBase: group.totalQty,
      coveredAmount: qty,
      shortfall: Math.max(0, group.totalQty - qty),
    };
  }
  return null;
}

function formatBaseQty(value, unit) {
  const v = Number.isInteger(value) ? value : Math.round(value * 10) / 10;
  if (unit === 'g') return `${v}g`;
  if (unit === 'ml') return `${v}ml`;
  if (unit === 'unité') return v <= 1 ? `${v} pièce` : `${v} pièces`;
  return `${v} ${unit}`;
}

// Regroupe les sources par recette pour le breakdown (somme des contributions).
function groupSourcesByRecipe(sources) {
  const map = new Map();
  sources.forEach((s) => {
    const key = s.recipeId ?? s.recipeName;
    const existing = map.get(key);
    if (existing && existing.unit === s.unit) {
      existing.qty += s.qty;
    } else if (!existing) {
      map.set(key, { recipeName: s.recipeName, qty: s.qty, unit: s.unit });
    } else {
      // Unités différentes pour la même recette : on garde tel quel, on ajoute une ligne
      map.set(`${key}::${s.unit}`, { recipeName: s.recipeName, qty: s.qty, unit: s.unit });
    }
  });
  return Array.from(map.values());
}

export function RecipeProductMatching() {
  const products = useProductsStore((s) => s.items);
  const productsLoaded = useProductsStore((s) => s.loaded);
  const loadProducts = useProductsStore((s) => s.load);

  const recipes = useRecipesStore((s) => s.items);
  const loadRecipes = useRecipesStore((s) => s.load);

  const selectedRecipes = useWizardStore((s) => s.selectedRecipes);
  const quotidien = useWizardStore((s) => s.quotidien);
  const quotidienQty = useWizardStore((s) => s.quotidienQty);
  const markProduct = useWizardStore((s) => s.markProduct);
  const setQuotidienQty = useWizardStore((s) => s.setQuotidienQty);

  const [chosenByGroup, setChosenByGroup] = useState({});
  const [substitutionSheet, setSubstitutionSheet] = useState({
    open: false,
    groupKey: null,
    ingredientName: '',
    ingredientQty: 0,
    ingredientUnit: 'unité',
    categoryHint: null,
  });

  useEffect(() => {
    loadProducts();
    loadRecipes();
  }, [loadProducts, loadRecipes]);

  const matches = useMemo(
    () =>
      getRecipeIngredientMatches({
        selectedRecipes,
        recipes,
        products,
      }),
    [selectedRecipes, recipes, products],
  );

  // Auto-mark le produit choisi comme "needed" + initialise la qty par défaut.
  useEffect(() => {
    matches.forEach((group) => {
      if (group.matchingProducts.length === 0) return;
      if (group.totalQty <= 0) return;
      const chosenId = chosenByGroup[group.key] ?? group.matchingProducts[0].id;
      const product = group.matchingProducts.find((p) => p.id === chosenId);
      if (!product) return;
      if (quotidien[chosenId] !== 'needed') {
        markProduct(chosenId, 'needed');
      }
      if (quotidienQty[chosenId] == null) {
        setQuotidienQty(chosenId, suggestedPackCount(group, product));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, chosenByGroup]);

  function handleQuantityChange(productId, qty) {
    setQuotidienQty(productId, qty);
    if (qty > 0 && quotidien[productId] !== 'needed') {
      markProduct(productId, 'needed');
    }
  }

  function handleOpenSubstitution(group) {
    setSubstitutionSheet({
      open: true,
      groupKey: group.key,
      ingredientName: group.ingredientName,
      ingredientQty: group.totalQty,
      ingredientUnit: group.unit,
      categoryHint: group.categoryHint,
    });
  }

  function handleSubstitutionSelect(candidate) {
    if (!candidate || !candidate.product_id) return;
    const qty = candidate.pack_count || 1;
    const groupKey = substitutionSheet.groupKey;
    // Démarque l'ancien produit choisi pour ce groupe (s'il existe)
    if (groupKey) {
      const group = matches.find((g) => g.key === groupKey);
      const previousId = chosenByGroup[groupKey] ?? group?.matchingProducts?.[0]?.id;
      if (previousId && previousId !== candidate.product_id) {
        markProduct(previousId, null);
      }
      setChosenByGroup((prev) => ({ ...prev, [groupKey]: candidate.product_id }));
    }
    markProduct(candidate.product_id, 'needed');
    setQuotidienQty(candidate.product_id, qty);
  }

  if (!productsLoaded) return null;

  const hasSelectedRecipes = Object.keys(selectedRecipes || {}).length > 0;
  if (!hasSelectedRecipes) {
    return (
      <section className="stack stack--lg">
        <EmptyState icon="chef" title="Aucune recette sélectionnée">
          Reviens à l'étape précédente pour choisir tes recettes.
        </EmptyState>
      </section>
    );
  }

  const renderable = matches.filter((g) => g.totalQty > 0);

  if (renderable.length === 0) {
    return (
      <section className="stack stack--lg">
        <EmptyState icon="check" title="Pas d'ingrédients à matcher">
          Tes recettes n'ont pas d'ingrédients listés.
        </EmptyState>
      </section>
    );
  }

  const matchedCount = renderable.filter((g) => g.matchingProducts.length > 0).length;
  const unmatchedCount = renderable.length - matchedCount;

  return (
    <section className="stack stack--lg">
      <div className="recipe-ingredients-header">
        <h2 className="recipe-ingredients-header__title">
          Les ingrédients de tes recettes
        </h2>
        <p className="recipe-ingredients-header__subtitle">
          {matchedCount} produit{matchedCount > 1 ? 's' : ''} trouvé
          {matchedCount > 1 ? 's' : ''} dans ton catalogue
          {unmatchedCount > 0 ? ` · ${unmatchedCount} à confirmer` : ''}
        </p>
      </div>

      <div className="stack stack--md">
        {renderable.map((group) => (
          <IngredientMatchCard
            key={group.key}
            group={group}
            chosenProductId={chosenByGroup[group.key]}
            quotidienQty={quotidienQty}
            onQuantityChange={handleQuantityChange}
            onOpenSubstitution={() => handleOpenSubstitution(group)}
          />
        ))}
      </div>

      <ProductSubstitutionSheet
        isOpen={substitutionSheet.open}
        onClose={() => setSubstitutionSheet((p) => ({ ...p, open: false }))}
        ingredientName={substitutionSheet.ingredientName}
        ingredientQty={substitutionSheet.ingredientQty}
        ingredientUnit={substitutionSheet.ingredientUnit}
        categoryHint={substitutionSheet.categoryHint}
        onSelect={handleSubstitutionSelect}
      />
    </section>
  );
}

function IngredientMatchCard({
  group,
  chosenProductId,
  quotidienQty,
  onQuantityChange,
  onOpenSubstitution,
}) {
  const formattedTotal = formatIngredientQty(group.totalQty, group.unit);
  const sourcesByRecipe = useMemo(
    () => groupSourcesByRecipe(group.sources),
    [group.sources],
  );
  const hasMultipleRecipes = sourcesByRecipe.length > 1;
  const [breakdownOpen, setBreakdownOpen] = useState(hasMultipleRecipes);

  // Etat empty : aucun produit du catalogue matché
  if (group.matchingProducts.length === 0) {
    return (
      <Card className="ingredient-card ingredient-card--empty">
        <div className="ingredient-card__identity">
          <div className="ingredient-card__image-wrap ingredient-card__image-wrap--placeholder">
            <Icon name="search" size={20} strokeWidth={2} />
          </div>
          <div className="ingredient-card__title">
            <span className="ingredient-card__name">{group.ingredientName}</span>
            <span className="ingredient-card__brand">Aucun produit trouvé</span>
          </div>
        </div>

        <div className="ingredient-card__divider" />

        <div className="ingredient-card__section">
          <span className="ingredient-card__label">Pour la recette</span>
          <div className="ingredient-card__need">
            <strong className="ingredient-card__need-value">{formattedTotal}</strong>
          </div>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={onOpenSubstitution}
          className="ingredient-card__cta-block"
        >
          Choisir un produit
        </Button>
      </Card>
    );
  }

  const chosenId = chosenProductId ?? group.matchingProducts[0].id;
  const product = group.matchingProducts.find((p) => p.id === chosenId)
    ?? group.matchingProducts[0];
  const defaultQty = suggestedPackCount(group, product);
  const qty = quotidienQty[product.id] ?? defaultQty;

  const coverage = computeCoverage(group, product, qty);
  const isShort = coverage ? coverage.shortfall > 0 : false;

  // Texte d'équivalence : "(≈ 2 unités de 250g)" ou "(= 2 unités de 250g)"
  let equivalenceText = null;
  if (coverage && coverage.packagingValue) {
    const isExact = coverage.totalInBase % coverage.packagingValue === 0;
    const sign = isExact ? '=' : '≈';
    const unitLabel = defaultQty <= 1 ? 'unité' : 'unités';
    const pkg = formatBaseQty(coverage.packagingValue, coverage.packagingUnit);
    equivalenceText = `(${sign} ${defaultQty} ${unitLabel} de ${pkg})`;
  }

  const keyword = [product.name, product.category, product.rayon]
    .filter(Boolean)
    .join(' ');
  const altCount = group.matchingProducts.length - 1;

  return (
    <Card className="ingredient-card">
      <div className="ingredient-card__identity">
        <div className="ingredient-card__image-wrap">
          <AsyncImage
            src={product.image_url || undefined}
            keyword={keyword}
            alt={product.name}
            className="ingredient-card__image"
            fallbackIcon={iconForProduct(product)}
            fallbackIconSize={28}
          />
        </div>
        <div className="ingredient-card__title">
          <span className="ingredient-card__name">{product.name}</span>
          {product.brand && (
            <span className="ingredient-card__brand">{product.brand}</span>
          )}
        </div>
      </div>

      <div className="ingredient-card__divider" />

      <div className="ingredient-card__section">
        <span className="ingredient-card__label">Pour la recette</span>
        <div className="ingredient-card__need">
          <strong className="ingredient-card__need-value">{formattedTotal}</strong>
          {equivalenceText && (
            <span className="ingredient-card__need-eq">{equivalenceText}</span>
          )}
        </div>
      </div>

      <div className="ingredient-card__divider" />

      <div className="ingredient-card__section">
        <span className="ingredient-card__label">Quantité au drive</span>
        <div className="ingredient-card__counter-row">
          <Counter
            value={qty}
            onChange={(q) => onQuantityChange(product.id, q)}
            min={1}
            max={99}
            step={1}
            ariaLabel={`Quantité de ${product.name}`}
          />
        </div>
      </div>

      {isShort && (
        <div
          className="ingredient-card__warning"
          role="status"
          aria-live="polite"
        >
          Attention : il manque {formatBaseQty(coverage.shortfall, coverage.packagingUnit)} pour vos recettes.
        </div>
      )}

      {hasMultipleRecipes && (
        <>
          <div className="ingredient-card__divider" />
          <button
            type="button"
            className="ingredient-card__breakdown-toggle"
            aria-expanded={breakdownOpen}
            onClick={() => setBreakdownOpen((v) => !v)}
          >
            <span
              className={`ingredient-card__chevron ${breakdownOpen ? 'is-open' : ''}`}
            >
              <Icon name="chevronRight" size={14} strokeWidth={2.5} />
            </span>
            Détail par recette
          </button>
          {breakdownOpen && (
            <ul className="ingredient-card__breakdown">
              {sourcesByRecipe.map((s, i) => (
                <li key={i} className="ingredient-card__breakdown-row">
                  <span className="ingredient-card__breakdown-name">
                    {s.recipeName}
                  </span>
                  <span className="ingredient-card__breakdown-qty">
                    {formatIngredientQty(s.qty, s.unit)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {altCount > 0 && (
        <button
          type="button"
          className="ingredient-card__alt-link"
          onClick={onOpenSubstitution}
        >
          {altCount} autre produit{altCount > 1 ? 's' : ''} disponible
          {altCount > 1 ? 's' : ''}
        </button>
      )}
    </Card>
  );
}
