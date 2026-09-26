import { useCallback, useRef, useState } from 'react';
import { RecipesAPI } from '../api.js';
import { resizeImage } from '../lib/imageResize.js';

const FALLBACK_ERROR = "L'import n'a pas abouti. Réessaie ou saisis la recette à la main.";

function humanError(err) {
  const raw = err?.message || '';
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.detail === 'string') return parsed.detail;
  } catch {
    // Réponse non JSON (réseau coupé, proxy…) : message générique.
  }
  if (err instanceof TypeError) return 'Connexion impossible. Vérifie ton réseau et réessaie.';
  return FALLBACK_ERROR;
}

/**
 * Import d'une recette depuis un lien ou une photo.
 * Renvoie un brouillon (non enregistré) à faire valider dans le formulaire.
 */
export function useRecipeImport() {
  const [status, setStatus] = useState('idle'); // idle | loading | error
  const [source, setSource] = useState(null); // url | photo
  const [error, setError] = useState(null);
  const requestId = useRef(0);

  const run = useCallback(async (kind, task) => {
    const id = ++requestId.current;
    setSource(kind);
    setStatus('loading');
    setError(null);
    try {
      const draft = await task();
      if (id !== requestId.current) return null;
      setStatus('idle');
      return draft;
    } catch (err) {
      if (id !== requestId.current) return null;
      setError(humanError(err));
      setStatus('error');
      return null;
    }
  }, []);

  const importUrl = useCallback(
    (url) => run('url', () => RecipesAPI.importFromUrl(url.trim())),
    [run],
  );

  const importPhoto = useCallback(
    (file) => run('photo', async () => RecipesAPI.importFromPhoto(await resizeImage(file))),
    [run],
  );

  const reset = useCallback(() => {
    requestId.current += 1;
    setStatus('idle');
    setError(null);
    setSource(null);
  }, []);

  return { status, source, error, importUrl, importPhoto, reset };
}
