import { useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { rechercherParNom, type FicheProduit } from '../lib/openfoodfacts';

/** Une seule recherche active ; aucune réponse périmée après édition/fermeture. */
export function useRechercheOff() {
  const active = useRef<AbortController | null>(null);
  const [enRecherche, setEnRecherche] = useState(false);
  const [tentative, setTentative] = useState(1);
  const [resultats, setResultats] = useState<FicheProduit[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);

  function reinitialiser() {
    active.current?.abort(); active.current = null;
    setEnRecherche(false); setResultats(null); setErreur(null); setTentative(1);
  }
  async function chercher(texte: string) {
    if (active.current || texte.trim().length < 3) return;
    Keyboard.dismiss();
    const controleur = new AbortController(); active.current = controleur;
    setEnRecherche(true); setTentative(1); setErreur(null); setResultats(null);
    const r = await rechercherParNom(texte, {
      signal: controleur.signal,
      onTentative: n => { if (active.current === controleur) setTentative(n); },
    });
    if (active.current !== controleur) return;
    active.current = null; setEnRecherche(false);
    if (r.etat === 'trouve') setResultats(r.fiches);
    else if (r.etat === 'vide') setResultats([]);
    else if (r.etat === 'indisponible') setErreur(r.raison === 'limite'
      ? `Open Food Facts limite les recherches. Réessaie dans ${r.reessayerDans ?? 60} secondes, ou scanne le produit.`
      : 'La recherche Open Food Facts n’a pas abouti. Tu peux réessayer, scanner le produit ou noter son nom.');
  }
  return { enRecherche, resultats, erreur, chercher, reinitialiser,
    progression: tentative > 1 ? `Le service met du temps. Nouvel essai (${tentative}/3)…` : 'Recherche des produits…' };
}
