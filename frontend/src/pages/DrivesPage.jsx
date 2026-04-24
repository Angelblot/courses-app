import { useEffect, useState } from 'react';
import { useDrivesStore } from '../stores/drivesStore.js';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { DriveForm } from '../components/drives/DriveForm.jsx';
import { DriveCard } from '../components/drives/DriveCard.jsx';

const LockIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
const WarnIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 4 3 20h18z" />
    <path d="M12 10v5M12 18h0" />
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12l5 5 9-11" />
  </svg>
);
const CrossIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const GRID_STYLE = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
};

const INLINE_ROW = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
};

export function DrivesPage() {
  const configs = useDrivesStore((s) => s.configs);
  const testResult = useDrivesStore((s) => s.testResult);
  const load = useDrivesStore((s) => s.load);
  const create = useDrivesStore((s) => s.create);
  const testConnection = useDrivesStore((s) => s.testConnection);

  const [showForm, setShowForm] = useState(false);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="stack stack--lg">
      <header className="page-header">
        <h2 className="page-header__title">Drives</h2>
        <p className="page-header__subtitle">
          Tes comptes Carrefour et Leclerc. Les identifiants sont chiffrés côté serveur.
        </p>
      </header>

      <div className="section-header">
        <span className="section-header__count">
          {configs.length} compte{configs.length > 1 ? 's' : ''} configuré{configs.length > 1 ? 's' : ''}
        </span>
        <Button
          variant={showForm ? 'secondary' : 'primary'}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? 'Annuler' : 'Ajouter'}
        </Button>
      </div>

      {showForm && <DriveForm onSubmit={create} onCancel={() => setShowForm(false)} />}

      {testResult && (
        <div
          className={`alert alert--${
            testResult.loading ? 'info' : testResult.success ? 'success' : 'danger'
          }`}
        >
          <strong style={INLINE_ROW}>
            {testResult.loading
              ? 'Test en cours…'
              : (
                <>
                  {testResult.success ? <CheckIcon /> : <CrossIcon />}
                  {testResult.name}
                </>
              )}
          </strong>
          {testResult.message && <div style={{ marginTop: 4 }}>{testResult.message}</div>}
        </div>
      )}

      {configs.length === 0 ? (
        <EmptyState title="Aucun drive configuré">
          Ajoute Carrefour ou Leclerc pour pouvoir lancer le wizard.
        </EmptyState>
      ) : (
        <div style={GRID_STYLE}>
          {configs.map((c) => (
            <DriveCard key={c.id} config={c} onTest={testConnection} />
          ))}
        </div>
      )}

      <Card size="lg" className="info-card">
        <h3 className="info-card__title" style={INLINE_ROW}>
          <LockIcon /> Comment ça marche&nbsp;?
        </h3>
        <ul className="info-card__bullets">
          <li>Configure tes identifiants Carrefour / Leclerc</li>
          <li>Ils sont chiffrés côté serveur (l'app est partagée avec ta famille)</li>
          <li>Le wizard génère les paniers en parallèle sur les deux drives</li>
          <li>Tu compares prix et disponibilités, puis tu valides côté drive</li>
        </ul>
        <p className="info-card__warning" style={INLINE_ROW}>
          <WarnIcon /> L'automatisation peut être interrompue par des captcha ou des changements de site.
        </p>
      </Card>
    </section>
  );
}
