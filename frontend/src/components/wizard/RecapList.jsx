import { useMemo } from 'react';
import { useRecipesStore } from '../../stores/recipesStore.js';
import { useProductsStore } from '../../stores/productsStore.js';
import {
  useWizardStore,
  buildConsolidatedItems,
  groupByRayon,
} from '../../stores/wizardStore.js';
import { Card } from '../ui/Card.jsx';
import { EmptyState } from '../ui/EmptyState.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Icon } from '../ui/Icon.jsx';

function formatQty(qty, unit) {
  const n = Number(qty);
  if (!Number.isFinite(n)) return `${qty} ${unit}`;
  const rounded = Math.round(n * 100) / 100;
  return `${rounded} ${unit}`;
}

const SOURCE_ICONS = { recipe: 'bowl', quotidien: 'cart', extra: 'plus' };

export function RecapList() {
  const recipes = useRecipesStore((s) => s.items);
  const products = useProductsStore((s) => s.items);
  const selectedRecipes = useWizardStore((s) => s.selectedRecipes);
  const quotidien = useWizardStore((s) => s.quotidien);
  const quotidienQty = useWizardStore((s) => s.quotidienQty);
  const extras = useWizardStore((s) => s.extras);
  const removeExtra = useWizardStore((s) => s.removeExtra);

  const items = useMemo(
    () =>
      buildConsolidatedItems({
        recipes,
        selectedRecipes,
        quotidien,
        quotidienQty,
        extras,
        products,
      }),
    [recipes, selectedRecipes, quotidien, quotidienQty, extras, products],
  );

  const groups = useMemo(() => groupByRayon(items), [items]);

  const recipeIds = Object.keys(selectedRecipes);
  const activeRecipes = recipes.filter((r) => recipeIds.includes(String(r.id)));

  return (
    <section className="stack stack--lg">
      {items.length === 0 ? (
        <EmptyState icon="list" title="Rien à acheter">
          Reviens aux étapes précédentes pour sélectionner des recettes ou
          produits.
        </EmptyState>
      ) : (
        <>
          {activeRecipes.length > 0 && (
            <Card>
              <div className="recap-tags-header">Recettes retenues</div>
              <div className="recap-tags">
                {activeRecipes.map((r) => (
                  <Badge key={r.id} variant="primary">
                    {r.name} · {selectedRecipes[r.id]} pers.
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          <div className="stack stack--lg">
            {groups.map(({ rayon, entries }) => (
              <section key={rayon} className="rayon-group">
                <header className="rayon-group__header">
                  <h3 className="rayon-group__title">{rayon}</h3>
                  <span className="rayon-group__count">
                    {entries.length} produit{entries.length > 1 ? 's' : ''}
                  </span>
                </header>
                <ul className="rayon-group__list">
                  {entries.map((item) => {
                    const extraSource = item.sources.find((s) => s.type === 'extra');
                    const extraEntry = extraSource
                      ? extras.find((e) => e.name === item.name)
                      : null;
                    const hasRecipeSource = item.sources.some(
                      (s) => s.type === 'recipe',
                    );
                    return (
                      <li key={item.key} className="recap-item">
                        <div className="recap-item__body">
                          <div className="recap-item__name">{item.name}</div>
                          <div className="recap-item__sources">
                            {item.sources.map((s, i) => {
                              const annotated =
                                s.type === 'quotidien' && hasRecipeSource;
                              return (
                                <span
                                  key={i}
                                  className={`source-pill source-pill--${s.type}`}
                                >
                                  <Icon name={SOURCE_ICONS[s.type] || 'list'} size={10} />
                                  {s.label}
                                  {s.qty
                                    ? ` (${formatQty(s.qty, item.unit)}${annotated ? ' additionnel' : ''})`
                                    : ''}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <div className="recap-item__actions">
                          <div className="recap-item__qty">
                            {formatQty(item.totalQuantity, item.unit)}
                          </div>
                          {extraEntry && (
                            <button
                              type="button"
                              className="recap-item__remove"
                              onClick={() => removeExtra(extraEntry.id)}
                              aria-label={`Retirer ${item.name}`}
                            >
                              <Icon name="trash" size={14} />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          <div className="wizard-summary">
            <span className="wizard-summary__icon">
              <Icon name="package" strokeWidth={2} />
            </span>
            <span>
              Total : <strong>{items.length}</strong> produits uniques · {groups.length} rayon
              {groups.length > 1 ? 's' : ''}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
