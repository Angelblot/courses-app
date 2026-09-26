import { useEffect, useRef, useState } from 'react';
import { useRecipeImport } from '../../hooks/useRecipeImport.js';
import { Button } from '../ui/Button.jsx';

const OPTIONS = [
  {
    key: 'photo',
    icon: 'hgi-camera-01',
    label: 'Photo de la fiche',
    hint: 'HelloFresh, livre, carnet…',
  },
  {
    key: 'url',
    icon: 'hgi-link-01',
    label: 'Lien d’un site',
    hint: 'Marmiton, Jow, 750g, blog…',
  },
  {
    key: 'manual',
    icon: 'hgi-pencil-edit-01',
    label: 'Saisir à la main',
    hint: 'Formulaire classique',
  },
];

const LOADING_COPY = {
  photo: ['Lecture de la fiche…', 'On repère les ingrédients et les quantités.'],
  url: ['Lecture de la recette…', 'On récupère les ingrédients depuis la page.'],
};

/**
 * Bottom-sheet d'ajout de recette : photo, lien ou saisie manuelle.
 * Appelle `onDraft(draft)` avec un brouillon à valider dans le formulaire.
 */
export function RecipeImportSheet({ open, onClose, onDraft, onManual }) {
  const { status, source, error, importUrl, importPhoto, reset } = useRecipeImport();
  const [view, setView] = useState('menu'); // menu | url
  const [url, setUrl] = useState('');
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const fileInput = useRef(null);
  const urlInput = useRef(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const timer = setTimeout(() => {
      setMounted(false);
      setView('menu');
      setUrl('');
      reset();
    }, 260);
    return () => clearTimeout(timer);
  }, [open, reset]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (view === 'url' && visible) urlInput.current?.focus();
  }, [view, visible]);

  if (!mounted) return null;

  function handleOption(key) {
    if (key === 'photo') fileInput.current?.click();
    else if (key === 'url') setView('url');
    else onManual();
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const draft = await importPhoto(file);
    if (draft) onDraft(draft);
  }

  async function handleUrlSubmit(e) {
    e.preventDefault();
    if (!url.trim()) return;
    const draft = await importUrl(url);
    if (draft) onDraft(draft);
  }

  function handleRetry() {
    const from = source;
    reset();
    if (from === 'photo') fileInput.current?.click();
    else setView('url');
  }

  const loading = status === 'loading';
  const [loadingTitle, loadingHint] = LOADING_COPY[source] || LOADING_COPY.url;

  return (
    <div
      className={`more-sheet ${visible ? 'more-sheet--visible' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Ajouter une recette"
    >
      <button
        type="button"
        className="more-sheet__backdrop"
        aria-label="Fermer"
        onClick={loading ? undefined : onClose}
      />
      <div className="more-sheet__panel import-sheet">
        <div className="more-sheet__handle" aria-hidden="true" />

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={handleFile}
        />

        {loading && (
          <div className="import-sheet__state" role="status" aria-live="polite">
            <span className="import-sheet__spinner" aria-hidden="true" />
            <div className="import-sheet__state-title">{loadingTitle}</div>
            <div className="import-sheet__state-hint">{loadingHint} Quelques secondes.</div>
          </div>
        )}

        {status === 'error' && (
          <div className="import-sheet__state" role="alert">
            <span className="import-sheet__state-icon import-sheet__state-icon--error" aria-hidden="true">
              <i className="hgi-stroke hgi-alert-circle" />
            </span>
            <div className="import-sheet__state-title">Import impossible</div>
            <div className="import-sheet__state-hint">{error}</div>
            <div className="import-sheet__actions">
              <Button variant="secondary" onClick={onManual}>Saisir à la main</Button>
              <Button onClick={handleRetry}>Réessayer</Button>
            </div>
          </div>
        )}

        {status === 'idle' && view === 'menu' && (
          <>
            <div className="import-sheet__title">Ajouter une recette</div>
            <ul className="more-sheet__list">
              {OPTIONS.map((opt) => (
                <li key={opt.key}>
                  <button
                    type="button"
                    className="more-sheet__item"
                    onClick={() => handleOption(opt.key)}
                  >
                    <span className="more-sheet__item-icon" aria-hidden="true">
                      <i className={`hgi-stroke ${opt.icon}`} />
                    </span>
                    <span className="more-sheet__item-label">
                      {opt.label}
                      <span className="import-sheet__item-hint">{opt.hint}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {status === 'idle' && view === 'url' && (
          <form className="import-sheet__form" onSubmit={handleUrlSubmit}>
            <div className="import-sheet__head">
              <button
                type="button"
                className="import-sheet__back"
                aria-label="Retour"
                onClick={() => setView('menu')}
              >
                <i className="hgi-stroke hgi-arrow-left-01" aria-hidden="true" />
              </button>
              <div className="import-sheet__title">Coller un lien</div>
            </div>
            <input
              ref={urlInput}
              className="input"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://www.marmiton.org/recettes/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-label="Lien de la recette"
            />
            <Button type="submit" full disabled={!url.trim()}>
              Importer la recette
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
