import { QuickAdd } from './QuickAdd.jsx';
import { productImageFallback } from '../../lib/tableeImages.js';
import { useEffect, useMemo, useState } from 'react';
import { useProductsStore } from '../../stores/productsStore.js';
import { useRecipesStore } from '../../stores/recipesStore.js';
import { useWizardStore, getRecipeUsage } from '../../stores/wizardStore.js';
import { Card } from '../ui/Card.jsx';
import { EmptyState } from '../ui/EmptyState.jsx';
import { Input } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Counter } from '../ui/Counter.jsx';
import { Icon } from '../ui/Icon.jsx';
import { SwipeStack } from '../ui/SwipeStack.jsx';
import { AsyncImage } from '../ui/AsyncImage.jsx';
import { RecipeUsageBanner } from './RecipeUsageBanner.jsx';
import { ProductSubstitutionSheet } from './ProductSubstitutionSheet.jsx';

const PRODUCT_ICONS = ['apple', 'bag', 'package', 'leaf'];
function iconForProduct(p) {
  const key = String(p.id ?? p.name ?? '')
    .split('')
    .reduce((a, c) => a + c.charCodeAt(0), 0);
  return PRODUCT_ICONS[key % PRODUCT_ICONS.length];
}

function ProductSwipeCard({
  product,
  quantity,
  onQuantityChange,
  recipeUsage,
  onSubstitutionClick,
}) {
  const keyword = [product.name, product.category, product.rayon]
    .filter(Boolean)
    .join(' ');
  const hasSubs = recipeUsage?.hasSubstitutions && recipeUsage?.substitutionCount > 0;
  const subCount = recipeUsage?.substitutionCount || 0;

  // Grammage info pour affichage complémentaire
  const grammageInfo = product.grammage_g
    ? `${product.grammage_g}g`
    : product.volume_ml
      ? `${product.volume_ml}ml`
      : null;

  return (
    <div className="product-sw">
      <div className="product-sw__hero">
        <AsyncImage
          src={product.image_url || undefined} fallbackSrc={productImageFallback(product)}
          keyword={keyword}
          alt={product.name}
          className="product-sw__image"
          fallbackIcon={iconForProduct(product)}
          fallbackIconSize={100}
        />
        <div className="product-sw__rayon">
          <Badge variant="primary">{product.rayon || product.category || 'Divers'}</Badge>
        </div>
        {hasSubs && (
          <button
            type="button"
            className="product-sw__sub-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (onSubstitutionClick) onSubstitutionClick();
            }}
            aria-label="Voir les alternatives"
            style={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '4px 8px',
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--color-accent)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
          >
            <Icon name="sparkles" size={12} strokeWidth={2.5} />
            Alternatives
          </button>
        )}
      </div>
      {/* Recipe usage banner intégré DANS la carte — contextualisé au produit swipé */}
      <RecipeUsageBanner recipeUsage={recipeUsage} />
      <div className="product-sw__body">
        <div>
          <h3 className="product-sw__title">{product.name}</h3>
          {product.brand && <div className="product-sw__brand">{product.brand}</div>}
          {/* Grammage en petit complément */}
          {grammageInfo && (
            <div className="product-sw__grammage">
              {grammageInfo} · 1 {product.unit || 'unité'}
            </div>
          )}
        </div>
        <div className="product-sw__qty-row" data-no-drag>
          <span className="product-sw__qty-label">Quantité</span>
          <Counter
            value={quantity}
            onChange={onQuantityChange}
            min={1}
            max={50}
            step={1}
            unit={product.unit}
          />
        </div>
      </div>
    </div>
  );
}

