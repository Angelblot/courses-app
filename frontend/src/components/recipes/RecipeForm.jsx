import { useEffect, useMemo, useState } from 'react';
import { useProductsStore } from '../../stores/productsStore.js';
import { Button } from '../ui/Button.jsx';
import { Card } from '../ui/Card.jsx';
import { Input, Select, Textarea } from '../ui/Input.jsx';
import { Icon } from '../ui/Icon.jsx';

const RAYONS = [
  'Fruits & légumes',
  'Boucherie',
  'Poissonnerie',
  'Crèmerie',
  'Boulangerie',
  'Épicerie',
  'Surgelés',
  'Boissons',
  'Hygiène',
  'Entretien',
  'Divers',
];

const GENERIC_CATEGORY_SUGGESTIONS = [
  'Fruits & légumes', 'Viande', 'Poisson', 'Laitages', 'Pâtes', 'Riz',
  'Conserves', 'Épices', 'Sauces', 'Apéritif', 'Boissons', 'Surgelés',
];

const RECIPE_CATEGORIES = ['Entrées', 'Plats', 'Desserts', 'Petit-déjeuner', 'Goûter', 'Apéritif'];

const UNITS = ['unité', 'g', 'kg', 'ml', 'L', 'pincée', 'cuillère à café', 'cuillère à soupe'];

function emptyIngredient() {
  return {
    source: 'custom',
    product_id: null,
    name: '',
    quantity_per_serving: 1,
    unit: 'unité',
    rayon: 'Épicerie',
    category: '',
  };
}

function emptyForm() {
  return {
    name: '',
    description: '',
    category: '',
    servings_default: 2,
    ingredients: [emptyIngredient()],
  };
}

function normalizeIncoming(value) {
  if (!value) return emptyForm();
  const ingredients = (value.ingredients || []).map((ing) => ({
    source: ing.product_id ? 'product' : 'custom',
    product_id: ing.product_id ?? null,
    name: ing.name || '',
    quantity_per_serving: ing.quantity_per_serving ?? 1,
    unit: ing.unit || 'unité',
    rayon: ing.rayon || 'Épicerie',
    category: ing.category || '',
  }));
  return {
    name: value.name || '',
    description: value.description || '',
    category: value.category || '',
    servings_default: value.servings_default || 2,
    ingredients: ingredients.length ? ingredients : [emptyIngredient()],
  };
}

