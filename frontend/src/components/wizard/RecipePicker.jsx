import { recipeImage, recipeImageFallback } from '../../lib/tableeImages.js';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRecipesStore } from '../../stores/recipesStore.js';
import { useWizardStore } from '../../stores/wizardStore.js';
import { EmptyState } from '../ui/EmptyState.jsx';
import { Counter } from '../ui/Counter.jsx';
import { Icon } from '../ui/Icon.jsx';
import { AsyncImage } from '../ui/AsyncImage.jsx';

const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');

export function RecipePicker() {
  const { items, loading, loaded, error, load } = useRecipesStore();
  const { selectedRecipes, toggleRecipe, setServings, favoriteRecipes, toggleFavoriteRecipe, defaultServings, setDefaultServings } = useWizardStore();
  const [query, setQuery] = useState('');
  const servings = defaultServings;
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  useEffect(() => { load(); }, [load]);
  const filtered = items.filter((r) => normalize(r.name).includes(normalize(query)) && (!favoritesOnly || favoriteRecipes.includes(r.id)));
  function changeServings(n) {
    setDefaultServings(n);
    Object.keys(selectedRecipes).forEach((id) => setServings(id, n));
  }
  return <section className="meal-picker">
    <div className="meal-servings"><Counter value={servings} unit="personnes" onChange={changeServings} min={1} max={20} ariaLabel="Personnes pour les recettes sélectionnées" /></div>
    {<input className="search-field" type="search" aria-label="Rechercher une recette" placeholder="Trouver un repas…" value={query} onChange={(e) => setQuery(e.target.value)} />}
    <div className="view-switch" role="group" aria-label="Recettes à afficher"><button aria-pressed={!favoritesOnly} onClick={() => setFavoritesOnly(false)}>Toutes</button><button aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(true)}>Mes favorites</button></div>
    {error && <div className="notice notice--error" role="alert">{error} <button className="text-action" onClick={load}>Réessayer</button></div>}
    {loading && !loaded && <div className="meal-loading" role="status">Chargement de tes recettes…</div>}
    {loaded && !error && Object.keys(selectedRecipes).filter((id) => !items.some((r) => String(r.id) === id)).map((id) => <div className="notice" key={id}>Une recette sélectionnée n’est plus disponible. <button className="text-action" onClick={() => toggleRecipe({id})}>Retirer cette recette</button></div>)}
    <div className="meal-list">{filtered.map((recipe, index) => {
      const selected = selectedRecipes[recipe.id] != null;
      return <article key={recipe.id} className={`meal ${index === 0 && recipeImage(recipe) ? 'meal--featured' : ''} ${selected ? 'is-selected' : ''}`}>
        <button className="meal__select" aria-pressed={selected} onClick={() => selected ? toggleRecipe(recipe) : setServings(recipe.id, servings)}>
          {recipeImage(recipe) && <AsyncImage src={recipeImage(recipe)} fallbackSrc={recipeImageFallback(recipe)} alt={recipe.name} fallbackIcon="bowl" className="meal__photo" />}
          <span className="meal__copy"><strong>{recipe.name}</strong><small>{recipe.category || 'Recette'} · {recipe.ingredients?.length || 0} ingrédient{recipe.ingredients?.length === 1 ? '' : 's'}{selected && selectedRecipes[recipe.id] !== servings ? ` · ${selectedRecipes[recipe.id]} personnes` : ''}</small></span>
          <span className="choice-check"><Icon name={selected ? 'check' : 'plus'} size={20} /></span>
        </button>
        <div className="meal-options"><button className="text-action meal-favorite" aria-pressed={favoriteRecipes.includes(recipe.id)} aria-label={`${favoriteRecipes.includes(recipe.id) ? 'Retirer des' : 'Ajouter aux'} favorites : ${recipe.name}`} onClick={() => toggleFavoriteRecipe(recipe.id)}><Icon name="heart" size={18} />{favoriteRecipes.includes(recipe.id) ? 'Favorite' : 'Favori'}</button>
        {selected && <Counter value={selectedRecipes[recipe.id]} onChange={(n) => setServings(recipe.id,n)} min={1} max={20} unit="pers." ariaLabel={`Personnes pour ${recipe.name}`} />}</div>
      </article>;
    })}</div>
    {loaded && !error && filtered.length === 0 && <EmptyState icon="book" title={items.length === 0 ? 'Pas encore de recette' : 'Aucune recette ici'}>Ajoute tes recettes préférées, ou prépare directement ta liste de courses.</EmptyState>}
    <Link className="meal-add" to="/recipes"><Icon name="plus" size={20} />Ajouter un autre repas</Link>
  </section>;
}
