import { Button } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { AsyncImage } from '../ui/AsyncImage.jsx';
import { CategoryMiniChip } from './CategoryMiniChip.jsx';
import { ProductCardEditable } from './ProductCardEditable.jsx';

const CATEGORY_ICONS = {
  fruits_legumes: 'apple',
  pls: 'milk',
  charcuterie: 'ham',
  boissons: 'cup-soda',
  epicerie: 'package-2',
  droguerie: 'spray-can',
  parfumerie: 'sparkles',
  maison: 'home',
  surgeles: 'snowflake',
  autre: 'tag',
};

const DRIVE_LABELS = {
  carrefour: 'Carrefour',
};

function driveLabel(name) {
  if (!name) return '';
  if (DRIVE_LABELS[name]) return DRIVE_LABELS[name];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const TREND_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 11,
  fontWeight: 600,
  padding: '4px 10px',
  borderRadius: 999,
  lineHeight: 1.4,
};

const TREND_CONFIG = {
  up: { bg: '#FBE5E5', color: '#D62828', label: 'prix en hausse' },
  down: { bg: '#E4F0EA', color: '#40916C', label: 'prix en baisse' },
  stable: { bg: '#F3F1EC', color: '#6B6B6B', label: 'prix stable' },
};

function TrendArrow({ direction }) {
  if (direction === 'up') {
    return (
      <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 9l4-4 2 2 2-4" />
        <path d="M7 3h3v3" />
      </svg>
    );
  }
  if (direction === 'down') {
    return (
      <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3l4 4 2-2 2 4" />
        <path d="M7 9h3V6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6h8" />
    </svg>
  );
}

function PriceTrendBadge({ trend }) {
  const cfg = TREND_CONFIG[trend];
  if (!cfg) return null;
  return (
    <span
      style={{ ...TREND_STYLE, background: cfg.bg, color: cfg.color }}
      aria-label={cfg.label}
      title={cfg.label}
    >
      <TrendArrow direction={trend} />
      {trend === 'up' ? 'hausse' : trend === 'down' ? 'baisse' : 'stable'}
    </span>
  );
}

export function ProductCard({
  product,
  onToggleFavorite,
  onDelete,
  onEdit,
  onViewDetails,
  onCategoryClick,
  isEditing,
  isInlineEditing,
  onInlineSave,
  onInlineCancel,
  categoryLabels,
}) {
  if (isInlineEditing) {
    return (
      <ProductCardEditable
        product={product}
        categories={categoryLabels}
        onSave={(patch) => onInlineSave(product.id, patch)}
        onCancel={onInlineCancel}
      />
    );
  }

  const bodyClickable = Boolean(onViewDetails || onEdit);
  const classes = [
    'item',
    'item--with-image',
    bodyClickable && 'item--clickable',
    isEditing && 'item--editing',
  ]
    .filter(Boolean)
    .join(' ');

  const keyword = [product.name, product.category].filter(Boolean).join(' ');
  const driveNames = Array.isArray(product.drive_names) ? product.drive_names : [];
  const trend = product.price_trend;
  const categoryKey = product.category_key || null;
  const categoryLabel = product.category_label || null;
  const categoryIcon = categoryKey ? CATEGORY_ICONS[categoryKey] : null;
  const hasBadges = Boolean(categoryLabel) || Boolean(trend) || driveNames.length > 0;

  function handleBodyClick() {
    if (onViewDetails) return onViewDetails(product);
    if (onEdit) return onEdit(product);
  }
  function handleBodyKeyDown(e) {
    if (!bodyClickable) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleBodyClick();
    }
  }

  const bodyAria = onViewDetails
    ? `Voir l'historique de ${product.name}`
    : onEdit
      ? `Éditer ${product.name}`
      : undefined;

  return (
    <article className={classes}>
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
        role={bodyClickable ? 'button' : undefined}
        tabIndex={bodyClickable ? 0 : undefined}
        onClick={handleBodyClick}
        onKeyDown={handleBodyKeyDown}
        aria-label={bodyAria}
      >
        <div className="item__title">{product.name}</div>
        <div className="item__meta">
          {product.brand && <>{product.brand} · </>}
          {product.default_quantity} {product.unit}
          {product.purchase_count > 0 && (
            <>
              {' · '}
              {product.purchase_count} achat{product.purchase_count > 1 ? 's' : ''}
            </>
          )}
        </div>
        {hasBadges && (
          <div className="item__badges">
            {categoryLabel && (
              <CategoryMiniChip
                categoryKey={categoryKey}
                icon={categoryIcon}
                label={categoryLabel}
                onClick={onCategoryClick}
              />
            )}
            {trend && <PriceTrendBadge trend={trend} />}
            {driveNames.map((d) => (
              <span key={d} className="badge badge--primary">
                {driveLabel(d)}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="item__actions" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="icon"
          onClick={() => onToggleFavorite(product.id)}
          aria-label={product.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          className={product.favorite ? 'text-accent' : ''}
        >
          <Icon name="star" size={20} />
        </Button>
        {onEdit && (
          <Button variant="icon" onClick={() => onEdit(product)} aria-label="Éditer">
            <Icon name="edit" size={20} />
          </Button>
        )}
        <Button variant="icon" onClick={() => onDelete(product.id)} aria-label="Supprimer">
          <Icon name="trash" size={20} />
        </Button>
      </div>
    </article>
  );
}
