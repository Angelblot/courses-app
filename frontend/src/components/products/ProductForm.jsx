import { useEffect, useState } from 'react';
import { Button } from '../ui/Button.jsx';
import { Card } from '../ui/Card.jsx';
import { Input, Select, Textarea } from '../ui/Input.jsx';

const EMPTY = {
  name: '',
  brand: '',
  category: '',
  default_quantity: 1,
  unit: 'unité',
  favorite: false,
  notes: '',
};

const SUGGESTED_UNITS = ['unité', 'g', 'kg', 'ml', 'L', 'paquet', 'boîte', 'tranche'];

export function ProductForm({
  onSubmit,
  onCancel,
  initialValue,
  categories = [],
  title,
}) {
  const [form, setForm] = useState(() => ({ ...EMPTY, ...(initialValue || {}) }));
  const [submitting, setSubmitting] = useState(false);
  const isEditing = Boolean(initialValue?.id);

  useEffect(() => {
    setForm({ ...EMPTY, ...(initialValue || {}) });
  }, [initialValue]);

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(form);
      if (!isEditing) setForm(EMPTY);
      onCancel?.();
    } finally {
      setSubmitting(false);
    }
  }

  const uniqueCategories = Array.from(
    new Set([...categories, form.category].filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  return (
    <Card as="section" className="stack" size="lg">
      {title && <div className="modal__title">{title}</div>}
      <form onSubmit={handleSubmit} className="stack">
        <Input
          placeholder="Nom *"
          value={form.name}
          onChange={(e) => update({ name: e.target.value })}
          required
          aria-label="Nom du produit"
        />

        <div className="grid-2">
          <Input
            placeholder="Marque"
            value={form.brand || ''}
            onChange={(e) => update({ brand: e.target.value })}
            aria-label="Marque"
          />
          <div className="stack stack--sm">
            <Select
              value={form.category || ''}
              onChange={(e) => update({ category: e.target.value })}
              aria-label="Catégorie"
            >
              <option value="">— Choisir une catégorie —</option>
              {uniqueCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="__new__">+ Nouvelle catégorie…</option>
            </Select>
            {form.category === '__new__' && (
              <Input
                autoFocus
                placeholder="Nouvelle catégorie"
                value=""
                onChange={(e) => update({ category: e.target.value })}
                aria-label="Nouvelle catégorie"
              />
            )}
          </div>
        </div>

        <div className="row">
          <Input
            type="number"
            min="0"
            step="0.1"
            placeholder="Qté"
            value={form.default_quantity}
            onChange={(e) =>
              update({ default_quantity: parseFloat(e.target.value) || 0 })
            }
            aria-label="Quantité par défaut"
          />
          <Select
            value={form.unit}
            onChange={(e) => update({ unit: e.target.value })}
            aria-label="Unité"
          >
            {SUGGESTED_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
            {!SUGGESTED_UNITS.includes(form.unit) && form.unit && (
              <option value={form.unit}>{form.unit}</option>
            )}
          </Select>
        </div>

        <Textarea
          placeholder="Notes..."
          value={form.notes || ''}
          onChange={(e) => update({ notes: e.target.value })}
          aria-label="Notes"
        />

        <label className="label">
          <input
            type="checkbox"
            className="checkbox"
            checked={Boolean(form.favorite)}
            onChange={(e) => update({ favorite: e.target.checked })}
          />
          Favori (ajout auto aux nouvelles listes)
        </label>

        <div className="row">
          {onCancel && (
            <Button type="button" variant="secondary" onClick={onCancel}>
              Annuler
            </Button>
          )}
          <Button type="submit" full disabled={submitting}>
            {submitting ? '…' : isEditing ? '💾 Mettre à jour' : '✅ Enregistrer'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
