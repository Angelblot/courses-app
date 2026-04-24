import { Icon } from './Icon.jsx';

export function Counter({ value, onChange, min = 1, max = 99, step = 1, unit, ariaLabel = 'Quantité' }) {
  const dec = () => onChange(Math.max(min, +(value - step).toFixed(2)));
  const inc = () => onChange(Math.min(max, +(value + step).toFixed(2)));
  return (
    <div className="counter" role="group" aria-label={ariaLabel} data-no-drag>
      <button
        type="button"
        className="counter__btn"
        onClick={dec}
        disabled={value <= min}
        aria-label="Réduire"
      >
        <Icon name="minus" size={16} strokeWidth={2.5} />
      </button>
      <span className="counter__value">{value}</span>
      {unit && <span className="counter__unit">{unit}</span>}
      <button
        type="button"
        className="counter__btn"
        onClick={inc}
        disabled={value >= max}
        aria-label="Augmenter"
      >
        <Icon name="plus" size={16} strokeWidth={2.5} />
      </button>
    </div>
  );
}
