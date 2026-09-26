/**
 * Lecture d'une fiche recette photographiée (HelloFresh, livre, carnet).
 *
 * La fonction Edge `lire-fiche` confie la photo à Claude et rend sa réponse
 * brute ; on la valide ici, en fonction pure, pour rester testable sous
 * `node --test`. Aucun import de Supabase ni de React Native.
 *
 * Claude rend des lignes d'ingrédients au format d'une page de recette
 * (« 500 g de pommes de terre ») : elles passent ensuite par le même
 * `analyserLigne` que l'import par lien, et par le même aperçu.
 */
import { lireParts, type RecetteImportee } from './import-recette.ts';

/** Nom de secours : un nom vide bloquerait l'enregistrement pour rien. */
const NOM_PAR_DEFAUT = 'Recette photographiée';

/**
 * Valide la réponse de `lire-fiche` et la convertit en recette importée.
 *
 * Rend `null` quand la photo ne montre pas de recette lisible, ou quand la
 * réponse n'a pas la forme attendue — jamais d'exception.
 */
export function lireFiche(brut: unknown): RecetteImportee | null {
  if (!brut || typeof brut !== 'object') return null;
  const r = brut as Record<string, unknown>;
  if (r.lisible !== true || !Array.isArray(r.ingredients)) return null;

  const ingredients = r.ingredients
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (ingredients.length === 0) return null;

  const nom = typeof r.nom === 'string' ? r.nom.trim() : '';
  return {
    nom: nom || NOM_PAR_DEFAUT,
    parts: lireParts(r.parts),
    // Une photo de papier ne fait pas une belle couverture de recette.
    image: null,
    ingredients,
    preparationMin: null,
    cuissonMin: null,
    kcalParPart: null,
  };
}
