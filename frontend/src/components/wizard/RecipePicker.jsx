import { useEffect, useMemo, useState } from 'react';
import { useRecipesStore } from '../../stores/recipesStore.js';
import { useWizardStore } from '../../stores/wizardStore.js';
import { EmptyState } from '../ui/EmptyState.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Counter } from '../ui/Counter.jsx';
import { Icon } from '../ui/Icon.jsx';
import { SwipeStack } from '../ui/SwipeStack.jsx';
import { AsyncImage } from '../ui/AsyncImage.jsx';

const HERO_VARIANTS = ['', 'recipe-sw__hero--coral', 'recipe-sw__hero--sage'];
const HERO_ICONS = ['bowl', 'chef', 'apple'];

function heroForRecipe(recipe) {
  const key = String(recipe.id ?? '')
    .split('')
    .reduce((a, c) => a + c.charCodeAt(0), 0);
  return {
    hero: HERO_VARIANTS[key % HERO_VARIANTS.length],
    icon: HERO_ICONS[key % HERO_ICONS.length],
  };
}

function RecipeSwipeCard({ recipe, servings, onServingsChange }) {
  const hero = heroForRecipe(recipe);
  const keyword = [recipe.name, recipe.category, 'food']
    .filter(Boolean)
    .join(' ');
  return (
    <div className="recipe-sw">
      <div className={`recipe-sw__hero ${hero.hero}`}>
        <AsyncImage
          keyword={keyword}
          alt={recipe.name}
          className="recipe-sw__image"
          fallbackIcon={hero.icon}
          fallbackIconSize={80}
        />
        <div className="recipe-sw__tag">
          <Badge variant="primary">{recipe.category || 'Plat'}</Badge>
        </div>
      </div>
      <div className="recipe-sw__body">
        <div>
          <h3 className="recipe-sw__title">{recipe.name}</h3>
          {recipe.description && <p className="recipe-sw__desc">{recipe.description}</p>}
        </div>
        <div className="recipe-sw__meta">
          <span className="recipe-sw__meta-item">
            <Icon name="clock" size={14} />
            {recipe.prep_time || '20 min'}
          </span>
          <span className="recipe-sw__meta-dot">·</span>
          <span className="recipe-sw__meta-item">
            <Icon name="fire" size={14} />
            {recipe.difficulty || 'Facile'}
          </span>
          <span className="recipe-sw__meta-dot">·</span>
          <span className="recipe-sw__meta-item">
            {recipe.ingredients?.length || 0} ingrédients
          </span>
        </div>
        <div className="recipe-sw__servings" data-no-drag>
          <span className="recipe-sw__servings-label">
            <Icon name="users" size={16} />
            Personnes
          </span>
          <Counter value={servings} onChange={onServingsChange} min={1} max={20} />
        </div>
      </div>
    </div>
  );
}

function ResumePanel({ recipes, selectedRecipes, onReset }) {
  const picked = recipes.filter((r) => selectedRecipes[r.id] != null);
  return (
    <div className="swipe-resume">
      <div className="swipe-resume__icon">
        <Icon name="check" size={28} strokeWidth={2.5} />
      </div>
      <div>
        <div className="swipe-resume__count">{picked.length}</div>
        <div className="swipe-resume__label">
          recette{picked.length > 1 ? 's' : ''} sélectionnée{picked.length > 1 ? 's' : ''}
        </div>
      </div>
      {picked.length > 0 && (
        <div className="swipe-resume__list">
          {picked.map((r) => (
            <div key={r.id} className="swipe-resume__row">
              <span className="swipe-resume__row-name">{r.name}</span>
              <span className="swipe-resume__row-meta">
                {selectedRecipes[r.id]} pers.
              </span>
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

export function RecipePicker() {
  const recipes = useRecipesStore((s) => s.items);
  const loaded = useRecipesStore((s) => s.loaded);
  const load = useRecipesStore((s) => s.load);

  const selectedRecipes = useWizardStore((s) => s.selectedRecipes);
  const toggleRecipe = useWizardStore((s) => s.toggleRecipe);
  const setServings = useWizardStore((s) => s.setServings);

  const [seenIds, setSeenIds] = useState(() => new Set());

  useEffect(() => {
    load();
  }, [load]);

  const queue = useMemo(
    () => recipes.filter((r) => !seenIds.has(r.id)),
    [recipes, seenIds],
  );

  const count = Object.keys(selectedRecipes).length;

  function handleAccept(recipe) {
    if (selectedRecipes[recipe.id] == null) toggleRecipe(recipe);
    setSeenIds((prev) => new Set(prev).add(recipe.id));
  }

  function handleReject(recipe) {
    if (selectedRecipes[recipe.id] != null) toggleRecipe(recipe);
    setSeenIds((prev) => new Set(prev).add(recipe.id));
  }

  function handleReset() {
    setSeenIds(new Set());
  }

  return (
    <section className="stack stack--lg">
      <header className="step-header">
        <div className="step-header__eyebrow">Étape 1 / 4</div>
        <h2 className="step-header__title">Choisis tes recettes</h2>
        <p className="step-header__subtitle">
          Swipe à droite pour garder, à gauche pour passer. Ajuste les personnes sur la carte.
        </p>
      </header>

      {loaded && recipes.length === 0 ? (
        <EmptyState icon="bowl" title="Aucune recette">
          Ajoute ta première recette dans l'onglet Recettes.
        </EmptyState>
      ) : (
        <SwipeStack
          items={queue}
          onAccept={handleAccept}
          onReject={handleReject}
          renderCard={(recipe) => (
            <RecipeSwipeCard
              recipe={recipe}
              servings={selectedRecipes[recipe.id] ?? recipe.servings_default ?? 2}
              onServingsChange={(n) => {
                if (selectedRecipes[recipe.id] == null) toggleRecipe(recipe);
                setServings(recipe.id, n);
              }}
            />
          )}
          emptyState={
            <ResumePanel
              recipes={recipes}
              selectedRecipes={selectedRecipes}
              onReset={handleReset}
            />
          }
        />
      )}

      {count > 0 && (
        <div className="wizard-summary">
          <span className="wizard-summary__icon">
            <Icon name="check" strokeWidth={2.5} />
          </span>
          <span>
            <strong>{count}</strong> recette{count > 1 ? 's' : ''} retenue
            {count > 1 ? 's' : ''}
          </span>
        </div>
      )}
    </section>
  );
}