function ResumePanel({ products, quotidien, quotidienQty, extras, onReset }) {
  const needed = products.filter((p) => quotidien[p.id] === 'needed');
  return (
    <div className="swipe-resume">
      <div className="swipe-resume__icon">
        <Icon name="check" size={28} strokeWidth={2.5} />
      </div>
      <div>
        <div className="swipe-resume__count">{needed.length}</div>
        <div className="swipe-resume__label">
          produit{needed.length > 1 ? 's' : ''} a racheter
        </div>
      </div>
      {needed.length > 0 && (
        <div className="swipe-resume__list">
          {needed.map((p) => (
            <div key={p.id} className="swipe-resume__row">
              <span className="swipe-resume__row-name">{p.name}</span>
              <span className="swipe-resume__row-meta">
                {quotidienQty[p.id] ?? p.default_quantity ?? 1} {p.unit}
              </span>
            </div>
          ))}
          {extras.map((e) => (
            <div key={e.id} className="swipe-resume__row">
              <span className="swipe-resume__row-name">{e.name}</span>
              <span className="swipe-resume__row-meta">ajout manuel</span>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="swipe-resume__reset" onClick={onReset}>
        Reprendre le tri
      </button>
    </div>
  );
}

function SwipeDailyChecklist() {
  const products = useProductsStore((s) => s.items);
  const loaded = useProductsStore((s) => s.loaded);
  const load = useProductsStore((s) => s.load);

  const recipes = useRecipesStore((s) => s.items);
  const loadRecipes = useRecipesStore((s) => s.load);

  const selectedRecipes = useWizardStore((s) => s.selectedRecipes);
  const quotidien = useWizardStore((s) => s.quotidien);
  const quotidienQty = useWizardStore((s) => s.quotidienQty);
  const markProduct = useWizardStore((s) => s.markProduct);
  const setQuotidienQty = useWizardStore((s) => s.setQuotidienQty);
  const extras = useWizardStore((s) => s.extras);
  const addExtra = useWizardStore((s) => s.addExtra);
  const removeExtra = useWizardStore((s) => s.removeExtra);

  const [seenIds, setSeenIds] = useState(() => new Set());
  const [lastDecision, setLastDecision] = useState(null);
  const [extraDraft, setExtraDraft] = useState('');
  const [substitutionSheet, setSubstitutionSheet] = useState({
    open: false,
    ingredientName: '',
    ingredientQty: 0,
    ingredientUnit: 'unité',
    categoryHint: null,
    product: null,
  });

  useEffect(() => {
    load();
    loadRecipes();
  }, [load, loadRecipes]);

  const favorites = useMemo(
    () => products.filter((p) => p.favorite !== false),
    [products],
  );
  const queue = useMemo(
    () => favorites.filter((p) => !seenIds.has(p.id)),
    [favorites, seenIds],
  );

  function handleAccept(product) {
    setLastDecision({id:product.id, status:quotidien[product.id]});
    if (quotidien[product.id] !== 'needed') markProduct(product.id, 'needed');
    if (quotidienQty[product.id] == null) {
      setQuotidienQty(product.id, product.default_quantity || 1);
    }
    setSeenIds((prev) => new Set(prev).add(product.id));
  }

  function handleReject(product) {
    setLastDecision({id:product.id, status:quotidien[product.id]});
    if (quotidien[product.id] !== 'owned') markProduct(product.id, 'owned');
    setSeenIds((prev) => new Set(prev).add(product.id));
  }

  function handleAddExtra(e) {
    e.preventDefault();
    const name = extraDraft.trim();
    if (!name) return;
    addExtra({ name, rayon: 'Divers' });
    setExtraDraft('');
  }

  function handleReset() {
    setSeenIds(new Set());
  }

  function handleSubstitutionClick(product, recipeUsage) {
    const ing = recipeUsage?.substitutionIngredient;
    if (!ing) return;
    setSubstitutionSheet({
      open: true,
      ingredientName: ing.name,
      ingredientQty: ing.qty || 0,
      ingredientUnit: ing.unit || 'unité',
      categoryHint: ing.category_hint || null,
      product,
    });
  }

  function handleRecipeIngredientSubstitution(item) {
    const ing = item.ingredient;
    const product = item.product;
    if (!ing) return;
    setSubstitutionSheet({
      open: true,
      ingredientName: ing.name,
      ingredientQty: ing.qty || 0,
      ingredientUnit: ing.unit || 'unité',
      categoryHint: ing.category_hint || null,
      product,
    });
  }

  function handleSubstitutionSelect(candidate) {
    // Save the substitution — update product quantity based on candidate
    if (candidate && candidate.product_id) {
      const qty = candidate.pack_count || 1;
      setQuotidienQty(candidate.product_id, qty);
    }
  }

  function handleCloseSubstitution() {
    setSubstitutionSheet((prev) => ({ ...prev, open: false }));
  }

  const neededCount = Object.values(quotidien).filter((v) => v === 'needed').length;
  const hasSelectedRecipes = Object.keys(selectedRecipes || {}).length > 0;

  return (
    <section className="stack stack--lg">
      {/* Section: Daily Checklist — l'info recette est DANS chaque carte swipe */}

      <div className="recipe-ingredients-header">
        <h2 className="recipe-ingredients-header__title">
          Ton quotidien
        </h2>
        <p className="recipe-ingredients-header__subtitle">
          Choisis « J’en ai » ou « À acheter ». Tu peux aussi faire glisser la carte.
        </p>
      </div>

      {loaded && favorites.length === 0 ? (
        <EmptyState icon="package" title="Aucun produit favori">
          Ajoute-en depuis l'onglet Produits pour les retrouver ici.
        </EmptyState>
      ) : (
        <SwipeStack
          items={queue}
          onAccept={handleAccept}
          onReject={handleReject}
          acceptLabel="À acheter"
          rejectLabel="J’en ai"
          renderCard={(product) => (
            <ProductSwipeCard
              product={product}
              quantity={quotidienQty[product.id] ?? product.default_quantity ?? 1}
              onQuantityChange={(q) => setQuotidienQty(product.id, q)}
              recipeUsage={getRecipeUsage({
                productId: product.id,
                productName: product.name,
                productUnit: product.unit,
                product,
                selectedRecipes,
                recipes,
              })}
              onSubstitutionClick={() =>
                handleSubstitutionClick(
                  product,
                  getRecipeUsage({
                    productId: product.id,
                    productName: product.name,
                    productUnit: product.unit,
                    product,
                    selectedRecipes,
                    recipes,
                  }),
                )
              }
            />
          )}
          emptyState={
            <ResumePanel
              products={favorites}
              quotidien={quotidien}
              quotidienQty={quotidienQty}
              extras={extras}
              onReset={handleReset}
            />
          }
        />
      )}

      {lastDecision && <button className="text-action" onClick={() => {
        const {id,status} = lastDecision;
        if (quotidien[id] !== status) markProduct(id,status || null);
        setSeenIds((prev) => {const next=new Set(prev); next.delete(id); return next;});
        setLastDecision(null);
      }}>Annuler la dernière décision</button>}
      <Card className="stack">
        <div>
          <strong>Il manque un produit ?</strong>
          <div className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>
            Ajoute-le a la volee. Tu pourras le sauver en favori plus tard.
          </div>
        </div>
        <form onSubmit={handleAddExtra} className="inline-form">
          <Input
            placeholder="Ex: Sopalin, bananes..."
            value={extraDraft}
            onChange={(e) => setExtraDraft(e.target.value)}
            aria-label="Ajout rapide"
          />
          <Button type="submit">
            <Icon name="plus" size={16} strokeWidth={2.5} /> Ajouter
          </Button>
        </form>

        {extras.length > 0 && (
          <ul className="stack stack--sm">
            {extras.map((e) => (
              <li key={e.id} className="item">
                <div className="item__body">
                  <div className="item__title">{e.name}</div>
                  <div className="item__meta">{e.rayon}</div>
                </div>
                <Button
                  variant="danger"
                  onClick={() => removeExtra(e.id)}
                  aria-label="Retirer"
                >
                  <Icon name="trash" size={16} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ProductSubstitutionSheet
        isOpen={substitutionSheet.open}
        onClose={handleCloseSubstitution}
        ingredientName={substitutionSheet.ingredientName}
        ingredientQty={substitutionSheet.ingredientQty}
        ingredientUnit={substitutionSheet.ingredientUnit}
        categoryHint={substitutionSheet.categoryHint}
        onSelect={handleSubstitutionSelect}
      />

      <div className="wizard-summary">
        <span className="wizard-summary__icon">
          <Icon name="cart" strokeWidth={2.2} />
        </span>
        <span>
          <strong>{neededCount}</strong> produit{neededCount > 1 ? 's' : ''} a
          racheter · {extras.length} ajout{extras.length > 1 ? 's' : ''} manuel
          {extras.length > 1 ? 's' : ''}
        </span>
      </div>
    </section>
  );
}


export function DailyChecklist() {
  const { items, loaded, loading, error, load } = useProductsStore();
  const { quotidien, quotidienQty, markProduct, setQuotidienQty, extras, addExtra, removeExtra } = useWizardStore();
  const [mode, setMode] = useState('list');
  const [query, setQuery] = useState('');
  const [extra, setExtra] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(true);
  useEffect(() => { load(); }, [load]);
  const groups = useMemo(() => {
    const grouped = new Map();
    items.filter((p) => (!onlyFavorites || p.favorite !== false) && `${p.name} ${p.brand || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').includes(query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr'))).forEach((p) => {
      const label = p.rayon || p.category_label || p.category || 'Autres';
      if (!grouped.has(label)) grouped.set(label, []);
      grouped.get(label).push(p);
    });
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b, 'fr'));
  }, [items, query, onlyFavorites]);
  function select(product, status) {
    markProduct(product.id, status);
    if (quotidienQty[product.id] == null) setQuotidienQty(product.id, product.default_quantity || 1);
  }
  return <section className="stack stack--lg">
    <h2>En plus des repas</h2><p className="text-muted">Passe tes rayons en revue. Ajoute ce qui manque et ajuste les quantités.</p>
    <div className="view-switch" role="group" aria-label="Présentation des produits"><button aria-pressed={mode === 'list'} onClick={() => setMode('list')}>Par rayon</button><button aria-pressed={mode === 'swipe'} onClick={() => setMode('swipe')}>Un par un</button></div>
    {error && <div role="alert" className="notice notice--error">{error} <button onClick={load} className="text-action">Réessayer</button></div>}
    {loading && !loaded && <p role="status">Chargement des produits…</p>}
    {mode === 'swipe' ? <SwipeDailyChecklist /> : <>
      <input className="search-field" type="search" aria-label="Rechercher dans le quotidien" placeholder="Rechercher un produit…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="view-switch" role="group" aria-label="Produits à afficher"><button aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites(true)}>Mes habituels</button><button aria-pressed={!onlyFavorites} onClick={() => setOnlyFavorites(false)}>Tous les produits</button></div>
      {groups.map(([rayon, products]) => <section key={rayon} className="stack"><h2 className="rayon-title">{rayon}<span>{products.length}</span></h2><div className="selection-list">{products.map((p) => <article className={`daily-row ${quotidien[p.id] === 'needed' ? 'is-selected' : ''}`} key={p.id}>
        <div className="daily-row__head"><AsyncImage src={p.image_url} fallbackSrc={productImageFallback(p)} alt={p.name} className="choice-card__image" fallbackIcon="package" /><div><strong>{p.name}</strong><small>{[p.brand, p.grammage_g ? `${p.grammage_g} g` : p.volume_ml ? `${p.volume_ml} ml` : p.unit].filter(Boolean).join(' · ')}</small></div></div>
        <div className="daily-row__actions"><button aria-pressed={quotidien[p.id] === 'owned'} onClick={() => select(p, 'owned')}>J’en ai</button><button aria-pressed={quotidien[p.id] === 'needed'} onClick={() => select(p, 'needed')}>À acheter</button></div>
        {quotidien[p.id] === 'needed' && <div className="choice-card__quantity"><span>Quantité</span><Counter value={quotidienQty[p.id] || p.default_quantity || 1} onChange={(n) => setQuotidienQty(p.id, n)} min={1} max={99} unit={p.unit} ariaLabel={`Quantité de ${p.name}`} /></div>}
      </article>)}</div></section>)}
      {loaded && !error && groups.length === 0 && <p className="notice">Aucun produit à afficher. Essaie « Tous les produits », ajoute un article ou continue.</p>}
      <QuickAdd />
    </>}
  </section>;
}
