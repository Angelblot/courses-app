import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { DRIVES_RECHERCHE, planGarde, type DriveRecherche, type OffreRelevee, type RechercheDrive } from '../lib/recherche-drive.ts';
import { famille, requeteAffinee, typesDeFamille } from '../lib/affinage.ts';
import { normalizeProductType } from '../lib/typology.ts';

const CHAMPS_RECHERCHE = 'id, drive, requete, ean13, statut, resultats, demandee_le, faite_le';
const CHAMPS_OFFRE = 'id, recherche_id, drive, libelle, marque, ean13, url, image_url, prix, prix_unitaire, unite_prix, grammage_g, volume_ml, nutriscore, promotion, disponible, rang, vu_le, fiche_texte';

/**
 * Demande à l'extension de chercher ces produits sur Carrefour et E.Leclerc.
 * Une recherche déjà en attente pour le même nom et le même drive n'est pas
 * redemandée.
 */
export async function demanderRecherches(demandes: { requete: string; ean13?: string | null; drives?: DriveRecherche[] }[], { siAbsente = false }: { siAbsente?: boolean } = {}): Promise<{ ok: boolean; erreur?: string }> {
  const propres = demandes.map(d => ({ requete: d.requete.trim().slice(0, 200), ean13: d.ean13 && /^\d{8,14}$/.test(d.ean13) ? d.ean13 : null, drives: d.drives ?? DRIVES_RECHERCHE })).filter(d => d.requete);
  if (!propres.length) return { ok: true };
  // Une recherche en file ne se double pas ; avec siAbsente, une recherche faite depuis moins d'une semaine non plus.
  const semaine = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data: deja, error: e1 } = siAbsente
    ? await supabase.from('recherches_drive').select('requete, drive').eq('type', 'recherche').or(`statut.in.(en_attente,en_cours,verification),demandee_le.gte.${semaine}`)
    : await supabase.from('recherches_drive').select('requete, drive').in('statut', ['en_attente', 'en_cours', 'verification']);
  if (e1) { console.error('[demanderRecherches]', e1); return { ok: false, erreur: 'Impossible d’envoyer la recherche. Réessaie.' }; }
  const pris = new Set((deja ?? []).map(r => `${r.drive}:${String(r.requete).toLowerCase()}`));
  const lignes = propres.flatMap(d => d.drives.filter(drive => !pris.has(`${drive}:${d.requete.toLowerCase()}`)).map(drive => ({ drive, requete: d.requete, ean13: d.ean13 })));
  if (!lignes.length) return { ok: true };
  const { error } = await supabase.from('recherches_drive').insert(lignes);
  if (error) { console.error('[demanderRecherches]', error); return { ok: false, erreur: 'Impossible d’envoyer la recherche. Réessaie.' }; }
  return { ok: true };
}

/**
 * Avant même d'ouvrir Préciser : chaque article est cherché sur les deux
 * drives, et ses types courants (« Bière IPA », « Bière Blonde »…) sur
 * Carrefour seulement. E.Leclerc bloque au-delà d'un rythme humain : ses
 * recherches approfondies attendent qu'on touche un type.
 */
export async function preparerRecherches(noms: string[]): Promise<{ ok: boolean }> {
  const demandes = noms.flatMap(n => {
    const fam = famille(n);
    return [{ requete: n }, ...(fam ? typesDeFamille(fam).map(t => ({ requete: requeteAffinee(n, t), drives: ['carrefour'] as DriveRecherche[] })) : [])];
  });
  const r = await demanderRecherches(demandes, { siAbsente: true });
  return { ok: r.ok };
}

/** Retire une recherche pas encore faite. */
export async function annulerRecherche(requete: string): Promise<{ ok: boolean; erreur?: string }> {
  const { error } = await supabase.from('recherches_drive').delete().eq('requete', requete).in('statut', ['en_attente', 'verification']);
  if (error) { console.error('[annulerRecherche]', error); return { ok: false, erreur: 'Impossible d’annuler. Réessaie.' }; }
  return { ok: true };
}

/**
 * Les recherches d'un nom et leurs offres, suivies en temps réel : quand
 * l'extension finit une recherche, ses résultats arrivent sans rien toucher.
 */
