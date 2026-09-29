import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { cleImage } from '../lib/image-produit';

/**
 * Images des produits sans photo, demandées à la fonction `image-produit`
 * une fois par nom, puis gardées sur le téléphone. Un nom resté sans image
 * n'est redemandé qu'au lancement suivant (la génération a pu être activée).
 */
const STOCKAGE = 'images-produits-v1';
const connues = new Map<string, string>();
const absentes = new Set<string>();
const enCours = new Map<string, Promise<string | null>>();
let chargement: Promise<void> | null = null;
// Une demande à la fois : Open Food Facts limite le nombre de recherches.
let file: Promise<unknown> = Promise.resolve();

function chargerStockage() {
  chargement ??= AsyncStorage.getItem(STOCKAGE)
    .then((brut) => { Object.entries(JSON.parse(brut ?? '{}') as Record<string, string>).forEach(([k, v]) => connues.set(k, v)); })
    .catch(() => {});
  return chargement;
}

async function demander(nom: string, cle: string): Promise<string | null> {
  await chargerStockage();
  const deja = connues.get(cle);
  if (deja) return deja;
  if (absentes.has(cle)) return null;
  const { data, error } = await supabase.functions.invoke('image-produit', { body: { nom } });
  const url = !error && data?.ok && typeof data.url === 'string' ? data.url as string : null;
  if (!url) { absentes.add(cle); return null; }
  connues.set(cle, url);
  void AsyncStorage.setItem(STOCKAGE, JSON.stringify(Object.fromEntries(connues))).catch(() => {});
  return url;
}

/** Adresse de l'image d'un produit sans photo ; null tant qu'elle n'est pas trouvée. */
export function useImageProduit(nom: string, actif: boolean): string | null {
  const cle = cleImage(nom);
  const [url, setUrl] = useState<string | null>(() => (actif ? connues.get(cle) ?? null : null));
  useEffect(() => {
    if (!actif || cle.length < 2) { setUrl(null); return; }
    let vivant = true;
    let promesse = enCours.get(cle);
    if (!promesse) {
      promesse = file.then(() => demander(nom, cle)).finally(() => enCours.delete(cle));
      file = promesse.catch(() => null);
      enCours.set(cle, promesse);
    }
    void promesse.then((u) => { if (vivant) setUrl(u); });
    return () => { vivant = false; };
  }, [actif, cle, nom]);
  return url;
}
