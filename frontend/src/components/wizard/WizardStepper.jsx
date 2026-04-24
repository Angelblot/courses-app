import { WIZARD_STEPS } from '../../stores/wizardStore.js';

export function WizardStepper({ currentStep }) {
  const currentIndex = WIZARD_STEPS.findIndex((s) => s.key === currentStep);
  const total = WIZARD_STEPS.length;
  const progress = total > 1 ? (currentIndex / (total - 1)) * 100 : 0;

  return (
    <div className="stepper" role="group" aria-label="Étapes du wizard">
      <div className="stepper__rail" aria-hidden="true">
        <div className="stepper__rail-fill" style={{ width: `${progress}%` }} />
      </div>
      <ol className="stepper__dots">
        {WIZARD_STEPS.map((step, i) => {
          const state = i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'todo';
          return (
            <li
              key={step.key}
              className={`stepper__dot stepper__dot--${state}`}
              aria-current={state === 'active' ? 'step' : undefined}
            >
              <span className="stepper__dot-mark" />
              <span className="stepper__dot-label">{step.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
