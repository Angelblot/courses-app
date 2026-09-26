import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useResultsStore } from '../stores/resultsStore.js';
import { Card } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Icon } from '../components/ui/Icon.jsx';

const LABELS = { carrefour: 'Carrefour Drive', leclerc: 'E.Leclerc Drive' };
const STATUS = {
  pending: ['Demande enregistrée', 'La préparation n’a pas encore démarré.'],
  generating: ['Préparation demandée', 'Le serveur n’a pas encore confirmé le remplissage des paniers. Reviens consulter le suivi.'],
  completed: ['Préparation terminée', 'Vérifie les articles disponibles et les éventuels manquants.'],
  done: ['Préparation terminée', 'Vérifie les articles disponibles et les éventuels manquants.'],
  partial: ['Préparation partielle', 'Certains articles demandent encore ton attention.'],
  failed: ['La préparation a échoué', 'Ta liste reste disponible. Vérifie tes drives avant une nouvelle demande.'],
  error: ['La préparation a échoué', 'Ta liste reste disponible. Vérifie tes drives avant une nouvelle demande.'],
  intervention_required: ['Une intervention est nécessaire', 'Consulte ton drive pour poursuivre la préparation.'],
};
const money = (amount) => typeof amount === 'number' && Number.isFinite(amount) ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount) : 'Prix indisponible';
function safeUrl(url) {
  try { const parsed = new URL(url); return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : null; } catch { return null; }
}
export function ResultsPage() {
  const { sessionId } = useParams();
  const { loading, results, error, load } = useResultsStore();
  useEffect(() => { load(sessionId); }, [sessionId, load]);
  const status = results?.status;
  const [title, description] = STATUS[status] || ['Suivi de mes paniers', 'L’état de préparation reste à confirmer.'];
  const finalized = ['completed', 'done', 'partial'].includes(status);
  const drives = Object.entries(results?.drives || {}).map(([name, drive]) => ({ ...drive, name }));
  return <section className="stack stack--lg">
    <Link to="/" className="back-link"><Icon name="arrowLeft" size={18} /> Mes courses</Link>
    <header><p className="eyebrow">Mes paniers</p><h1 className="flow-title">{title}</h1><p className="text-muted">{description}</p></header>
    {loading && <p role="status">Actualisation du suivi…</p>}
    {error && <div role="alert" className="notice notice--error">{error}</div>}
    <Button variant="secondary" onClick={() => load(sessionId)} disabled={loading}>{loading ? 'Actualisation…' : 'Actualiser le suivi'}</Button>
    {results && !finalized && <div className="notice"><Icon name="info" size={20} /> Les prix et disponibilités seront affichés lorsqu’ils auront été confirmés.</div>}
    {finalized && drives.length === 0 && <p className="notice">Aucun détail de panier n’a été renvoyé. Actualise le suivi ou consulte tes listes.</p>}
    <div className="results-grid">{drives.map((drive) => <Card key={drive.name} className="stack">
      <div className="row"><h2 className="rayon-title">{LABELS[drive.name] || drive.name}</h2>{finalized && <strong>{money(drive.total)}</strong>}</div>
      <p className="text-muted">{finalized ? `${drive.items?.length || 0} articles trouvés sur ${(drive.items?.length || 0) + (drive.missing?.length || 0)} · ${drive.missing?.length || 0} manquants` : 'Confirmation du panier en attente'}</p>
      {finalized && drive.missing?.length > 0 && <section className="notice notice--warning"><h3>À vérifier en priorité</h3><ul>{drive.missing.map((item, i) => <li className="extra-row" key={i}><span>{item.name}<small>{item.quantity} {item.unit}</small></span>{safeUrl(item.search_url) && <a className="btn btn--secondary" href={safeUrl(item.search_url)} target="_blank" rel="noreferrer">Chercher</a>}</li>)}</ul></section>}
      {finalized && safeUrl(drive.cart_url) && <a className="btn" href={safeUrl(drive.cart_url)} target="_blank" rel="noreferrer">Ouvrir mon panier</a>}
      {finalized && drive.items?.length > 0 && <details><summary>Voir les {drive.items.length} articles trouvés</summary><ul>{drive.items.map((item, i) => <li className="extra-row" key={i}><span>{item.name}<small>{item.quantity} {item.unit}</small></span><strong>{money(item.price)}</strong></li>)}</ul></details>}
    </Card>)}</div>
    {finalized && drives.length > 1 && <p className="text-muted">Les totaux peuvent couvrir des articles différents. Vérifie les manquants avant de comparer les prix.</p>}
    <Link to="/lists" className="btn">Retrouver mes listes</Link>
  </section>;
}
