import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clePiste, pistes as calculer, type Piste } from '../lib/comparateur.ts';
import { classement, reordonner } from '../lib/references.ts';
import { useOffres } from './offres';
import { ajouterProduit, enregistrerAlternatives, useProducts, type Product } from './products';

const cle = (compte: string) => `pistes-ecartees-v1:${compte}`;

/**
 * Les pistes encore à proposer : calculées des offres relevées et des achats
 * passés, sans celles que l'on a écartées sur cet appareil.
 */
export function usePistes(compte: string | null) {
  const o = useOffres(), p = useProducts();
  const [ecartees, setEcartees] = useState<string[]>([]);
  useEffect(() => {
    if (!compte) return;
    void AsyncStorage.getItem(cle(compte)).then(b => { try { setEcartees(b ? JSON.parse(b) : []); } catch { setEcartees([]); } });
  }, [compte]);
  const toutes = useMemo(() => calculer(o.offres, o.achats, p.produits), [o.offres, o.achats, p.produits]);
  const liste = useMemo(() => toutes.filter(x => !ecartees.includes(clePiste(x))), [toutes, ecartees]);
  const ecarter = useCallback((piste: Piste) => {
    const suite = [...ecartees, clePiste(piste)];
    setEcartees(suite);
    if (compte) void AsyncStorage.setItem(cle(compte), JSON.stringify(suite)).catch(() => {});
  }, [ecartees, compte]);
  const retablir = useCallback((piste: Piste) => {
    const suite = ecartees.filter(k => k !== clePiste(piste));
    setEcartees(suite);
    if (compte) void AsyncStorage.setItem(cle(compte), JSON.stringify(suite)).catch(() => {});
  }, [ecartees, compte]);
  const recharger = useCallback(() => { void o.recharger(); void p.recharger(); }, [o.recharger, p.recharger]);
  return { pistes: liste, produits: p.produits, chargement: o.chargement || p.chargement, erreur: o.erreur ?? p.erreur, ecarter, retablir, recharger };
}

/**
 * « Essayer à la prochaine commande » : l'alternative passe en tête de
 * l'ordre d'essai, l'ancienne référence juste derrière. Rend l'ordre d'avant,
 * pour annuler.
 */
export async function essayer(piste: Piste, produits: Product[]): Promise<{ ok: boolean; avant?: { ancienne: string; ordre: string[] }; erreur?: string }> {
  const alt = piste.alternative;
  let id = alt.ean13 ? produits.find(x => x.ean13 === alt.ean13)?.id : undefined;
  if (!id && alt.ean13) {
    const r = await ajouterProduit({ ean13: alt.ean13, name: alt.libelle, brand: alt.marque ?? null, imageUrl: alt.image_url ?? null,
      grammageG: alt.grammage_g ?? null, volumeMl: alt.volume_ml ?? null, productType: null, categoryKey: null, nutriscore: alt.nutriscore }, false);
    id = r.produit?.id ?? r.doublon?.id;
  }
  if (!id) return { ok: false, erreur: 'Ce produit n’a pas de code-barres : ouvre-le sur le drive pour l’ajouter.' };
  const reference = produits.find(x => x.id === piste.produit.id);
  if (!reference) return { ok: false, erreur: 'Ta référence n’est plus dans tes produits.' };
  const avant = classement(reference, produits).map(x => x.id);
  const ordre = [id, ...avant.filter(x => x !== id)];
  const r = await enregistrerAlternatives(reordonner(reference.id, ordre));
  return r.ok ? { ok: true, avant: { ancienne: id, ordre: avant } } : { ok: false, erreur: r.erreur };
}

/** Remet l'ordre d'essai tel qu'il était avant « Essayer ». */
export async function annulerEssai(avant: { ancienne: string; ordre: string[] }) {
  return enregistrerAlternatives(reordonner(avant.ancienne, avant.ordre));
}
