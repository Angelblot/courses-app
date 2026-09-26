import { Link } from 'react-router-dom';
import { RecipePicker } from '../components/wizard/RecipePicker.jsx';
import { useWizardStore } from '../stores/wizardStore.js';
export function MealsPage() {
  const count = Object.keys(useWizardStore((s)=>s.selectedRecipes)).length;
  return <section className="reserve-meals"><header className="section-heading"><h1>Mes recettes</h1><Link to="/recipes">Gérer mes recettes</Link></header><p className="text-muted">Choisis tes repas pour ajouter leurs ingrédients à ta liste.</p><RecipePicker/><Link className="btn reserve-meals-cta" to="/current-list">Voir ma liste{count>0?` · ${count} repas`:''}</Link></section>;
}
