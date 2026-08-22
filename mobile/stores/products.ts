import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { FicheProduit } from '../lib/openfoodfacts.ts';
import { estErreurReseau } from '../lib/postgrest.ts';

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
};

const CHAMPS =
  'id, ean13, name, brand, category, unit, favorite, image_url, grammage_g, volume_ml, product_type, nutriscore';

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
      // doivent pas se ressembler à l'écran. Le message affiché reste en
      // français et générique — voir `ERREUR_CHARGEMENT` — le détail
      // technique part au journal de développement.
      console.error('[recharger]', error);
      setErreur(ERREUR_CHARGEMENT);
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
 * Ajoute un produit scanné au catalogue.
 *
 * Un code-barres déjà présent n'est pas réinséré : la contrainte
 * unique (user_id, ean13) le garantit en base, et on renvoie le produit
 * existant pour que l'écran le signale au lieu d'afficher une erreur brute.
 */
export async function ajouterProduit(
  fiche: FicheProduit,
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
  }).select(CHAMPS).single();

  if (!error && cree) return { ok: true, produit: cree as Product };

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
