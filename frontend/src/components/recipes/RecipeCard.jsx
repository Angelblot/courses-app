import { Button } from '../ui/Button.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Icon } from '../ui/Icon.jsx';
import { AsyncImage } from '../ui/AsyncImage.jsx';

const FALLBACK_ICONS = ['bowl', 'chef', 'apple'];

function fallbackIconFor(recipe) {
  const key = String(recipe.id ?? '')
    .split('')
    .reduce((a, c) => a + c.charCodeAt(0), 0);
  return FALLBACK_ICONS[key % FALLBACK_ICONS.length];
}

export function RecipeCard({ recipe, onDelete, onUse, onEdit, isEditing }) {
  const fallbackIcon = fallbackIconFor(recipe);
  const classes = ['recipe-card', isEditing && 'recipe-card--editing']
    .filter(Boolean)
    .join(' ');
  const keyword = [recipe.name, recipe.category, 'food']
    .filter(Boolean)
    .join(' ');

  function handleCardClick(e) {
    if (!onEdit) return;
    if (e.target.closest('button, a')) return;
    onEdit(recipe);
  }
  function handleKeyDown(e) {
    if (!onEdit) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onEdit(recipe);
    }
  }

  return (
    <article
      className={classes}
      role={onEdit ? 'button' : undefined}
      tabIndex={onEdit ? 0 : undefined}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      aria-label={onEdit ? `Éditer ${recipe.name}` : undefined}
    >
      <AsyncImage
        keyword={keyword}
        alt={recipe.name}
        className="recipe-card__image"
        aspect="16 / 9"
        fallbackIcon={fallbackIcon}
        fallbackIconSize={40}
      />
      <div className="recipe-card__body">
        <div className="recipe-card__head">
          <h3 className="recipe-card__title">{recipe.name}</h3>
          <Badge variant="primary">{recipe.category || 'Plat'}</Badge>
        </div>
        {recipe.description && <p className="recipe-card__desc">{recipe.description}</p>}
        <div className="recipe-card__meta">
          <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
            <Icon name="users" size={12} />
            {recipe.servings_default || 2} pers.
          </span>
          <span className="recipe-card__meta-dot">·</span>
          <span>{recipe.ingredients?.length || 0} ingrédients</span>
        </div>
      </div>
      <div className="recipe-card__actions">
        {onEdit && (
          <Button variant="ghost" onClick={() => onEdit(recipe)} aria-label="Éditer">
            <Icon name="edit" size={16} />
          </Button>
        )}
        {onUse && (
          <Button variant="secondary" size="sm" onClick={() => onUse(recipe)}>
            Wizard
          </Button>
        )}
        {onDelete && (
          <Button variant="danger" onClick={() => onDelete(recipe.id)} aria-label="Supprimer">
            <Icon name="trash" size={16} />
          </Button>
        )}
      </div>
    </article>
  );
}
