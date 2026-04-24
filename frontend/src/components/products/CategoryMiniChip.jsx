import { Icon } from '../ui/Icon.jsx';
import { categoryTint } from './categoryTints.js';

export function CategoryMiniChip({
  categoryKey,
  icon,
  label,
  onClick,
}) {
  if (!label) return null;
  const clickable = typeof onClick === 'function';
  const style = { background: categoryTint(categoryKey) };

  if (clickable) {
    return (
      <button
        type="button"
        className="category-mini-chip category-mini-chip--button"
        style={style}
        onClick={(e) => {
          e.stopPropagation();
          onClick(categoryKey);
        }}
        aria-label={`Filtrer par ${label}`}
      >
        {icon && <Icon name={icon} size={12} strokeWidth={2} />}
        <span>{label}</span>
      </button>
    );
  }

  return (
    <span className="category-mini-chip" style={style}>
      {icon && <Icon name={icon} size={12} strokeWidth={2} />}
      <span>{label}</span>
    </span>
  );
}
