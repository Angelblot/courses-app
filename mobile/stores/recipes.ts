import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Brouillon } from '../lib/recette-brouillon.ts';
import type { CleRayon } from '../lib/rayons.ts';

const ERREUR_CHARGEMENT =
  'Impossible de charger tes recettes. Vérifie ta connexion et réessaie.';

export type Ingredient = {
  id: string;
  name: string;
  quantity_per_serving: number;
  unit: string;
  rayon: CleRayon;
  product_id: string | null;
};

export type Recipe = {
  id: string;
  name: string;
  description: string | null;
  servings_default: number;
  image_url: string | null;
  ingredients: Ingredient[];
};

const CHAMPS =
  'id, name, description, servings_default, image_url, '
  + 'recipe_ingredients(id, name, quantity_per_serving, unit, rayon, product_id)';

export function useRecipes() {
  const [recettes, setRecettes] = useState<Recipe[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  // Même garde-fou que dans stores/products.ts : une réponse lente ne doit pas
  // écraser une réponse plus récente.
  const generation = useRef(0);

  const recharger = useCallback(async () => {
    const appel = ++generation.current;
    setChargement(true);
    const { data, error } = await supabase.from('recipes').select(CHAMPS).order('name');
    if (appel !== generation.current) return;
    if (error) {
      console.error('[recettes]', error);
      setErreur(ERREUR_CHARGEMENT);
      setRecettes([]);
    } else {
      setErreur(null);
      setRecettes(
        (data ?? []).map((r: any) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          servings_default: r.servings_default,
          image_url: r.image_url,
          ingredients: r.recipe_ingredients ?? [],
        })),
      );
    }
    setChargement(false);
  }, []);

  useEffect(() => { recharger(); }, [recharger]);

  return { recettes, chargement, erreur, recharger };
}

/**
 * Lit une recette seule, avec ses ingrédients.
 *
 * Même garde-fou de génération que `useRecipes` : une réponse lente ne doit pas
 * écraser une réponse plus récente.
 */
export function useRecette(id: string | undefined) {
  const [recette, setRecette] = useState<Recipe | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const generation = useRef(0);

  const recharger = useCallback(async () => {
    if (!id) { setChargement(false); return; }
    const appel = ++generation.current;
    setChargement(true);
    const { data, error } = await supabase
      .from('recipes').select(CHAMPS).eq('id', id).maybeSingle();
    if (appel !== generation.current) return;
    if (error) {
      console.error('[recette]', error);
      setErreur(ERREUR_CHARGEMENT);
      setRecette(null);
    } else {
      setErreur(null);
      setRecette(data ? {
        id: (data as any).id,
        name: (data as any).name,
        description: (data as any).description,
        servings_default: (data as any).servings_default,
        image_url: (data as any).image_url,
        ingredients: (data as any).recipe_ingredients ?? [],
      } : null);
    }
    setChargement(false);
  }, [id]);

  useEffect(() => { recharger(); }, [recharger]);

  return { recette, chargement, erreur, recharger };
}

/**
 * Enregistre une recette et ses ingrédients.
 *
 * Les deux insertions ne sont pas dans une transaction : PostgREST n'en expose
 * pas. Si la seconde échoue, la recette resterait sans ingrédient — on la
 * supprime alors explicitement, plutôt que de laisser une coquille vide que
 * rien ne signalerait et que le wizard afficherait comme une recette valide.
 */
export async function creerRecette(
  b: Brouillon,
): Promise<{ ok: boolean; erreur?: string }> {
  const { data: utilisateur } = await supabase.auth.getUser();
  const userId = utilisateur?.user?.id;
  if (!userId) return { ok: false, erreur: 'Session expirée. Reconnecte-toi.' };

  const { data: recette, error } = await supabase
    .from('recipes')
    .insert({
      name: b.name.trim(),
      servings_default: b.servings_default,
      image_url: b.image_url ?? null,
      user_id: userId,
    })
    .select('id')
    .single();

  if (error || !recette) {
    console.error('[creerRecette]', error);
    return { ok: false, erreur: "Impossible d'enregistrer la recette pour le moment." };
  }

  const { error: erreurIngredients } = await supabase.from('recipe_ingredients').insert(
    b.ingredients.map((i) => ({
      recipe_id: recette.id,
      user_id: userId,
      name: i.name.trim(),
      quantity_per_serving: i.quantity_per_serving,
      unit: i.unit,
      rayon: i.rayon,
      product_id: i.product_id,
    })),
  );

  if (erreurIngredients) {
    console.error('[creerRecette:ingredients]', erreurIngredients);
    await supabase.from('recipes').delete().eq('id', recette.id);
    return { ok: false, erreur: "Impossible d'enregistrer les ingrédients." };
  }

  return { ok: true };
}

/**
 * Remplace une recette et ses ingrédients.
 *
 * Les ingrédients sont supprimés puis réinsérés, sans tentative de fusion :
 * rapprocher l'ancienne et la nouvelle liste demanderait des règles subtiles
 * et invérifiables d'un coup d'œil. Le remplacement est prévisible.
 *
 * Les opérations ne sont pas dans une transaction — PostgREST n'en expose pas.
 * En cas d'échec de la réinsertion, la recette resterait sans ingrédient : on
 * le signale explicitement plutôt que de laisser une coquille silencieuse.
 */
export async function modifierRecette(
  id: string,
  b: Brouillon,
): Promise<{ ok: boolean; erreur?: string }> {
  const { data: utilisateur } = await supabase.auth.getUser();
  const userId = utilisateur?.user?.id;
  if (!userId) return { ok: false, erreur: 'Session expirée. Reconnecte-toi.' };

  const { error: err1 } = await supabase
    .from('recipes')
    .update({
      name: b.name.trim(),
      servings_default: b.servings_default,
      image_url: b.image_url ?? null,
    })
    .eq('id', id);
  if (err1) {
    console.error('[modifierRecette]', err1);
    return { ok: false, erreur: "Impossible d'enregistrer la recette." };
  }

  const { error: err2 } = await supabase.from('recipe_ingredients').delete().eq('recipe_id', id);
  if (err2) {
    console.error('[modifierRecette:purge]', err2);
    return { ok: false, erreur: 'Impossible de mettre à jour les ingrédients.' };
  }

  const { error: err3 } = await supabase.from('recipe_ingredients').insert(
    b.ingredients.map((i) => ({
      recipe_id: id,
      user_id: userId,
      name: i.name.trim(),
      quantity_per_serving: i.quantity_per_serving,
      unit: i.unit,
      rayon: i.rayon,
      product_id: i.product_id,
    })),
  );
  if (err3) {
    console.error('[modifierRecette:ingredients]', err3);
    return {
      ok: false,
      erreur: "Les ingrédients n'ont pas pu être enregistrés. Rouvre la recette et réessaie.",
    };
  }
  return { ok: true };
}

/**
 * Supprime une recette. Ses ingrédients partent avec elle : la clé étrangère
 * `recipe_ingredients.recipe_id` est en ON DELETE CASCADE — vérifié le 22/08.
 */
export async function supprimerRecette(id: string): Promise<{ ok: boolean; erreur?: string }> {
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  if (error) {
    console.error('[supprimerRecette]', error);
    return { ok: false, erreur: 'Impossible de supprimer cette recette.' };
  }
  return { ok: true };
}