export function useRecherchesDrive(requete: string) {
  const [recherches, setRecherches] = useState<RechercheDrive[]>([]);
  const [offres, setOffres] = useState<OffreRelevee[]>([]);
  const [chargement, setChargement] = useState(true);
  // Les offres dont la fiche est en cours de lecture par l'extension.
  const [fichesEnCours, setFichesEnCours] = useState<string[]>([]);

  const recharger = useCallback(async () => {
    // Aucun type choisi : rien à suivre.
    if (!requete) { setRecherches([]); setOffres([]); setChargement(false); return; }
    const { data, error } = await supabase.from('recherches_drive').select(CHAMPS_RECHERCHE)
      .eq('requete', requete).order('demandee_le', { ascending: false }).limit(10);
    if (error) { console.error('[useRecherchesDrive]', error); setChargement(false); return; }
    const liste = (data ?? []) as RechercheDrive[];
    // Seules les offres de la dernière recherche de chaque drive comptent.
    const dernieres = new Map<string, RechercheDrive>();
    for (const r of liste) if (!dernieres.has(r.drive)) dernieres.set(r.drive, r);
    const ids = [...dernieres.values()].map(r => r.id);
    const lues = ids.length
      ? await supabase.from('offres_drive').select(CHAMPS_OFFRE).in('recherche_id', ids).order('rang', { ascending: true })
      : { data: [], error: null };
    if (lues.error) console.error('[useRecherchesDrive]', lues.error);
    const idsOffres = (lues.data ?? []).map(o => (o as OffreRelevee).id);
    const fiches = idsOffres.length
      ? await supabase.from('recherches_drive').select('offre_id').eq('type', 'fiche').in('statut', ['en_attente', 'en_cours', 'verification']).in('offre_id', idsOffres)
      : { data: [] };
    setFichesEnCours(((fiches.data ?? []) as { offre_id: string }[]).map(f => f.offre_id));
    setRecherches(liste);
    setOffres(((lues.data ?? []) as OffreRelevee[]).map(o => ({ ...o, prix: o.prix == null ? null : Number(o.prix), prix_unitaire: o.prix_unitaire == null ? null : Number(o.prix_unitaire) })));
    setChargement(false);
  }, [requete]);

  useEffect(() => {
    let vivant = true;
    // Nouvelle requête : rien de l'ancienne ne doit passer pour elle le temps de la relire.
    setRecherches([]); setOffres([]); setChargement(!!requete);
    void recharger();
    if (!requete) return () => { vivant = false; };
    // Toute avancée compte : une fiche lue porte le libellé de l'offre, pas le nom cherché.
    const canal = supabase.channel(`recherches-${requete}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recherches_drive' }, () => { if (vivant) void recharger(); })
      .subscribe();
    return () => { vivant = false; supabase.removeChannel(canal); };
  }, [requete, recharger]);

  // Le temps réel peut manquer un événement : tant que quelque chose est en cours, on relit toutes les 15 secondes.
  const enCours = fichesEnCours.length > 0 || recherches.some(r => ['en_attente', 'en_cours'].includes(r.statut));
  useEffect(() => {
    if (!enCours) return;
    const t = setInterval(() => { void recharger(); }, 15_000);
    return () => clearInterval(t);
  }, [enCours, recharger]);

  return { recherches, offres, chargement, recharger, fichesEnCours };
}

/**
 * Garde les offres choisies : chacune devient un produit de « Mes produits »,
 * relié à son drive (le panier y va tout droit). À deux, chacune est réservée
 * à son drive et la première a l'autre pour alternative. Renvoie le produit
 * à mettre dans la liste.
 */
export async function garderOffres(choisies: OffreRelevee[], requete: string): Promise<{ ok: boolean; productId?: string; erreur?: string }> {
  const plan = planGarde(choisies);
  if (!plan.length) return { ok: false, erreur: 'Choisis au moins un produit.' };
  const erreur = 'Impossible d’ajouter ce produit. Réessaie.';
  const ids: string[] = [];
  // Ton même produit retenu chez les deux enseignes : il est vendu aux deux, pas réservé à l'une.
  const parProduit = new Map<string, number>();
  for (const { offre } of plan) if (offre.produit_id) parProduit.set(offre.produit_id, (parProduit.get(offre.produit_id) ?? 0) + 1);
  for (const { offre, venduChez: prevu } of plan) {
    const venduChez = offre.produit_id && (parProduit.get(offre.produit_id) ?? 0) > 1 ? null : prevu;
    // Un de tes produits, reconnu dans l'offre : on le réutilise tel quel.
    let id: string | null = offre.produit_id ?? null;
    if (id) {
      if (venduChez) await supabase.from('products').update({ vendu_chez: venduChez }).eq('id', id);
    } else if (offre.ean13) {
      const { data } = await supabase.from('products').select('id').eq('ean13', offre.ean13).maybeSingle();
      id = data?.id ?? null;
    }
    if (!id) {
      const { data, error } = await supabase.from('products').insert({
        ean13: offre.ean13, name: offre.libelle, brand: offre.marque, image_url: offre.image_url,
        grammage_g: offre.grammage_g, volume_ml: offre.volume_ml, product_type: normalizeProductType(offre.libelle),
        category: 'autre', nutriscore: offre.nutriscore, favorite: false, unit: 'unité', vendu_chez: venduChez,
      }).select('id').single();
      if (error || !data) { console.error('[garderOffres]', error); return { ok: false, erreur }; }
      id = data.id as string;
    } else if (venduChez && !offre.produit_id) {
      await supabase.from('products').update({ vendu_chez: venduChez }).eq('id', id);
    }
    ids.push(id);
    // Tiré de ton historique, sans offre relevée : le lien déjà connu reste tel quel.
    if (offre.historique) continue;
    // Le lien au drive : la fiche Carrefour (son adresse porte l'EAN) ou le
    // libellé exact, seule voie sûre chez E.Leclerc.
    const { error: e2 } = await supabase.from('product_equivalents').upsert({
      product_id: id, drive: offre.drive, search_query: requete, matched_label: offre.libelle,
      product_url: offre.drive === 'carrefour' && offre.ean13 ? offre.url : null, ean13: offre.ean13,
      unavailable: false, last_confirmed_at: new Date().toISOString(),
    }, { onConflict: 'user_id,product_id,drive' });
    if (e2) console.error('[garderOffres] lien au drive', e2);
  }
  if (ids.length > 1) {
    // Les alternatives déjà retenues pour ce produit restent : on y ajoute les nouvelles.
    const { data: avant } = await supabase.from('products').select('alternatives').eq('id', ids[0]).maybeSingle();
    const alternatives = [...new Set([...(((avant?.alternatives as string[] | null) ?? [])), ...ids.slice(1)])].filter(x => x !== ids[0]);
    const { error } = await supabase.from('products').update({ alternatives }).eq('id', ids[0]);
    if (error) console.error('[garderOffres] alternatives', error);
  }
  return { ok: true, productId: ids[0] };
}

/**
 * Demande à l'extension de lire la fiche des offres comparées dont la
 * contenance manque (taille des feuilles, largeur d'un rouleau…). Seules les
 * fiches Carrefour ont une adresse ; une lecture déjà demandée ne se répète pas.
 */
export async function demanderFiches(offres: OffreRelevee[], dejaEnCours: string[]): Promise<{ ok: boolean }> {
  // Une ligne tirée de l'historique n'est pas une offre relevée : pas de fiche à lire.
  const candidates = offres.filter(o => o.drive === 'carrefour' && o.url && !o.fiche_texte && !o.historique && !dejaEnCours.includes(o.id));
  if (!candidates.length) return { ok: true };
  // Une fiche déjà lue sans rien d'utile, ou en cours, ne se redemande pas.
  const { data: deja } = await supabase.from('recherches_drive').select('offre_id').eq('type', 'fiche').in('offre_id', candidates.map(o => o.id));
  const vues = new Set(((deja ?? []) as { offre_id: string }[]).map(d => d.offre_id));
  const lignes = candidates.filter(o => !vues.has(o.id))
    .map(o => ({ drive: o.drive, type: 'fiche', requete: o.libelle.slice(0, 200), url: o.url, offre_id: o.id }));
  if (!lignes.length) return { ok: true };
  const { error } = await supabase.from('recherches_drive').insert(lignes);
  if (error) { console.error('[demanderFiches]', error); return { ok: false }; }
  return { ok: true };
}
