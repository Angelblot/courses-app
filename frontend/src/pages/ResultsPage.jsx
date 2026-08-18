import { useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useResultsStore } from '../stores/resultsStore.js';
import { Card } from '../components/ui/Card.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { Icon } from '../components/ui/Icon.jsx';

const DRIVE_LABEL = {
  carrefour: 'Carrefour Drive',
  leclerc: 'E.Leclerc Drive',
};

export function ResultsPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const loading = useResultsStore((s) => s.loading);
  const error = useResultsStore((s) => s.error);
  const results = useResultsStore((s) => s.results);
  const load = useResultsStore((s) => s.load);
  const retry = useResultsStore((s) => s.retry);

  useEffect(() => {
    if (sessionId) load(sessionId);
  }, [sessionId, load]);

  const drives = useMemo(() => {
    if (!results?.drives) return [];
    return Object.values(results.drives);
  }, [results]);

  // Un panier n'est exploitable que si le drive a réellement remonté des lignes.
  // Tant que ce n'est pas le cas, afficher un total à 0 € laisserait croire à
  // une génération réussie et gratuite.
  const hasPricedItems = drives.some((d) => (d.items?.length || 0) > 0);

  const cheapest = useMemo(() => {
    if (!hasPricedItems) return null;
    return drives.reduce((best, d) => (best == null || d.total < best.total ? d : best), null);
  }, [drives, hasPricedItems]);

  const pendingMissing = useMemo(() => {
    if (hasPricedItems) return [];
    const seen = new Set();
    return drives
      .flatMap((d) => d.missing || [])
      .filter((m) => {
        const key = `${m.name}|${m.unit}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [drives, hasPricedItems]);

  return (
    <div className="results">
      <header className="results__header">
        <button
          type="button"
          className="wizard__exit"
          onClick={() => navigate('/')}
          aria-label="Retour accueil"
        >
          <Icon name="arrowLeft" size={20} />
        </button>
        <div>
          <div className="step-header__eyebrow">Phase de courses terminée</div>
          <h1 className="results__title">Résultats</h1>
        </div>
      </header>

      <div className="container">
        {loading && !results && (
          <EmptyState icon="clock" title="Chargement des résultats…">
            On récupère l'état de la génération.
          </EmptyState>
        )}

        {!loading && error && (
          <Card className="results__error">
            <EmptyState icon="alert" title="Résultats indisponibles">
              Impossible de joindre le serveur. Aucun panier n'a pu être récupéré
              pour cette session.
            </EmptyState>
            <p className="results__error-detail">{error}</p>
            <button type="button" className="btn" onClick={retry}>
              Réessayer
            </button>
          </Card>
        )}

        {!loading && !error && results && drives.length === 0 && (
          <EmptyState icon="cart" title="Aucun drive sélectionné">
            Cette session n'a pas encore été envoyée à un drive.
          </EmptyState>
        )}

        {!error && drives.length > 0 && !hasPricedItems && (
          <div className="stack stack--lg">
            <Card className="results__pending">
              <EmptyState icon="clock" title="Paniers non générés">
                La connexion automatique aux drives n'est pas encore active :
                aucun prix ni disponibilité n'a été remonté. Ta liste est
                enregistrée, tu peux la retrouver dans Mes listes.
              </EmptyState>
            </Card>

            {pendingMissing.length > 0 && (
              <Card className="missing-card">
                <h3 className="missing-card__title">
                  <Icon name="alert" size={16} />
                  Sans produit associé
                </h3>
                <p className="missing-card__hint">
                  Ces lignes n'ont pas de produit du catalogue : elles seront à
                  ajouter à la main.
                </p>
                <ul className="missing-list">
                  {pendingMissing.map((m, i) => (
                    <li key={i} className="missing-item">
                      <div>
                        <div className="result-item__name">{m.name}</div>
                        <div className="result-item__meta">
                          {m.quantity} {m.unit}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}

        {!error && hasPricedItems && (
          <div className="stack stack--lg">
            <div className="comparator">
              {drives.map((d) => {
                const isCheapest = cheapest && d.name === cheapest.name && drives.length > 1;
                return (
                  <Card
                    key={d.name}
                    className={`comparator__card ${isCheapest ? 'comparator__card--best' : ''}`}
                  >
                    <div className="comparator__head">
                      <div>
                        <div className="comparator__name">
                          {d.display_name || DRIVE_LABEL[d.name] || d.name}
                        </div>
                        {isCheapest && (
                          <Badge variant="success" className="comparator__badge">
                            💰 Moins cher
                          </Badge>
                        )}
                      </div>
                      <div className="comparator__total">
                        {d.total?.toFixed(2)} €
                      </div>
                    </div>
                    <div className="comparator__stats">
                      <div className="comparator__stat">
                        <strong>{d.items?.length || 0}</strong>
                        <span>trouvés</span>
                      </div>
                      {d.missing?.length > 0 && (
                        <div className="comparator__stat comparator__stat--warning">
                          <strong>{d.missing.length}</strong>
                          <span>manquants</span>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>

            {drives.map((d) => (
              <section key={d.name} className="stack">
                <h2 className="results__section-title">
                  🛒 {d.display_name || DRIVE_LABEL[d.name] || d.name}
                </h2>

                <Card>
                  <ul className="result-items">
                    {(d.items || []).map((item, i) => (
                      <li key={i} className="result-item">
                        <div className="result-item__body">
                          <div className="result-item__name">{item.name}</div>
                          <div className="result-item__meta">
                            {item.quantity} {item.unit}
                            {item.unit_price != null &&
                              ` · ${item.unit_price.toFixed(2)} €/u`}
                          </div>
                        </div>
                        <div className="result-item__price">
                          {item.price?.toFixed(2)} €
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>

                {d.missing?.length > 0 && (
                  <Card className="missing-card">
                    <h3 className="missing-card__title">
                      <span aria-hidden="true">⚠️</span> Produits non trouvés
                    </h3>
                    <ul className="missing-list">
                      {d.missing.map((m, i) => (
                        <li key={i} className="missing-item">
                          <div>
                            <div className="result-item__name">{m.name}</div>
                            <div className="result-item__meta">
                              {m.quantity} {m.unit}
                            </div>
                          </div>
                          {m.search_url && (
                            <a
                              href={m.search_url}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn--secondary btn--sm"
                            >
                              🔎 Chercher
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </section>
            ))}
          </div>
        )}

        <div className="results__actions">
          <Link to="/" className="btn btn--secondary">
            🏠 Accueil
          </Link>
          <Link to="/lists" className="btn">
            📋 Mes listes
          </Link>
        </div>
      </div>
    </div>
  );
}