export function RecipeForm({ onSubmit, onCancel, initialValue, title }) {
  const products = useProductsStore((s) => s.items);
  const loadProducts = useProductsStore((s) => s.load);
  const productsLoaded = useProductsStore((s) => s.loaded);

  const [form, setForm] = useState(() => normalizeIncoming(initialValue));
  const [submitting, setSubmitting] = useState(false);
  const isEditing = Boolean(initialValue?.id);

  useEffect(() => {
    if (!productsLoaded) loadProducts();
  }, [productsLoaded, loadProducts]);

  useEffect(() => {
    setForm(normalizeIncoming(initialValue));
  }, [initialValue]);

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  function updateIngredient(index, patch) {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, i) =>
        i === index ? { ...ing, ...patch } : ing,
      ),
    }));
  }

  function setIngredientSource(index, source) {
    updateIngredient(index, { source, product_id: null });
  }

  function selectProduct(index, productId) {
    if (!productId) {
      updateIngredient(index, { product_id: null, name: '' });
      return;
    }
    const product = products.find((p) => String(p.id) === String(productId));
    if (!product) return;
    updateIngredient(index, {
      product_id: product.id,
      name: product.name,
      unit: product.unit || 'unité',
      rayon: product.rayon || product.category || 'Divers',
      category: product.category || '',
    });
  }

  function addIngredient() {
    setForm((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, emptyIngredient()],
    }));
  }

  function removeIngredient(index) {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const cleaned = {
        name: form.name.trim(),
        description: form.description,
        category: form.category,
        servings_default: form.servings_default,
        ingredients: form.ingredients
          .filter((ing) => ing.name.trim())
          .map((ing) => ({
            product_id: ing.source === 'product' ? ing.product_id : null,
            name: ing.name.trim(),
            quantity_per_serving: ing.quantity_per_serving,
            unit: ing.unit,
            rayon: ing.rayon,
            category: ing.category,
          })),
      };
      await onSubmit(cleaned);
      if (!isEditing) setForm(emptyForm());
      onCancel?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card size="lg">
      {title && <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{title}</div>}
      <form onSubmit={handleSubmit} className="stack">
        <Input
          placeholder="Nom de la recette *"
          value={form.name}
          onChange={(e) => update({ name: e.target.value })}
          required
          aria-label="Nom de la recette"
        />

        <div className="grid-2">
          <Select
            value={form.category || ''}
            onChange={(e) => update({ category: e.target.value })}
            aria-label="Catégorie"
          >
            <option value="">— Catégorie —</option>
            {RECIPE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
            {form.category && !RECIPE_CATEGORIES.includes(form.category) && (
              <option value={form.category}>{form.category}</option>
            )}
          </Select>
          <Input
            type="number"
            min="1"
            placeholder="Portions par défaut"
            value={form.servings_default}
            onChange={(e) => update({ servings_default: parseInt(e.target.value, 10) || 2 })}
            aria-label="Portions par défaut"
          />
        </div>

        <Textarea
          placeholder="Description / notes…"
          value={form.description}
          onChange={(e) => update({ description: e.target.value })}
          aria-label="Description"
        />

        <div className="ingredient-editor">
          <div className="ingredient-editor__head">
            <strong>Ingrédients</strong>
            <span className="ingredient-editor__count">
              {form.ingredients.length} ligne{form.ingredients.length > 1 ? 's' : ''}
            </span>
          </div>

          {form.ingredients.map((ing, i) => (
            <IngredientRow
              key={i}
              index={i}
              ingredient={ing}
              canRemove={form.ingredients.length > 1}
              products={products}
              onChange={(patch) => updateIngredient(i, patch)}
              onSourceChange={(src) => setIngredientSource(i, src)}
              onPickProduct={(id) => selectProduct(i, id)}
              onRemove={() => removeIngredient(i)}
            />
          ))}

          <Button type="button" variant="secondary" size="sm" onClick={addIngredient}>
            <Icon name="plus" size={14} strokeWidth={2.5} /> Ajouter un ingrédient
          </Button>
        </div>

        <div className="row">
          {onCancel && (
            <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          )}
          <Button type="submit" full disabled={submitting}>
            {submitting ? '…' : isEditing ? 'Mettre à jour' : 'Enregistrer la recette'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function IngredientRow({
  index,
  ingredient,
  canRemove,
  products,
  onChange,
  onSourceChange,
  onPickProduct,
  onRemove,
}) {
  const isProduct = ingredient.source === 'product';

  return (
    <div className="ingredient-card">
      <div className="ingredient-card__head">
        <span className="ingredient-card__index">Ingrédient {index + 1}</span>
        <div className="source-toggle" role="tablist" aria-label="Source">
          <button
            type="button"
            role="tab"
            aria-selected={isProduct}
            className={`source-toggle__btn ${isProduct ? 'source-toggle__btn--active' : ''}`}
            onClick={() => onSourceChange('product')}
          >
            Produit
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isProduct}
            className={`source-toggle__btn ${!isProduct ? 'source-toggle__btn--active' : ''}`}
            onClick={() => onSourceChange('custom')}
          >
            Libre
          </button>
        </div>
      </div>

      <div className="stack stack--sm">
        {isProduct ? (
          <Select
            value={ingredient.product_id ? String(ingredient.product_id) : ''}
            onChange={(e) => onPickProduct(e.target.value)}
            aria-label="Choisir un produit"
          >
            <option value="">— Choisir un produit —</option>
            {products.length === 0 && (
              <option value="" disabled>Aucun produit dans le catalogue</option>
            )}
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.brand ? ` · ${p.brand}` : ''}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            placeholder="Ex: fruits et légumes, viande, épices…"
            value={ingredient.name}
            onChange={(e) => onChange({ name: e.target.value })}
            aria-label="Nom générique"
          />
        )}

        <div className="row">
          <Input
            type="number"
            min="0"
            step="0.1"
            placeholder="Qté / pers."
            value={ingredient.quantity_per_serving}
            onChange={(e) => onChange({ quantity_per_serving: parseFloat(e.target.value) || 0 })}
            aria-label="Quantité par personne"
          />
          <Select
            value={ingredient.unit}
            onChange={(e) => onChange({ unit: e.target.value })}
            aria-label="Unité"
          >
            {UNITS.map((u) => (<option key={u} value={u}>{u}</option>))}
            {!UNITS.includes(ingredient.unit) && ingredient.unit && (
              <option value={ingredient.unit}>{ingredient.unit}</option>
            )}
          </Select>
        </div>

        <div className="grid-2">
          <Select
            value={ingredient.rayon}
            onChange={(e) => onChange({ rayon: e.target.value })}
            aria-label="Rayon"
          >
            {RAYONS.map((r) => (<option key={r} value={r}>{r}</option>))}
            {!RAYONS.includes(ingredient.rayon) && ingredient.rayon && (
              <option value={ingredient.rayon}>{ingredient.rayon}</option>
            )}
          </Select>
          <Input
            list={`cat-suggest-${index}`}
            placeholder="Catégorie (Légumes, Pâtes…)"
            value={ingredient.category}
            onChange={(e) => onChange({ category: e.target.value })}
            aria-label="Catégorie"
          />
          <datalist id={`cat-suggest-${index}`}>
            {GENERIC_CATEGORY_SUGGESTIONS.map((c) => (<option key={c} value={c} />))}
          </datalist>
        </div>

        {canRemove && (
          <div className="row row--between">
            <span className="text-subtle" style={{ fontSize: 12 }}>
              {isProduct && ingredient.product_id ? 'Lié au catalogue' : 'Ingrédient libre'}
            </span>
            <Button type="button" variant="danger" size="sm" onClick={onRemove} aria-label="Supprimer l'ingrédient">
              <Icon name="trash" size={14} /> Retirer
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
