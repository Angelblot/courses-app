import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

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
