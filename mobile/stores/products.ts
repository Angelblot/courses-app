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
 * Ajoute un produit scanné au catalogue.
 *
 * Un code-barres déjà présent n'est pas réinséré : la contrainte
 * unique (user_id, ean13) le garantit en base, et on renvoie le produit
 * existant pour que l'écran le signale au lieu d'afficher une erreur brute.
 */
export async function ajouterProduit(
  fiche: FicheProduit,
): Promise<{ ok: boolean; doublon?: Product; erreur?: string }> {
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
    unit: fiche.volumeMl ? 'l' : 'piece',
  });

  return error ? { ok: false, erreur: error.message } : { ok: true };
}
