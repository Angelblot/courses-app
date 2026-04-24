import { Icon } from '../ui/Icon.jsx';
import { categoryTint } from './categoryTints.js';

export function CategoryChipBar({ categories, activeKey, onChange }) {
  const visible = (categories || []).filter((c) => c.count > 0);
  if (visible.length === 0) return null;
  const hasActive = Boolean(activeKey);

  return (
    <div
      role="toolbar"
      aria-label="Filtres catégorie"
      className="category-chip-bar"
    >
      {hasActive && (
        <button
          type="button"
          className="category-chip category-chip--reset"
          onClick={() => onChange(null)}
          aria-label="Tout afficher, aucun filtre"
        >
          <Icon name="x" size={14} strokeWidth={2} />
          <span>Tout afficher</span>
        </button>
      )}
      {visible.map((c) => {
        const active = c.key === activeKey;
        return (
          <button
            key={c.key}
            type="button"
            aria-pressed={active}
            aria-label={`Filtrer par ${c.label}, ${c.count} produits`}
            className={`category-chip ${active ? 'category-chip--active' : ''}`}
            style={active ? undefined : { background: categoryTint(c.key) }}
            onClick={() => onChange(active ? null : c.key)}
          >
            <Icon name={c.icon} size={14} strokeWidth={2} />
            <span className="category-chip__label">{c.label}</span>
            <span className="category-chip__count">{c.count}</span>
          </button>
        );
      })}
    </div>
  );
}
