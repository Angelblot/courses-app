import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { FicheProduit } from '../lib/openfoodfacts.ts';
import { fusionnerManuels, type ChampFiche, type Dependances, type ValeursFiche } from '../lib/fiche-produit.ts';
import { estErreurReseau } from '../lib/postgrest.ts';
import type { VenduChez } from '../lib/references.ts';

// Message affiché à l'utilisateur en cas d'échec de chargement : une phrase
// française, jamais le `message` brut de postgrest-js (souvent en anglais
// et technique). Le détail exact part au journal de développement via
// `console.error`, jamais à l'écran — voir la convention harmonisée entre
// ce module, `app/(tabs)/index.tsx` et `app/login.tsx`.
const ERREUR_CHARGEMENT = 'Impossible de charger le catalogue. Vérifie ta connexion et réessaie.';

export type Product = {
  id: string;
  ean13: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  unit: string;
  favorite: boolean;
  image_url: string | null;
  grammage_g: number | null;
  volume_ml: number | null;
  product_type: string | null;
  nutriscore: string | null;
  /** Alternatives dans l'ordre d'essai (références seulement). */
  alternatives?: string[] | null;
  /** Phrases dites à Siri qui désignent ce produit. */
  phrases_siri?: string[] | null;
  /** Drive choisi à la main ; null = déduit de la marque. */
  vendu_chez?: VenduChez | null;
};

const CHAMPS =
  'id, ean13, name, brand, category, unit, favorite, image_url, grammage_g, volume_ml, product_type, nutriscore, alternatives, phrases_siri, vendu_chez';

// Le dernier catalogue lu, partagé par tous les écrans montés. Un écran qui
// s'ouvre (la fiche d'un appui long, Mes produits…) l'affiche aussitôt puis le
// relit ; une modification faite dans la fiche rafraîchit aussi la liste restée
// dessous. Vidé à la déconnexion, pour ne rien montrer d'un autre foyer.
let dernierCatalogue: Product[] = [];
const abonnes = new Set<(p: Product[]) => void>();
const publier = (p: Product[]) => { dernierCatalogue = p; abonnes.forEach((f) => f(p)); };
supabase.auth.onAuthStateChange((evenement) => { if (evenement === 'SIGNED_OUT') publier([]); });

export function useProducts() {
  const [produits, setProduits] = useState<Product[]>(dernierCatalogue);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  // Compteur de génération : incrémenté à chaque appel de `recharger`. Empêche
  // qu'un double appui sur « Réessayer », ou un tirer-pour-rafraîchir déclenché
  // pendant que le chargement initial est encore en vol, ne fasse gagner la
  // réponse la plus lente. Sans ce garde-fou, une requête ancienne qui répond
  // après une requête plus récente écraserait l'état à jour — un succès frais
  // pourrait être masqué par une erreur périmée, ou l'inverse.
  const generation = useRef(0);

  const recharger = useCallback(async () => {
    const generationAppel = ++generation.current;
    setChargement(true);
    const { data, error } = await supabase
      .from('products')
      .select(CHAMPS)
      .order('favorite', { ascending: false })
      .order('name');
    // Une génération plus récente a démarré entre-temps : cette réponse est
    // obsolète, on l'ignore complètement (y compris pour `chargement`).
    if (generationAppel !== generation.current) return;
    if (error) {
      // Pas de repli silencieux : un catalogue vide et une erreur réseau ne
      // doivent pas se ressembler à l'écran. Le message affiché reste en
      // français et générique — voir `ERREUR_CHARGEMENT` — le détail
      // technique part au journal de développement.
      console.error('[recharger]', error);
      setErreur(ERREUR_CHARGEMENT);
      setProduits([]);
    } else {
      setErreur(null);
      publier(data as Product[]);
    }
    setChargement(false);
  }, []);

  useEffect(() => { abonnes.add(setProduits); return () => { abonnes.delete(setProduits); }; }, []);
  useEffect(() => { recharger(); }, [recharger]);

  return { produits, chargement, erreur, recharger };
}

/**
 * Ajoute un produit scanné au catalogue.
 *
 * Un code-barres déjà présent n'est pas réinséré : la contrainte
 * unique (user_id, ean13) le garantit en base, et on renvoie le produit
 * existant pour que l'écran le signale au lieu d'afficher une erreur brute.
 */
