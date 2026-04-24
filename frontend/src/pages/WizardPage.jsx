import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWizardStore, WIZARD_STEPS } from '../stores/wizardStore.js';
import { WizardStepper } from '../components/wizard/WizardStepper.jsx';
import { WizardNav } from '../components/wizard/WizardNav.jsx';
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
  const isFirst = idx === 0;

  function handleBack() {
    if (isFirst) {
      navigate('/');
      return;
    }
    navigate(`/wizard/${WIZARD_STEPS[idx - 1].key}`);
  }

  async function handleNext() {
    if (isLast) {
      const sessionId = await launch();
      if (sessionId) navigate(`/results/${sessionId}`);
      return;
    }
    navigate(`/wizard/${WIZARD_STEPS[idx + 1].key}`);
  }

  let nextDisabled = false;
  let nextLabel = 'Continuer';
  if (current.key === 'recipes' && Object.keys(selectedRecipes).length === 0) {
    nextDisabled = true;
  }
  if (current.key === 'generate') {
    nextLabel = generating ? 'Génération…' : 'Générer les paniers';
    nextDisabled = generating || selectedDrives.length === 0;
  }

  return (
    <div className="wizard">
      <div className="wizard__top">
        <div className="wizard__exit-row">
          <button
            type="button"
            className="wizard__exit"
            onClick={() => navigate('/')}
            aria-label="Quitter le wizard"
          >
            <Icon name="x" size={18} strokeWidth={2} />
          </button>
          <WizardStepper currentStep={current.key} />
        </div>
      </div>

      <div key={current.key} className="wizard__content wizard__content--enter">
        <div className="container">
          <StepComponent />
        </div>
      </div>

      <div className="wizard__footer">
        <div className="container">
          <WizardNav
            onBack={handleBack}
            onNext={handleNext}
            nextLabel={nextLabel}
            nextDisabled={nextDisabled}
            backLabel={isFirst ? 'Accueil' : 'Retour'}
          />
        </div>
      </div>
    </div>
  );
}
