/**
 * Trouve une image pour un produit noté à la main (« lessive », « Pommes de
 * terre bio »), pour que chaque ligne de la liste ait la sienne.
 *
 * 1. Déjà connue : l'adresse retenue dans `images_produits`.
 * 2. Une vraie photo sur Open Food Facts, cherchée par le nom.
 * 3. Sinon, une illustration générée par OpenAI dans le style des visuels de
 *    l'application (produit isolé sur fond blanc), déposée dans le stockage.
 *
 * Le résultat est retenu sous le nom normalisé : un nom n'est cherché ou
 * généré qu'une fois, pour tous les foyers. La clé `OPENAI_API_KEY` est un
 * secret Supabase ; sans elle, l'étape 3 est sautée et l'application garde
 * son aplat. Seul un membre d'un foyer peut appeler la fonction.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const URL_SB = Deno.env.get('SUPABASE_URL')!;
const CLE_PUBLIABLE = Deno.env.get('SUPABASE_ANON_KEY')!;
const CLE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MODELE_IMAGE = Deno.env.get('OPENAI_IMAGE_MODEL') ?? 'gpt-image-1';
const SEAU = 'images-produits';

const reponse = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { 'Content-Type': 'application/json' } });

/** Même normalisation que mobile/lib/image-produit.ts (cleImage). */
const cleImage = (nom: string) => nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/œ/g, 'oe').replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80);

/**
 * Première photo de face d'un produit dont le nom contient les mots cherchés.
 * « indisponible » si Open Food Facts ne répond pas (il limite le nombre de
 * recherches) : on ne génère pas d'image à sa place, on réessaiera.
 */
async function photoOpenFoodFacts(nom: string, cle: string): Promise<string | null | 'indisponible'> {
  const mots = cle.split(' ').filter((m) => m.length >= 3);
  const adresse = 'https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&page_size=10'
    + '&fields=product_name,image_front_url&search_terms=' + encodeURIComponent(nom);
  try {
    const r = await fetch(adresse, {
      headers: { 'User-Agent': 'Courses/1.0 (application familiale de liste de courses)' },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return 'indisponible';
    const { products } = await r.json() as { products?: { product_name?: string; image_front_url?: string }[] };
    const trouve = (products ?? []).find((p) => {
      if (!p.image_front_url || !p.product_name) return false;
      const n = cleImage(p.product_name);
      return mots.every((m) => n.includes(m));
    });
    return trouve?.image_front_url ?? null;
  } catch {
    return 'indisponible';
  }
}

/** Illustration générée, déposée dans le stockage ; null si la génération n'est pas activée ou échoue. */
async function illustration(admin: ReturnType<typeof createClient>, nom: string, cle: string): Promise<string | null> {
  const cleApi = Deno.env.get('OPENAI_API_KEY');
  if (!cleApi) return null;
  const consigne = `Studio product photograph of "${nom}" as sold in a French supermarket. `
    + 'One single item, centered, isolated on a pure white background, soft diffused studio light, '
    + 'subtle natural shadow, realistic packshot. No text, no brand name, no logo, no label writing.';
  try {
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cleApi}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODELE_IMAGE, prompt: consigne, size: '1024x1024', quality: 'low', n: 1 }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!r.ok) {
      console.error('[image-produit] génération', r.status, (await r.text()).slice(0, 300));
      return null;
    }
    const { data } = await r.json() as { data?: { b64_json?: string }[] };
    const b64 = data?.[0]?.b64_json;
    if (!b64) return null;
    const octets = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const chemin = `${cle.replace(/ /g, '-')}.png`;
    const { error } = await admin.storage.from(SEAU).upload(chemin, octets, { contentType: 'image/png', upsert: true });
    if (error) {
      console.error('[image-produit] dépôt', error.message);
      return null;
    }
    return admin.storage.from(SEAU).getPublicUrl(chemin).data.publicUrl;
  } catch (e) {
    console.error('[image-produit]', String(e));
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reponse({ ok: false, erreur: 'Méthode refusée.' }, 405);

  const autorisation = req.headers.get('Authorization') ?? '';
  if (!autorisation) return reponse({ ok: false, erreur: 'Session absente.' }, 401);
  const appelant = createClient(URL_SB, CLE_PUBLIABLE, { global: { headers: { Authorization: autorisation } } });
  const { data: foyer } = await appelant.rpc('mon_foyer');
  if (!foyer) return reponse({ ok: false, erreur: "Tu n'appartiens à aucun foyer." }, 403);

  let nom = '';
  try {
    nom = String((await req.json())?.nom ?? '').trim().slice(0, 120);
  } catch {
    return reponse({ ok: false, erreur: 'Requête illisible.' }, 400);
  }
  const cle = cleImage(nom);
  if (cle.length < 2) return reponse({ ok: false, erreur: 'Nom de produit trop court.' }, 400);

  const admin = createClient(URL_SB, CLE_SERVICE);
  const { data: connue } = await admin.from('images_produits').select('url, source').eq('cle', cle).maybeSingle();
  if (connue) return reponse({ ok: true, url: connue.url, source: connue.source });

  let source: 'off' | 'generee' = 'off';
  const photo = await photoOpenFoodFacts(nom, cle);
  if (photo === 'indisponible') return reponse({ ok: false, erreur: 'Recherche de photo indisponible, réessaie plus tard.' }, 503);
  let url = photo;
  if (!url) {
    source = 'generee';
    url = await illustration(admin, nom, cle);
  }
  if (!url) return reponse({ ok: false, erreur: "Pas d'image pour ce produit pour le moment." }, 404);

  await admin.from('images_produits').upsert({ cle, url, source });
  return reponse({ ok: true, url, source });
});