export async function ajouterProduit(
  fiche: FicheProduit, favori = true,
): Promise<{ ok: boolean; produit?: Product; doublon?: Product; reseau?: boolean; erreur?: string }> {
  const { data: existant } = await supabase
    .from('products')
    .select(CHAMPS)
    .eq('ean13', fiche.ean13)
    .maybeSingle();

  if (existant) return { ok: false, doublon: existant as Product };

  // On relit la ligne insérée : le sélecteur d'ingrédient a besoin de son
  // identifiant pour y rattacher l'ingrédient qui vient d'être choisi.
  const { data: cree, error } = await supabase.from('products').insert({
    ean13: fiche.ean13,
    name: fiche.name,
    brand: fiche.brand,
    image_url: fiche.imageUrl,
    grammage_g: fiche.grammageG,
    volume_ml: fiche.volumeMl,
    product_type: fiche.productType,
    // `?? 'autre'` et non `?? null` : une fiche peut venir de la file d'attente
    // persistée dans AsyncStorage, écrite par une version antérieure qui ne
    // connaissait pas ce champ. Le rayon est alors absent, pas nul — et un
    // produit sans rayon est exactement le défaut que ce correctif supprime.
    category: fiche.categoryKey ?? 'autre',
    nutriscore: fiche.nutriscore ?? null,
    favorite: favori, // un produit qu'on scanne chez soi est un produit qu'on aime
    // Les 65 produits existants du catalogue utilisent tous unit = 'unité',
    // y compris les liquides (vin 750 ml, bière 200 ml) : la contenance vit
    // dans grammage_g / volume_ml, pas dans l'unité. Déduire 'l' de volumeMl
    // casse cette convention et fausse le wizard : unitConverter.js normalise
    // 'l' vers le même seau que 'ml', donc une brique de lait scannée
    // (volume_ml: 1000, unit: 'l') pour une recette demandant 500 ml
    // emprunterait le cas « même unité normalisée » et renverrait 500 comme
    // quantité à acheter, au lieu de diviser par volume_ml pour trouver
    // « 1 brique ».
    unit: 'unité',
  }).select(CHAMPS).single();

  if (!error && cree) return { ok: true, produit: cree as Product };

  // Contrainte unique (user_id, ean13) : la vérification préalable n'est pas
  // atomique, deux scans rapprochés du même code-barres peuvent tous deux la
  // passer avant que l'un des deux insère. Le second échoue alors ici — c'est
  // fonctionnellement le même doublon que celui détecté plus haut, pas une
  // erreur à annoncer différemment.
  if (error?.code === '23505') {
    const { data: doublon } = await supabase
      .from('products')
      .select(CHAMPS)
      .eq('ean13', fiche.ean13)
      .maybeSingle();
    if (doublon) return { ok: false, doublon: doublon as Product };
    return { ok: false, erreur: 'Ce produit est déjà dans ton catalogue.' };
  }

  // Coupure réseau probable (voir `estErreurReseau`) : on laisse l'appelant
  // mettre la fiche de côté pour la rejouer plus tard, elle a de bonnes
  // chances de passer une fois le réseau revenu.
  if (estErreurReseau(error)) {
    return { ok: false, reseau: true };
  }

  // Échec confirmé côté serveur (règle RLS, contrainte, colonne…) : rejouer
  // la même fiche produirait exactement la même erreur, indéfiniment. Plutôt
  // qu'un compteur de tentatives, on abandonne dès ce premier échec non
  // réseau et on informe tout de suite l'utilisateur — la fiche n'est pas
  // mise en file, elle ne bloquera donc jamais les scans suivants. Le
  // message reste français et générique, le détail technique part au
  // journal de développement.
  console.error('[ajouterProduit]', error);
  return {
    ok: false,
    reseau: false,
    erreur: "Impossible d'ajouter ce produit pour le moment. Réessaie dans un instant.",
  };
}

/**
 * Marque ou démarque un produit comme favori.
 *
 * Ce n'est pas décoratif : l'étape « quotidien » du wizard ne présente que
 * les favoris. Un produit qu'on rachète tous les mois doit pouvoir y entrer
 * depuis sa fiche, sans repasser par le scanner.
 */
export async function basculerFavori(
  id: string,
  favori: boolean,
): Promise<{ ok: boolean; erreur?: string; reseau?: boolean }> {
  const { error } = await supabase.from('products').update({ favorite: favori }).eq('id', id);
  if (error) {
    console.error('[basculerFavori]', error);
    return { ok: false, reseau: estErreurReseau(error), erreur: "Impossible de modifier ce produit pour le moment." };
  }
  return { ok: true };
}

/**
 * Enregistre un classement (variante AL3) : chaque écriture fixe les
 * alternatives d'un produit. Le premier du classement devient la référence.
 */
export async function enregistrerAlternatives(
  ecritures: { id: string; alternatives: string[] }[],
): Promise<{ ok: boolean; erreur?: string }> {
  for (const e of ecritures) {
    const { error } = await supabase.from('products').update({ alternatives: e.alternatives }).eq('id', e.id);
    if (error) {
      console.error('[enregistrerAlternatives]', error);
      return { ok: false, erreur: 'Impossible d’enregistrer cet ordre. Réessaie.' };
    }
  }
  return { ok: true };
}

