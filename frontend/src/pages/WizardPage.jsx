import { useEffect, useRef } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useWizardStore, WIZARD_STEPS, canonicalStep, buildConsolidatedItems } from '../stores/wizardStore.js';
import { RecipePicker } from '../components/wizard/RecipePicker.jsx';
import { DailyChecklist } from '../components/wizard/DailyChecklist.jsx';
import { RecipeProductMatching } from '../components/wizard/RecipeProductMatching.jsx';
import { RecapList } from '../components/wizard/RecapList.jsx';
import { LaunchGeneration } from '../components/wizard/LaunchGeneration.jsx';
import { useDrivesStore } from '../stores/drivesStore.js';
import { useRecipesStore } from '../stores/recipesStore.js';
import { useProductsStore } from '../stores/productsStore.js';
import { Button } from '../components/ui/Button.jsx';
import { Icon } from '../components/ui/Icon.jsx';

const TITLES = { recipes: 'Qu’est-ce qu’on mange ?', checklist: 'Complète ta liste', recap: 'Ta liste et tes drives' };

export function WizardPage() {
  const { step: routeStep } = useParams();
  const step = canonicalStep(routeStep);
  const navigate = useNavigate();
  const heading = useRef(null);
  const state = useWizardStore();
  const {configs, error:driveError, loading:drivesLoading} = useDrivesStore();
  const recipeStore = useRecipesStore();
  const productStore = useProductsStore();
  useEffect(() => {recipeStore.load(); productStore.load();}, [recipeStore.load, productStore.load]);
  const items = buildConsolidatedItems({...state, recipes:recipeStore.items, products:productStore.items});
  const dataReady = recipeStore.loaded && productStore.loaded && !recipeStore.error && !productStore.error;
  const staleRecipes = Object.keys(state.selectedRecipes).some((id) => !recipeStore.items.some((r) => String(r.id) === id));
  const idx = WIZARD_STEPS.findIndex((s) => s.key === step);
  const recipeCount = Object.keys(state.selectedRecipes).length;
  const itemCount = Object.values(state.quotidien).filter((v) => v === 'needed').length + state.extras.length;
  const hasSelection = items.length > 0;
  const validDrives = state.selectedDrives.filter((name) => configs.some((c) => c.enabled && c.name === name && ['carrefour', 'leclerc'].includes(name)));

  useEffect(() => {
    if (routeStep !== step) { navigate(`/wizard/${step}`, {replace:true}); return; }
    if (idx < 0) { navigate('/wizard/recipes', { replace: true }); return; }
    state.setLastStep(step);
    heading.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [routeStep, step, idx, navigate, state.setLastStep]);

  if (idx < 0) return null;
  if (step === 'checklist') return <Navigate to="/current-list" replace />;
  const isLast = step === 'recap';
  const disabled = state.generating || (isLast && (!hasSelection || !dataReady || staleRecipes || !!driveError || drivesLoading || validDrives.length === 0));
  const canSkip = (step === 'recipes' && recipeCount === 0) || (step === 'checklist' && !hasSelection);
  const label = state.generating ? 'Envoi en cours…' : isLast ? 'Créer mes paniers' : canSkip ? 'Passer cette étape' : step === 'checklist' ? 'Vérifier ma liste' : 'Compléter ma liste';

  async function next() {
    if (disabled) return;
    if (isLast) {
      state.setDrives(validDrives);
      const id = await state.launch();
      if (id != null) navigate(`/results/${id}`);
    } else {
      const nextStep = WIZARD_STEPS[idx + 1].key;
      navigate(`/wizard/${nextStep}`);
    }
  }

  function back() {
    const previous = WIZARD_STEPS[idx - 1]?.key;
    navigate(previous === 'checklist' ? '/current-list' : previous ? `/wizard/${previous}` : '/');
  }

  return (
    <div className="wizard">
      <header className="wizard__top">
        <div className="row">
          <Link to="/" className="text-muted">Courses</Link>
          <span className="draft-note"><Icon name="check" size={14} /> Brouillon conservé sur cet appareil</span>
          <button className="wizard__exit" onClick={() => navigate('/')} aria-label="Enregistrer et quitter"><Icon name="x" size={20} /></button>
        </div>
        <div className="wizard__progress" role="progressbar" aria-valuenow={idx + 1} aria-valuemin={1} aria-valuemax={WIZARD_STEPS.length} aria-label={`Étape ${idx + 1} : ${WIZARD_STEPS[idx].label}`}>
          {WIZARD_STEPS.map((s, i) => <div key={s.key} className={`wizard__progress-seg ${i <= idx ? 'is-active' : ''}`} />)}
        </div>
        <p className="step-label">Étape {idx + 1} sur {WIZARD_STEPS.length} · {WIZARD_STEPS[idx].label}</p>
        <h1 ref={heading} tabIndex={-1} className="flow-title">{TITLES[step]}</h1>
      </header>
      {(recipeStore.error || productStore.error) && <div className="notice notice--error" role="alert">Impossible de charger ta liste. <button className="text-action" onClick={() => {recipeStore.load();productStore.load();}}>Réessayer le chargement</button></div>}
      {step === 'recipes' && <p className="text-muted">Choisis tes repas, la liste suit.</p>}
      <div key={step} className="wizard__content wizard__content--enter">
        {step === 'recipes' && <RecipePicker />}
        {step === 'checklist' && <div className="tablee-list-layout"><RecipeProductMatching /><DailyChecklist /></div>}
        {isLast && <div className="tablee-review-layout"><div><div className="section-heading"><h2>Ta liste de courses</h2><Link className="text-action" to="/wizard/checklist">Modifier</Link></div><RecapList /></div><aside className="tablee-drive-panel"><h2>Où faire tes courses ?</h2><p className="text-muted">Choisis un ou plusieurs drives.</p><LaunchGeneration /></aside></div>}
      </div>
      <footer className="flow-footer">
        <div className="flow-footer__inner">
          <div className="flow-footer__summary" aria-live="polite">
            {recipeCount} repas · {items.length} article{items.length !== 1 ? 's' : ''} à acheter
            {!hasSelection && isLast && <span>Ajoute une recette ou un produit pour continuer.</span>}
            {isLast && !dataReady && <span>La liste doit être chargée avant de créer les paniers.</span>}
            {isLast && staleRecipes && <span>Une recette n’est plus disponible. Retire-la de tes repas.</span>}
            {isLast && validDrives.length === 0 && <span>Sélectionne un drive disponible.</span>}
          </div>
          {isLast && state.launchError && <div className="notice notice--error" role="alert">{state.launchError} {state.sessionId && <Link to={`/results/${state.sessionId}`}>Vérifier le suivi</Link>}</div>}
          <div className="flow-footer__buttons">
            <Button variant="secondary" onClick={back} disabled={state.generating}>Retour</Button>
            <Button onClick={next} disabled={disabled}>{label}<Icon name="arrowRight" size={18} /></Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
