import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWizardStore, WIZARD_STEPS } from '../stores/wizardStore.js';
import { RecipePicker } from '../components/wizard/RecipePicker.jsx';
import { DailyChecklist } from '../components/wizard/DailyChecklist.jsx';
import { RecapList } from '../components/wizard/RecapList.jsx';
import { LaunchGeneration } from '../components/wizard/LaunchGeneration.jsx';
import { Icon } from '../components/ui/Icon.jsx';

const STEP_COMPONENTS = {
  recipes: RecipePicker,
  checklist: DailyChecklist,
  recap: RecapList,
  generate: LaunchGeneration,
};

const STEP_TITLES = {
  recipes: 'Choisis tes recettes',
  checklist: 'Ton quotidien',
  recap: 'Récap de ta liste',
  generate: 'Lance la génération',
};

export function WizardPage() {
  const { step } = useParams();
  const navigate = useNavigate();

  const selectedRecipes = useWizardStore((s) => s.selectedRecipes);
  const selectedDrives = useWizardStore((s) => s.selectedDrives);
  const generating = useWizardStore((s) => s.generating);
  const launch = useWizardStore((s) => s.launch);

  const idx = WIZARD_STEPS.findIndex((s) => s.key === step);
  useEffect(() => {
    if (idx < 0) navigate('/wizard/recipes', { replace: true });
  }, [idx, navigate]);

  if (idx < 0) return null;

  const current = WIZARD_STEPS[idx];
  const StepComponent = STEP_COMPONENTS[current.key];
  const isLast = idx === WIZARD_STEPS.length - 1;

  async function handleNext() {
    if (isLast) {
      const sessionId = await launch();
      if (sessionId) navigate(`/results/${sessionId}`);
      return;
    }
    navigate(`/wizard/${WIZARD_STEPS[idx + 1].key}`);
  }

  let fabLabel = 'Continuer';
  let showFab = true;
  let fabDisabled = false;
  if (current.key === 'recipes' && Object.keys(selectedRecipes).length === 0) {
    showFab = false;
  }
  if (current.key === 'generate') {
    fabLabel = generating ? 'Génération…' : 'Générer';
    if (!generating && selectedDrives.length === 0) showFab = false;
    fabDisabled = generating;
  }

  return (
    <div className="wizard">
      <div className="wizard__top">
        <div className="wizard__top-row">
          <div
            className="wizard__progress"
            role="progressbar"
            aria-valuenow={idx + 1}
            aria-valuemin={1}
            aria-valuemax={WIZARD_STEPS.length}
            aria-label={`Étape ${idx + 1} sur ${WIZARD_STEPS.length}`}
          >
            {WIZARD_STEPS.map((s, i) => (
              <div
                key={s.key}
                className={`wizard__progress-seg ${i <= idx ? 'is-active' : ''}`}
              />
            ))}
          </div>
          <button
            type="button"
            className="wizard__exit"
            onClick={() => navigate('/')}
            aria-label="Quitter le wizard"
          >
            <Icon name="x" size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="wizard__top-meta">
          <span className="wizard__step-count">
            Étape {idx + 1}/{WIZARD_STEPS.length}
          </span>
          <span className="wizard__step-title">{STEP_TITLES[current.key]}</span>
        </div>
      </div>

      <div key={current.key} className="wizard__content wizard__content--enter">
        <div className="container">
          <StepComponent />
        </div>
      </div>

      {showFab && (
        <button
          type="button"
          className="wizard__fab"
          onClick={handleNext}
          disabled={fabDisabled}
          aria-label={fabLabel}
        >
          <span className="wizard__fab-label">{fabLabel}</span>
          <Icon
            name={isLast ? 'check' : 'arrowRight'}
            size={20}
            strokeWidth={2.5}
          />
        </button>
      )}
    </div>
  );
}
