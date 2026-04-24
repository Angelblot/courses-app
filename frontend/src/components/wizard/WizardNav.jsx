import { Button } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';

export function WizardNav({
  onBack,
  onNext,
  nextLabel = 'Continuer',
  nextDisabled = false,
  backLabel = 'Retour',
  hideBack = false,
  hideNext = false,
}) {
  return (
    <div className="wizard-nav">
      {!hideBack && (
        <Button variant="secondary" onClick={onBack} className="wizard-nav__back">
          <Icon name="arrowLeft" size={16} />
          {backLabel}
        </Button>
      )}
      {!hideNext && (
        <Button onClick={onNext} disabled={nextDisabled} className="wizard-nav__next">
          {nextLabel}
          <Icon name="arrowRight" size={16} />
        </Button>
      )}
    </div>
  );
}
