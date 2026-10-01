/**
 * « Améliorer la photo » d'un produit : reprend sa photo Open Food Facts en
 * photo produit sur fond blanc, détourée et centrée, dans le style de l'app.
 *
 * 1. Un modèle de vision décrit le produit (forme, marque, textes visibles).
 * 2. L'édition d'image d'OpenAI (gpt-image-1, haute fidélité, qualité
 *    haute) reprend la photo avec cette description.
 * 3. La photo reprise est déposée dans le stockage et proposée au foyer
 *    (`image_reprise`, statut « prete ») : rien ne remplace la photo actuelle
 *    tant que quelqu'un n'a pas choisi « Garder la nouvelle ».
 *
 * La reprise prend 20 à 40 secondes : la fonction répond tout de suite et
 * continue en arrière-plan ; l'application suit le statut du produit.
 * Qualité haute : à l'essai du 01/10/2026, la qualité moyenne déformait les
 * textes de marque. La clé `OPENAI_API_KEY` est un secret Supabase.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const URL_SB = Deno.env.get('SUPABASE_URL')!;
const CLE_PUBLIABLE = Deno.env.get('SUPABASE_ANON_KEY')!;
const CLE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MODELE_IMAGE = Deno.env.get('OPENAI_IMAGE_MODEL') ?? 'gpt-image-1';
const MODELES_VISION = ['gpt-4.1-mini', 'gpt-4o-mini'];
const SEAU = 'images-produits';

const reponse = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { 'Content-Type': 'application/json' } });

const CONSIGNE_DESCRIPTION = 'You write the product part of an image-editing prompt for a grocery app. '
  + 'Look at the photo and describe ONLY the product itself, in English, in one or two sentences: container type and shape, proportions, '
  + 'colors, materials (plastic film, glass, cardboard...), brand and logo, and quote EXACTLY the main visible packaging texts in their original language. '
  + 'Ignore the background, hands, price stickers, dates and lot codes. End with "Shot: front", "Shot: from above" or "Shot: angled".';

function base64(octets: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < octets.length; i += 0x8000) bin += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function decrire(cle: string, photo: Uint8Array, type: string, nom: string): Promise<string> {
  for (const modele of MODELES_VISION) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modele,
        max_tokens: 300,
        messages: [
          { role: 'system', content: CONSIGNE_DESCRIPTION },
          { role: 'user', content: [
            { type: 'text', text: `Product name in the catalogue: ${nom}` },
            { type: 'image_url', image_url: { url: `data:${type};base64,${base64(photo)}` } },
          ] },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (r.ok) {
      const d = await r.json();
      const texte = String(d.choices?.[0]?.message?.content ?? '').trim();
      if (texte) return texte;
    } else {
      console.error('[ameliorer-photo] description', modele, r.status);
    }
  }
  return `the product "${nom}" exactly as in the reference photo.`;
}

const consigne = (description: string) => 'Use case: product-mockup. Create a clean photorealistic ecommerce product photograph from the supplied reference/edit target. '
  + `Preserve the exact product: ${description} `
  + 'Keep its proportions, logo artwork and main packaging texts (brand, product name, flavour) exactly as in the reference. '
  + 'Reproduce small text only if it is clearly legible in the reference; otherwise leave that area plain rather than inventing letters. '
  + 'Remove all printed dates, best-before dates, lot and batch codes, barcodes, price tags and promotional stickers. '
  + 'Single product standing upright, front facing, fully visible and centered in a square canvas, filling 85% of canvas height. '
  + 'Seamless pure white #FFFFFF background extending to all edges, no horizon, subtle short soft contact shadow only beneath the base. '
  + 'Soft neutral studio lighting, crisp detailed packaging, clean highlights without glare obscuring the logo. '
  + 'Remove original surroundings, hands, plastic glare and photographic noise. '
  + 'Keep the product identity faithful; do not invent extra text, props, watermarks, or decoration. Intended for product cards in a grocery app.';

/** Reprise complète ; écrit le résultat (ou l'échec) sur le produit. */
async function reprendre(admin: ReturnType<typeof createClient>, cle: string, produit: { id: string; name: string; image_url: string }) {
  const echec = async (raison: string) => {
    console.error('[ameliorer-photo]', produit.id, raison);
    await admin.from('products').update({ reprise_statut: 'echec' }).eq('id', produit.id);
  };
  try {
    const source = await fetch(produit.image_url, { headers: { 'User-Agent': 'Courses/1.0 (application familiale de liste de courses)' }, signal: AbortSignal.timeout(15_000) });
    if (!source.ok) return echec(`photo ${source.status}`);
    const type = source.headers.get('Content-Type')?.split(';')[0] || 'image/jpeg';
    const photo = new Uint8Array(await source.arrayBuffer());

    const description = await decrire(cle, photo, type, produit.name);
    const form = new FormData();
    form.append('model', MODELE_IMAGE);
    form.append('image', new Blob([photo], { type }), type === 'image/png' ? 'reference.png' : 'reference.jpg');
    form.append('prompt', consigne(description));
    form.append('size', '1024x1024');
    form.append('quality', 'high');
    form.append('input_fidelity', 'high');
    const r = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST', headers: { Authorization: `Bearer ${cle}` }, body: form, signal: AbortSignal.timeout(120_000),
    });
    if (!r.ok) return echec(`edition ${r.status} ${(await r.text()).slice(0, 200)}`);
    const b64 = (await r.json()).data?.[0]?.b64_json;
    if (!b64) return echec('edition vide');

    const chemin = `reprises/${produit.id}-${Date.now()}.png`;
    const octets = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const { error } = await admin.storage.from(SEAU).upload(chemin, octets, { contentType: 'image/png' });
    if (error) return echec(`depot ${error.message}`);
    const url = admin.storage.from(SEAU).getPublicUrl(chemin).data.publicUrl;
    await admin.from('products').update({ image_reprise: url, reprise_statut: 'prete' }).eq('id', produit.id);
  } catch (e) {
    await echec(String(e));
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reponse({ ok: false, erreur: 'Méthode refusée.' }, 405);
  const autorisation = req.headers.get('Authorization') ?? '';
  if (!autorisation) return reponse({ ok: false, erreur: 'Session absente.' }, 401);

  const cle = Deno.env.get('OPENAI_API_KEY');
  if (!cle) return reponse({ ok: false, erreur: "L'amélioration des photos n'est pas encore activée." }, 503);

  let id = '';
  try {
    id = String((await req.json())?.produit_id ?? '');
  } catch {
    return reponse({ ok: false, erreur: 'Requête illisible.' }, 400);
  }

  // Lu avec les droits de l'appelant : seul un membre du foyer du produit y accède.
  const appelant = createClient(URL_SB, CLE_PUBLIABLE, { global: { headers: { Authorization: autorisation } } });
  const { data: produit } = await appelant.from('products').select('id, name, image_url, reprise_statut, reprise_le').eq('id', id).maybeSingle();
  if (!produit) return reponse({ ok: false, erreur: 'Produit introuvable.' }, 404);
  if (!produit.image_url || !/^https:\/\/images\.openfoodfacts\.org\//.test(produit.image_url)) {
    return reponse({ ok: false, erreur: "Seule une photo Open Food Facts peut être améliorée." }, 400);
  }
  const recente = produit.reprise_le && Date.now() - Date.parse(produit.reprise_le) < 3 * 60 * 1000;
  if (produit.reprise_statut === 'en_cours' && recente) return reponse({ ok: true, statut: 'en_cours' });

  const admin = createClient(URL_SB, CLE_SERVICE);
  await admin.from('products').update({ reprise_statut: 'en_cours', reprise_le: new Date().toISOString(), image_reprise: null }).eq('id', id);
  EdgeRuntime.waitUntil(reprendre(admin, cle, produit as { id: string; name: string; image_url: string }));
  return reponse({ ok: true, statut: 'en_cours' }, 202);
});
