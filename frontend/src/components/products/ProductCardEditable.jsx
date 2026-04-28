import { useEffect, useRef, useState } from 'react';
import { AsyncImage } from '../ui/AsyncImage.jsx';
import { Button } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';

const SUGGESTED_UNITS = [
  'unité',
  'g',
  'kg',
  'ml',
  'L',
  'paquet',
  'boîte',
  'tranche',
];

const DEBOUNCE_MS = 400;
const FLASH_MS = 220;

function extractForm(product) {
  return {
    name: product?.name ?? '',
    brand: product?.brand ?? '',
    category: product?.category ?? '',
    default_quantity: product?.default_quantity ?? 1,
    unit: product?.unit || 'unité',
  };
}

function shallowEqual(a, b) {
  for (const k of Object.keys(a)) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

export function ProductCardEditable({
  product,
  categories = [],
  onSave,
  onCancel,
}) {
  const [form, setForm] = useState(() => extractForm(product));
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(false);
  const rootRef = useRef(null);
  const nameRef = useRef(null);
  const debounceRef = useRef(null);
  const flashTimerRef = useRef(null);
  const lastSavedRef = useRef(extractForm(product));

  useEffect(() => {
    nameRef.current?.focus();
    nameRef.current?.select?.();
  }, []);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    },
    [],
  );

  function updateField(patch) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function buildPayload(src) {
    const qty = Number(src.default_quantity);
    return {
      name: (src.name || '').trim() || product.name,
      brand: (src.brand || '').trim() || null,
      category: (src.category || '').trim() || null,
      default_quantity: Number.isFinite(qty) && qty >= 1 ? Math.floor(qty) : 1,
      unit: (src.unit || '').trim() || 'unité',
    };
  }

  async function doSave({ closeAfter = false } = {}) {
    if (saving) return;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (shallowEqual(form, lastSavedRef.current)) {
      if (closeAfter) onCancel?.();
      return;
    }
    const snapshot = { ...form };
    setSaving(true);
    try {
      await onSave(buildPayload(snapshot));
      lastSavedRef.current = snapshot;
      setFlash(true);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setFlash(false), FLASH_MS);
      if (closeAfter) onCancel?.();
    } catch (err) {
      const reverted = extractForm(product);
      setForm(reverted);
      lastSavedRef.current = reverted;
    } finally {
      setSaving(false);
    }
  }

  function scheduleAutoSave() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      doSave();
    }, DEBOUNCE_MS);
  }

  function handleRootKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      onCancel?.();
      return;
    }
    if (e.key === 'Enter' && e.target?.tagName !== 'TEXTAREA') {
      e.preventDefault();
      doSave({ closeAfter: true });
    }
  }

  function handleBlurCapture(e) {
    if (!rootRef.current) return;
    const next = e.relatedTarget;
    if (next && rootRef.current.contains(next)) return;
    scheduleAutoSave();
  }

  const keyword = [form.name, form.category].filter(Boolean).join(' ');
  const classes = [
    'item',
    'item--with-image',
    'item--editing',
    flash && 'item--flash',
  ]
    .filter(Boolean)
    .join(' ');

  const hasCategories = Array.isArray(categories) && categories.length > 0;
  const categoryOptions = Array.from(
    new Set([...(categories || []), form.category].filter((c) => c && c.trim())),
  ).sort((a, b) => a.localeCompare(b));

  return (
    <article
      ref={rootRef}
      className={classes}
      onKeyDown={handleRootKeyDown}
      onBlurCapture={handleBlurCapture}
      role="group"
      aria-label={`Édition de ${product.name}`}
    >
      <AsyncImage
        src={product.image_url || undefined}
        keyword={keyword}
        alt={product.name}
        className="item__image"
        rounded
        fallbackIcon="package"
        fallbackIconSize={20}
      />
      <div
        className="item__body"
        style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
      >
        <input
          ref={nameRef}
          className="input input--inline"
          value={form.name}
          onChange={(e) => updateField({ name: e.target.value })}
          aria-label="Nom du produit"
          placeholder="Nom"
          autoComplete="off"
          spellCheck="false"
        />
        <div className="edit-grid edit-grid--2col">
          <div className="edit-field">
            <label className="edit-label" htmlFor={`brand-${product.id}`}>
              Marque
            </label>
            <input
              id={`brand-${product.id}`}
              className="input input--inline"
              value={form.brand || ''}
              onChange={(e) => updateField({ brand: e.target.value })}
              placeholder="Marque"
              autoComplete="off"
            />
          </div>
          <div className="edit-field">
            <label className="edit-label" htmlFor={`category-${product.id}`}>
              Catégorie
            </label>
            {hasCategories ? (
              <select
                id={`category-${product.id}`}
                className="input input--inline"
                value={form.category || ''}
                onChange={(e) => updateField({ category: e.target.value })}
              >
                <option value="">Catégorie…</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`category-${product.id}`}
                className="input input--inline"
                value={form.category || ''}
                onChange={(e) => updateField({ category: e.target.value })}
                placeholder="Catégorie"
                autoComplete="off"
              />
            )}
          </div>
        </div>
        <div className="edit-grid edit-grid--qty">
          <div className="edit-field">
            <label className="edit-label" htmlFor={`qty-${product.id}`}>
              Qté
            </label>
            <input
              id={`qty-${product.id}`}
              className="input input--inline"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={form.default_quantity}
              onChange={(e) => updateField({ default_quantity: e.target.value })}
            />
          </div>
          <div className="edit-field">
            <label className="edit-label" htmlFor={`unit-${product.id}`}>
              Unité
            </label>
            <select
              id={`unit-${product.id}`}
              className="select select--inline"
              value={form.unit}
              onChange={(e) => updateField({ unit: e.target.value })}
            >
              {Array.from(new Set([...SUGGESTED_UNITS, form.unit].filter(Boolean))).map(
                (u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>
      </div>
      <div className="item__actions" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="icon"
          onClick={() => {
            if (debounceRef.current) {
              clearTimeout(debounceRef.current);
              debounceRef.current = null;
            }
            onCancel?.();
          }}
          aria-label="Annuler l'édition"
          disabled={saving}
        >
          <Icon name="x" size={20} />
        </Button>
        <Button
          variant="primary"
          onClick={() => doSave({ closeAfter: true })}
          aria-label="Enregistrer"
          disabled={saving}
          className="btn--icon"
        >
          <Icon name="check" size={20} />
        </Button>
      </div>
    </article>
  );
}

export default ProductCardEditable;
