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
}) {
  const keyword = [product.name, product.category, product.rayon]
    .filter(Boolean)
    .join(' ');
  return (
    <div className="product-sw">
      <div className="product-sw__hero">
        <AsyncImage
          src={product.image_url || undefined}
          keyword={keyword}
          alt={product.name}
          className="product-sw__image"
          fallbackIcon={iconForProduct(product)}
          fallbackIconSize={100}
        />
        <div className="product-sw__rayon">
          <Badge variant="primary">{product.rayon || product.category || 'Divers'}</Badge>
        </div>
      </div>
      <RecipeUsageBanner recipeUsage={recipeUsage} />
      <div className="product-sw__body">
        <div>
          <h3 className="product-sw__title">{product.name}</h3>
          {product.brand && <div className="product-sw__brand">{product.brand}</div>}
        </div>
        <div className="product-sw__qty-row" data-no-drag>
          <span className="product-sw__qty-label">Quantité</span>
          <Counter
            value={quantity}
            onChange={onQuantityChange}
            min={0}
            max={50}
            step={product.unit === 'g' || product.unit === 'ml' ? 50 : 1}
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
          produit{needed.length > 1 ? 's' : ''} à racheter
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

export function DailyChecklist() {
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
  const [extraDraft, setExtraDraft] = useState('');

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
    markProduct(product.id, 'needed');
    if (quotidienQty[product.id] == null) {
      setQuotidienQty(product.id, product.default_quantity || 1);
    }
    setSeenIds((prev) => new Set(prev).add(product.id));
  }

  function handleReject(product) {
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

  const neededCount = Object.values(quotidien).filter((v) => v === 'needed').length;

  return (
    <section className="stack stack--lg">
      {loaded && favorites.length === 0 ? (
        <EmptyState icon="package" title="Aucun produit favori">
          Ajoute-en depuis l'onglet Produits pour les retrouver ici.
        </EmptyState>
      ) : (
        <SwipeStack
          items={queue}
          onAccept={handleAccept}
          onReject={handleReject}
          renderCard={(product) => (
            <ProductSwipeCard
              product={product}
              quantity={quotidienQty[product.id] ?? product.default_quantity ?? 1}
              onQuantityChange={(q) => setQuotidienQty(product.id, q)}
              recipeUsage={getRecipeUsage({
                productId: product.id,
                productName: product.name,
                productUnit: product.unit,
                selectedRecipes,
                recipes,
              })}
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

      <Card className="stack">
        <div>
          <strong>Il manque un produit ?</strong>
          <div className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>
            Ajoute-le à la volée. Tu pourras le sauver en favori plus tard.
          </div>
        </div>
        <form onSubmit={handleAddExtra} className="inline-form">
          <Input
            placeholder="Ex: Sopalin, bananes…"
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

      <div className="wizard-summary">
        <span className="wizard-summary__icon">
          <Icon name="cart" strokeWidth={2.2} />
        </span>
        <span>
          <strong>{neededCount}</strong> produit{neededCount > 1 ? 's' : ''} à
          racheter · {extras.length} ajout{extras.length > 1 ? 's' : ''} manuel
          {extras.length > 1 ? 's' : ''}
        </span>
      </div>
    </section>
  );
}
