import { useEffect } from 'react';
import { useDrivesStore } from '../../stores/drivesStore.js';
import { useWizardStore } from '../../stores/wizardStore.js';
import { Card } from '../ui/Card.jsx';
import { EmptyState } from '../ui/EmptyState.jsx';
import { Icon } from '../ui/Icon.jsx';

const DRIVE_META = {
  carrefour: { label: 'Carrefour Drive' },
  leclerc: { label: 'E.Leclerc Drive' },
};

export function LaunchGeneration() {
  const configs = useDrivesStore((s) => s.configs);
  const load = useDrivesStore((s) => s.load);
  const selectedDrives = useWizardStore((s) => s.selectedDrives);
  const toggleDrive = useWizardStore((s) => s.toggleDrive);

  useEffect(() => {
    load();
  }, [load]);

  const available = configs
    .filter((c) => c.enabled)
    .map((c) => c.name)
    .filter((name) => DRIVE_META[name]);

  return (
    <section className="stack stack--lg">
      {available.length === 0 ? (
        <EmptyState icon="car" title="Aucun drive configuré">
          Ajoute tes identifiants Carrefour ou Leclerc dans l'onglet Drives.
        </EmptyState>
      ) : (
        <div className="drive-grid">
          {available.map((name) => {
            const selected = selectedDrives.includes(name);
            const meta = DRIVE_META[name];
            return (
              <button
                key={name}
                type="button"
                className={`drive-pick ${selected ? 'drive-pick--on' : ''}`}
                onClick={() => toggleDrive(name)}
                aria-pressed={selected}
              >
                <div className="drive-pick__badge" aria-hidden="true">
                  <Icon name={selected ? 'check' : 'plus'} size={14} strokeWidth={2.5} />
                </div>
                <div className="drive-pick__logo">
                  <Icon name="car" size={20} />
                </div>
                <div className="drive-pick__label">{meta.label}</div>
                <div className="drive-pick__hint">
                  {selected ? 'Panier à générer' : 'Touche pour inclure'}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Card size="lg" className="info-card">
        <h3 className="info-card__title">
          <Icon name="info" />
          Ce qui va se passer
        </h3>
        <ol className="info-card__steps">
          <li><span className="info-card__step-num">1</span>On se connecte à chaque drive sélectionné.</li>
          <li><span className="info-card__step-num">2</span>On ajoute les produits au panier, en mutualisant les quantités.</li>
          <li><span className="info-card__step-num">3</span>Tu reçois un récap avec prix, disponibilités et manquants.</li>
          <li><span className="info-card__step-num">4</span>Tu valides le paiement directement sur le site du drive.</li>
        </ol>
        <p className="info-card__warning">
          <Icon name="alert" />
          <span>
            Une étape peut nécessiter une intervention (captcha, validation). Tu seras
            prévenu·e en temps réel.
          </span>
        </p>
      </Card>
    </section>
  );
}
