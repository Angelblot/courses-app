/**
 * Lit la photo d'une fiche recette (HelloFresh, livre, carnet) avec Claude.
 *
 * Elle rend la réponse structurée telle quelle ; la validation vit dans
 * l'application (`mobile/lib/fiche-recette.ts`), testable sous Node. Les lignes
 * d'ingrédients sont demandées au format d'une page de recette — « 500 g de
 * pommes de terre » — pour passer par le même analyseur que l'import par lien.
 *
 * La consigne vit ici plutôt que dans l'application : la corriger ne demande
 * qu'un déploiement de fonction, pas un build TestFlight.
 *
 * La clé `ANTHROPIC_API_KEY` est un secret Supabase ; elle ne transite jamais
 * par le téléphone. Seul un membre d'un foyer peut appeler la fonction : chaque
 * lecture est facturée.
 */
import Anthropic from 'npm:@anthropic-ai/sdk@^0.128.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const URL_SB = Deno.env.get('SUPABASE_URL')!;
const CLE_PUBLIABLE = Deno.env.get('SUPABASE_ANON_KEY')!;
const MODELE = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-opus-5';

/** Plafond de l'API pour une image : 5 Mo, soit environ 6,7 millions de caractères en base64. */
const TAILLE_MAX_BASE64 = 6_700_000;
const TYPES_ACCEPTES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const CONSIGNE = `Tu lis la photo d'une fiche recette pour une application française de liste de courses.
Chaque ingrédient deviendra un produit à acheter en drive.

Rends :
- lisible : false si la photo ne montre pas de liste d'ingrédients lisible.
- nom : le titre de la recette, tel qu'écrit. Chaîne vide s'il n'apparaît pas.
- parts : le nombre de personnes des quantités (« Ingrédients pour 2 personnes » -> 2). 0 si absent.
- ingredients : une ligne par ingrédient, au format « <quantité> <unité> de <nom> ».

Règles pour les lignes :
- Quantités telles qu'écrites sur la fiche, pour le nombre de parts indiqué. N'en invente aucune.
- Fractions en « 1/2 », « 1/4 » ; décimales avec une virgule.
- Unités : g, kg, ml, cl, L, cuillère à soupe, cuillère à café, pincée, gousse, tranche, sachet, paquet, boîte, pot, botte, branche.
  « cs » -> cuillère à soupe, « cc » -> cuillère à café. « pièce(s) » ne s'écrit pas : « 1 oignon », « 2 avocats ».
- Nom court et générique, sans la préparation : « oignon », pas « oignon émincé ».
- Une ligne composée se sépare : « sel et poivre » -> deux lignes.
- Inclus les ingrédients « à ajouter vous-même » ou du placard (huile, sucre, vinaigre…).
- Sans quantité (« selon votre goût »), écris le nom seul : « sel ».
- Ignore les étapes, les ustensiles, les valeurs nutritionnelles et les allergènes.`;

const SCHEMA = {
  type: 'object',
  properties: {
    lisible: { type: 'boolean' },
    nom: { type: 'string' },
    parts: { type: 'integer' },
    ingredients: { type: 'array', items: { type: 'string' } },
  },
  required: ['lisible', 'nom', 'parts', 'ingredients'],
  additionalProperties: false,
};

const reponse = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reponse({ ok: false, erreur: 'Méthode refusée.' }, 405);

  const autorisation = req.headers.get('Authorization') ?? '';
  if (!autorisation) return reponse({ ok: false, erreur: 'Session absente.' }, 401);

  const appelant = createClient(URL_SB, CLE_PUBLIABLE, {
    global: { headers: { Authorization: autorisation } },
  });
  const { data: foyer } = await appelant.rpc('mon_foyer');
  if (!foyer) return reponse({ ok: false, erreur: "Tu n'appartiens à aucun foyer." }, 403);

  const cle = Deno.env.get('ANTHROPIC_API_KEY');
  if (!cle) {
    console.error('[lire-fiche] secret ANTHROPIC_API_KEY absent');
    return reponse({ ok: false, erreur: "La lecture de photo n'est pas encore activée." }, 503);
  }

  let image = '';
  let type = 'image/jpeg';
  try {
    const corps = await req.json();
    image = String(corps?.image ?? '');
    type = String(corps?.type ?? 'image/jpeg');
  } catch {
    return reponse({ ok: false, erreur: 'Requête illisible.' }, 400);
  }
  if (!image) return reponse({ ok: false, erreur: 'La photo est vide.' }, 400);
  if (!TYPES_ACCEPTES.has(type)) return reponse({ ok: false, erreur: 'Format de photo non pris en charge.' }, 400);
  if (image.length > TAILLE_MAX_BASE64) {
    return reponse({ ok: false, erreur: 'La photo est trop lourde. Reprends-la un peu plus loin.' }, 413);
  }

  const client = new Anthropic({ apiKey: cle, timeout: 90_000, maxRetries: 1 });
  try {
    const message = await client.messages.create({
      model: MODELE,
      max_tokens: 16000,
      system: CONSIGNE,
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: SCHEMA },
      },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: type as 'image/jpeg', data: image } },
          { type: 'text', text: 'Lis cette fiche recette.' },
        ],
      }],
    });

    if (message.stop_reason === 'refusal') {
      return reponse({ ok: false, erreur: "Cette photo n'a pas pu être lue." }, 422);
    }
    if (message.stop_reason === 'max_tokens') {
      return reponse({ ok: false, erreur: 'La fiche est trop longue pour être lue en une fois.' }, 422);
    }
    const texte = message.content.find((b) => b.type === 'text');
    if (!texte || texte.type !== 'text') {
      return reponse({ ok: false, erreur: "La fiche n'a pas pu être lue." }, 502);
    }
    return reponse({ ok: true, fiche: JSON.parse(texte.text) });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return reponse({ ok: false, erreur: 'Trop de lectures en même temps. Réessaie dans une minute.' }, 429);
    }
    if (e instanceof Anthropic.APIConnectionError) {
      return reponse({ ok: false, erreur: 'Le service de lecture ne répond pas. Réessaie.' }, 502);
    }
    console.error('[lire-fiche]', String(e));
    return reponse({ ok: false, erreur: "La fiche n'a pas pu être lue." }, 502);
  }
});