/** Enregistre les phrases Siri ou le drive de produits, ligne par ligne. */
export async function enregistrerReglages(
  ecritures: ({ id: string } & Partial<Pick<Product, 'phrases_siri' | 'vendu_chez'>>)[],
): Promise<{ ok: boolean; erreur?: string }> {
  for (const { id, ...champs } of ecritures) {
    const { error } = await supabase.from('products').update(champs).eq('id', id);
    if (error) {
      console.error('[enregistrerReglages]', error);
      return { ok: false, erreur: 'Impossible d’enregistrer ce réglage. Réessaie.' };
    }
  }
  return { ok: true };
}

/**
 * Enregistre une correction faite à la main depuis la fiche.
 *
 * Les champs touchés rejoignent `champs_manuels` : une actualisation Open
 * Food Facts ne les cochera plus d'office. Une actualisation passe
 * `manuels: []` : elle n'ajoute rien à cette liste.
 */
export async function modifierProduit(
  id: string,
  champs: Partial<ValeursFiche>,
  manuels: readonly ChampFiche[],
): Promise<{ ok: boolean; erreur?: string }> {
  const echec = (error: unknown) => {
    console.error('[modifierProduit]', error);
    return { ok: false, erreur: estErreurReseau(error as never) ? 'Pas de connexion : la fiche n’a pas été enregistrée.' : 'Impossible d’enregistrer la fiche pour le moment.' };
  };
  let patch: Record<string, unknown> = { ...champs };
  if (manuels.length) {
    const protections = await lireProtections(id);
    if (protections === null) return echec('lecture des protections');
    if (protections.colonne) patch = { ...patch, champs_manuels: fusionnerManuels(protections.champs_manuels, manuels) };
  }
  const { error } = await supabase.from('products').update(patch).eq('id', id);
  return error ? echec(error) : { ok: true };
}

// Colonne absente : la migration 0019 n'est pas encore jouée sur ce projet.
const colonneAbsente = (e: { code?: string } | null) => e?.code === '42703' || e?.code === 'PGRST204';

/**
 * Ce que l'actualisation doit respecter : corrections manuelles et photo
 * améliorée. Sans la colonne `champs_manuels` (migration 0019 pas encore
 * jouée), la fiche fonctionne quand même, sans retenir les corrections.
 */
export async function lireProtections(id: string): Promise<{ champs_manuels: string[]; image_originale: string | null; colonne: boolean } | null> {
  const r = await supabase.from('products').select('champs_manuels, image_originale').eq('id', id).single();
  if (!r.error) return { ...(r.data as { champs_manuels: string[]; image_originale: string | null }), colonne: true };
  if (!colonneAbsente(r.error)) { console.error('[lireProtections]', r.error); return null; }
  const repli = await supabase.from('products').select('image_originale').eq('id', id).single();
  if (repli.error) { console.error('[lireProtections]', repli.error); return null; }
  return { champs_manuels: [], image_originale: (repli.data as { image_originale: string | null }).image_originale, colonne: false };
}

/**
 * Ce qui part avec le produit si on le supprime : en base, correspondances
 * drive et historique d'achat suivent le produit (on delete cascade), les
 * ingrédients de recette perdent seulement leur lien (on delete set null).
 */
export async function compterDependances(id: string, alternativeDe: string | null): Promise<Dependances | null> {
  const [eq, achats, recettes] = await Promise.all([
    supabase.from('product_equivalents').select('id', { count: 'exact', head: true }).eq('product_id', id),
    supabase.from('purchase_lines').select('id', { count: 'exact', head: true }).eq('product_id', id),
    supabase.from('recipe_ingredients').select('recipe_id').eq('product_id', id),
  ]);
  const erreur = eq.error ?? achats.error ?? recettes.error;
  if (erreur) { console.error('[compterDependances]', erreur); return null; }
  return {
    correspondances: eq.count ?? 0,
    achats: achats.count ?? 0,
    recettes: new Set((recettes.data ?? []).map((r: { recipe_id: string }) => r.recipe_id)).size,
    alternativeDe,
  };
}

/**
 * Supprime un produit du catalogue du foyer, puis le retire du classement
 * des références qui le citaient en alternative : `alternatives` est une
 * liste d'identifiants, sans clé étrangère pour la nettoyer.
 */
export async function supprimerProduit(id: string): Promise<{ ok: boolean; erreur?: string }> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) {
    console.error('[supprimerProduit]', error);
    return { ok: false, erreur: estErreurReseau(error) ? 'Pas de connexion : le produit n’a pas été supprimé.' : 'Impossible de supprimer ce produit pour le moment.' };
  }
  // Un identifiant orphelin est ignoré au classement : un échec ici n'annule
  // pas la suppression, il part seulement au journal.
  const { data: citants, error: lecture } = await supabase.from('products').select('id, alternatives').contains('alternatives', [id]);
  if (lecture) console.error('[supprimerProduit] classements', lecture);
  for (const c of (citants ?? []) as { id: string; alternatives: string[] }[]) {
    const { error: e } = await supabase.from('products').update({ alternatives: c.alternatives.filter(a => a !== id) }).eq('id', c.id);
    if (e) console.error('[supprimerProduit] classement', e);
  }
  return { ok: true };
}
