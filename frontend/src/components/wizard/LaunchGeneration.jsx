import { Link } from 'react-router-dom';
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
  const loaded = useDrivesStore((s) => s.loaded);
  const loading = useDrivesStore((s) => s.loading);
  const error = useDrivesStore((s) => s.error);
  const load = useDrivesStore((s) => s.load);
  const selectedDrives = useWizardStore((s) => s.selectedDrives);
  const setDrives = useWizardStore((s) => s.setDrives);
  const toggleDrive = useWizardStore((s) => s.toggleDrive);

  useEffect(() => {
    load();
  }, [load]);

  const available = configs
    .filter((c) => c.enabled)
    .map((c) => c.name)
    .filter((name) => DRIVE_META[name]);

  useEffect(() => {
    if (!loaded || loading || error) return;
    const valid = selectedDrives.filter((name) => available.includes(name));
    if (valid.length !== selectedDrives.length) setDrives(valid);
  }, [configs, loaded, loading, error, selectedDrives, setDrives]);

  return (
    <section className="stack stack--lg">
      {loading && <p role="status">Chargement des drives…</p>}
      {error && <div className="notice notice--error" role="alert">{error} <button className="text-action" onClick={load}>Réessayer</button></div>}
      {!loading && !error && available.length === 0 ? (
        <EmptyState icon="car" title="Aucun drive configuré">
          <Link to="/drives" className="btn btn--secondary">Configurer un drive</Link>
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
                  {selected ? 'Drive sélectionné' : 'Touche pour inclure'}
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
          <li><span className="info-card__step-num">1</span>Ta liste est envoyée avec les drives sélectionnés.</li>
          <li><span className="info-card__step-num">2</span>Tu peux consulter l’état réel de la préparation.</li>
          <li><span className="info-card__step-num">3</span>Les prix et disponibilités apparaissent après confirmation du serveur.</li>
          <li><span className="info-card__step-num">4</span>Tu valides le paiement directement sur le site du drive.</li>
        </ol>
        <p className="info-card__warning">
          <Icon name="alert" />
          <span>
            Une étape peut nécessiter une intervention (captcha, validation). Consulte le suivi pour connaître l’état de ta demande.
          </span>
        </p>
      </Card>
    </section>
  );
}
