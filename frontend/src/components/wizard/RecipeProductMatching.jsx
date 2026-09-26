import { productImageFallback } from '../../lib/tableeImages.js';
import { recipeImage, recipeImageFallback } from '../../lib/tableeImages.js';
import { useEffect, useMemo, useState } from 'react';
import { useProductsStore } from '../../stores/productsStore.js';
import { useRecipesStore } from '../../stores/recipesStore.js';
import {
  useWizardStore,
  getRecipeIngredientMatches,
  resolveIngredientChoice,
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
  const {items:products, loaded, loading, error, load} = useProductsStore();
  const {items:recipes} = useRecipesStore();
  const {selectedRecipes, ingredientChoices, setIngredientChoice, quotidien} = useWizardStore();
  const [sheet, setSheet] = useState(null);
  const [showOwned, setShowOwned] = useState(false);
  useEffect(() => { if (!loaded && !loading && !error) load(); }, [loaded, loading, error, load]);
  const matches = useMemo(() => getRecipeIngredientMatches({recipes, products, selectedRecipes}).filter((g) => g.totalQty > 0), [recipes, products, selectedRecipes]);
  const groups = matches.map((g) => ({...g, choice:resolveIngredientChoice(g, ingredientChoices, quotidien, products)}));
  const ownedCount = groups.filter((g) => g.choice.owned).length;
  // Unresolved products come first without moving rows after a decision.
  const ordered = [...groups].sort((a,b) => Number(a.matchingProducts.length > 0) - Number(b.matchingProducts.length > 0));
  if (!Object.keys(selectedRecipes).length) return null;
  return <section className="stack stack--lg">
    <div className="recipe-ingredients-header"><h2>Pour tes repas</h2><p className="text-muted">Les ingrédients sont regroupés. Retire ce que tu as déjà.</p></div>
    {loading && <p role="status">Chargement des ingrédients…</p>}
    {error && <div role="alert" className="notice notice--error">{error} <button className="text-action" onClick={load}>Réessayer</button></div>}
    {loaded && matches.length === 0 && <p className="notice">Ces recettes ne contiennent aucun ingrédient. Ajoute des produits ci-dessous.</p>}
    {ordered.filter((g) => !g.choice.owned || showOwned).map((group) => {
      const {product, quantity, owned} = group.choice;
      const available = product && !group.matchingProducts.some((p) => p.id === product.id) ? {...group, matchingProducts:[product,...group.matchingProducts]} : group;
      return <div className={`ingredient-review ${owned ? 'is-owned' : ''}`} key={group.key}>
        {owned ? <div className="owned-ingredient"><Icon name="check" size={20}/><span>{group.ingredientName}<small>Déjà à la maison · retiré de la liste</small></span></div> : <IngredientMatchCard group={available} chosenProductId={product?.id} quotidienQty={product ? {[product.id]:quantity} : {}} onQuantityChange={(_, quantity) => setIngredientChoice(group.key,{quantity})} onOpenSubstitution={() => setSheet(group)} />}
        <button className="text-action pantry-action" aria-pressed={owned} onClick={() => {setIngredientChoice(group.key,{owned:!owned}); if (!owned) setShowOwned(true);}}>{owned ? 'Remettre dans la liste' : 'J’en ai déjà'}</button>
      </div>;
    })}
    {ownedCount > 0 && <button className="text-action" aria-expanded={showOwned} onClick={() => setShowOwned(!showOwned)}>{showOwned ? 'Masquer' : 'Voir'} les {ownedCount} ingrédients déjà à la maison</button>}
    <ProductSubstitutionSheet isOpen={!!sheet} onClose={() => setSheet(null)} ingredientName={sheet?.ingredientName || ''} ingredientQty={sheet?.totalQty || 0} ingredientUnit={sheet?.unit || 'unité'} categoryHint={sheet?.categoryHint} onSelect={(candidate) => {
      if (candidate?.product_id && sheet) {setIngredientChoice(sheet.key,{productId:candidate.product_id,quantity:candidate.pack_count || 1,owned:false});setSheet(null);}
    }} />
  </section>;
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
  const [breakdownOpen, setBreakdownOpen] = useState(false);

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
            <span className="ingredient-card__brand">Produit à choisir · sinon ajouté en ingrédient libre</span>
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
            src={product.image_url || undefined} fallbackSrc={productImageFallback(product)}
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
        <span className="ingredient-card__total">{formattedTotal}</span>
      </div>

      {convertToProductQty(group.totalQty, group.unit, product).qty === 0 && <p className="notice">Conditionnement inconnu : vérifie la quantité au drive.</p>}
      <details className="ingredient-details"><summary>Ajuster les quantités</summary>
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

      </details>
      {(
        <button
          type="button"
          className="ingredient-card__alt-link"
          onClick={onOpenSubstitution}
        >
          Changer de produit
        </button>
      )}
    </Card>
  );
}
