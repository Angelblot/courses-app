import { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Input } from '../ui/Input.jsx';

export const CATEGORY_ICON_CHOICES = [
  'apple',
  'leaf',
  'milk',
  'ham',
  'cup-soda',
  'package',
  'package-2',
  'spray-can',
  'sparkles',
  'home',
  'snowflake',
  'tag',
  'fire',
  'bowl',
  'chef',
  'sprout',
  'coin',
  'cart',
  'bag',
  'book',
  'star',
  'heart',
];

const OVERLAY = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(26,26,26,0.55)',
  zIndex: 60,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  padding: 0,
};

const DRAWER = {
  background: '#FAFAF8',
  width: '100%',
  maxWidth: 640,
  maxHeight: '92vh',
  overflowY: 'auto',
  borderTopLeftRadius: 18,
  borderTopRightRadius: 18,
  boxShadow: '0 -10px 40px rgba(0,0,0,0.18)',
  display: 'flex',
  flexDirection: 'column',
};

const HEADER = {
  position: 'sticky',
  top: 0,
  background: '#FAFAF8',
  padding: '14px 16px',
  borderBottom: '1px solid #E8E8E6',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  zIndex: 1,
};

const BODY = {
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const FIELD_LABEL = {
  fontSize: 12,
  fontWeight: 600,
  color: '#6B6B6B',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 6,
};

function slugify(value) {
  return (value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

export function CategoryFormModal({
  mode,
  category,
  usedKeys = [],
  iconChoices = CATEGORY_ICON_CHOICES,
  onSubmit,
  onClose,
}) {
  const isEdit = mode === 'edit';
  const [label, setLabel] = useState(category?.label || '');
  const [key, setKey] = useState(category?.key || '');
  const [icon, setIcon] = useState(category?.icon || iconChoices[0]);
  const [displayOrder, setDisplayOrder] = useState(
    category?.display_order ?? 0,
  );
  const [keyTouched, setKeyTouched] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !submitting) onClose();
    }
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, submitting]);

  const effectiveKey = isEdit ? category.key : keyTouched ? key : slugify(label);

  const keyError = useMemo(() => {
    if (isEdit) return null;
    const k = effectiveKey;
    if (!k) return null;
    if (!/^[a-z0-9_]+$/.test(k)) {
      return 'Le key doit contenir uniquement des lettres minuscules, chiffres et _';
    }
    if (usedKeys.includes(k)) {
      return 'Cette clé est déjà utilisée';
    }
    return null;
  }, [isEdit, effectiveKey, usedKeys]);

  const canSubmit =
    Boolean(label.trim()) &&
    Boolean(icon) &&
    Boolean(effectiveKey) &&
    !keyError &&
    !submitting;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (isEdit) {
        await onSubmit({
          label: label.trim(),
          icon,
          display_order: Number(displayOrder) || 0,
        });
      } else {
        await onSubmit({
          key: effectiveKey,
          label: label.trim(),
          icon,
          display_order: Number(displayOrder) || 0,
        });
      }
    } catch (_err) {
      // Error already surfaced via toast by the caller.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={OVERLAY} onClick={onClose} role="presentation">
      <div
        style={DRAWER}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
      >
        <div style={HEADER}>
          <div style={{ flex: 1, fontWeight: 600, fontSize: 16 }}>
            {isEdit ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="Fermer">
            <Icon name="x" size={18} />
          </Button>
        </div>

        <form onSubmit={handleSubmit} style={BODY} className="stack">
          <div>
            <div style={FIELD_LABEL}>Libellé</div>
            <Input
              autoFocus
              placeholder="Fruits & légumes"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              aria-label="Libellé de la catégorie"
            />
          </div>

          <div>
            <div style={FIELD_LABEL}>Clé technique</div>
            <Input
              placeholder="fruits_legumes"
              value={effectiveKey}
              onChange={(e) => {
                setKey(e.target.value.toLowerCase());
                setKeyTouched(true);
              }}
              disabled={isEdit}
              aria-label="Clé technique"
              style={
                isEdit
                  ? {
                      fontFamily:
                        'ui-monospace, SFMono-Regular, Menlo, monospace',
                      opacity: 0.6,
                    }
                  : {
                      fontFamily:
                        'ui-monospace, SFMono-Regular, Menlo, monospace',
                    }
              }
            />
            {!isEdit && keyError && (
              <div style={{ fontSize: 12, color: '#D62828', marginTop: 6 }}>
                {keyError}
              </div>
            )}
            {isEdit && (
              <div style={{ fontSize: 12, color: '#9A9A97', marginTop: 6 }}>
                La clé n'est pas modifiable.
              </div>
            )}
          </div>

          <div>
            <div style={FIELD_LABEL}>Icône</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))',
                gap: 8,
              }}
              role="radiogroup"
              aria-label="Choix de l'icône"
            >
              {iconChoices.map((name) => {
                const active = icon === name;
                return (
                  <button
                    key={name}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setIcon(name)}
                    title={name}
                    style={{
                      aspectRatio: '1 / 1',
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: 12,
                      border: active
                        ? '2px solid #2D6A4F'
                        : '1px solid #E8E8E6',
                      background: active ? '#E6EFE9' : '#FFFFFF',
                      color: '#1A1A1A',
                      cursor: 'pointer',
                      transition: 'background 150ms ease, border 150ms ease',
                    }}
                  >
                    <Icon name={name} size={22} strokeWidth={1.8} />
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div style={FIELD_LABEL}>Ordre d'affichage</div>
            <Input
              type="number"
              min="0"
              step="1"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              aria-label="Ordre d'affichage"
            />
            <div style={{ fontSize: 12, color: '#9A9A97', marginTop: 6 }}>
              Plus petit = affiché en premier dans la barre de catégories.
            </div>
          </div>

          <div className="row">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button type="submit" full disabled={!canSubmit}>
              {submitting
                ? '…'
                : isEdit
                  ? 'Mettre à jour'
                  : 'Créer la catégorie'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
