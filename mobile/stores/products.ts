import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { FicheProduit } from '../lib/openfoodfacts.ts';

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
};

const CHAMPS =
  'id, ean13, name, brand, category, unit, favorite, image_url, grammage_g, volume_ml, product_type';

export function useProducts() {
  const [produits, setProduits] = useState<Product[]>([]);
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
      // doivent pas se ressembler à l'écran.
      setErreur(error.message);
      setProduits([]);
    } else {
      setErreur(null);
      setProduits(data as Product[]);
    }
    setChargement(false);
  }, []);

  useEffect(() => { recharger(); }, [recharger]);

  return { produits, chargement, erreur, recharger };
}

/**
 * Une erreur postgrest-js sans `code` vient d'un `fetch` qui a levé une
 * exception avant qu'une réponse HTTP n'arrive — coupure réseau, DNS,
 * timeout (voir `node_modules/@supabase/postgrest-js/dist/index.cjs`, le
 * bloc `res.catch((fetchError) => ...)` dans `PostgrestBuilder.prototype.then` :
 * il construit toujours `code: ''`, y compris pour un abandon ou un
 * dépassement d'en-têtes). Une erreur qui a atteint PostgREST — violation
 * RLS, contrainte, colonne manquante — porte au contraire un code
 * Postgres/PostgREST non vide (ex. '23505', '42501', 'PGRST116'), posé par
 * `processResponse` en parsant le corps JSON renvoyé par le serveur. Un
 * code vide est donc un signal fiable — et propre à cette version de la
 * librairie — d'échec réseau plutôt que d'échec métier.
 */
function estErreurReseau(error: { code?: string }): boolean {
  return !error.code;
}

/**
 * Ajoute un produit scanné au catalogue.
 *
 * Un code-barres déjà présent n'est pas réinséré : la contrainte
 * unique (user_id, ean13) le garantit en base, et on renvoie le produit
 * existant pour que l'écran le signale au lieu d'afficher une erreur brute.
 */
export async function ajouterProduit(
  fiche: FicheProduit,
): Promise<{ ok: boolean; doublon?: Product; reseau?: boolean; erreur?: string }> {
  const { data: existant } = await supabase
    .from('products')
    .select(CHAMPS)
    .eq('ean13', fiche.ean13)
    .maybeSingle();

  if (existant) return { ok: false, doublon: existant as Product };

  const { error } = await supabase.from('products').insert({
    ean13: fiche.ean13,
    name: fiche.name,
    brand: fiche.brand,
    image_url: fiche.imageUrl,
    grammage_g: fiche.grammageG,
    volume_ml: fiche.volumeMl,
    product_type: fiche.productType,
    favorite: true, // un produit qu'on scanne chez soi est un produit qu'on aime
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
  });

  if (!error) return { ok: true };

  // Contrainte unique (user_id, ean13) : la vérification préalable n'est pas
  // atomique, deux scans rapprochés du même code-barres peuvent tous deux la
  // passer avant que l'un des deux insère. Le second échoue alors ici — c'est
  // fonctionnellement le même doublon que celui détecté plus haut, pas une
  // erreur à annoncer différemment.
  if (error.code === '23505') {
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
  // mise en file, elle ne bloquera donc jamais les scans suivants.
  return {
    ok: false,
    reseau: false,
    erreur: "Impossible d'ajouter ce produit pour le moment. Réessaie dans un instant.",
  };
}
