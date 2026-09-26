/**
 * Récupère une page de recette et rend ses blocs `application/ld+json`.
 *
 * Elle ne les interprète pas : l'extraction et l'analyse vivent dans
 * l'application, où elles sont testables sous Node. Il ne reste ici que ce
 * qu'on ne peut pas tester ainsi — un appel réseau et une découpe de balises.
 *
 * L'agent est honnête. Vérifié le 22/08 : une chaîne de navigateur n'apporte
 * rien, la réponse est identique. Le projet ne déguise pas ses accès, ici pas
 * plus qu'ailleurs.
 */
const AGENT =
  'courses-app/1.0 (application familiale de courses; lecture de donnees schema.org)';
const DELAI_MS = 12_000;
/** Au-delà, on ne lit pas : une page de recette pèse moins de 2 Mo. */
const TAILLE_MAX = 2_000_000;

const reponse = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reponse({ ok: false, erreur: 'Méthode refusée.' }, 405);

  let adresse = '';
  try {
    adresse = String((await req.json())?.url ?? '').trim();
  } catch {
    return reponse({ ok: false, erreur: 'Requête illisible.' }, 400);
  }

  let cible: URL;
  try {
    cible = new URL(adresse);
  } catch {
    return reponse({ ok: false, erreur: "Cette adresse n'est pas valide." }, 400);
  }
  if (cible.protocol !== 'https:' && cible.protocol !== 'http:') {
    return reponse({ ok: false, erreur: 'Seules les adresses web sont acceptées.' }, 400);
  }

  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI_MS);
  try {
    const r = await fetch(cible.toString(), {
      headers: { 'User-Agent': AGENT, Accept: 'text/html' },
      redirect: 'follow',
      signal: controleur.signal,
    });
    if (!r.ok) return reponse({ ok: false, erreur: `La page a répondu ${r.status}.` }, 400);

    const html = (await r.text()).slice(0, TAILLE_MAX);

    const blocs = [
      ...html.matchAll(
        /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
      ),
    ]
      .map((m) => m[1].trim())
      .filter(Boolean);

    if (blocs.length === 0) {
      return reponse(
        { ok: false, erreur: 'Cette page ne publie pas sa recette dans un format lisible.' },
        400,
      );
    }
    return reponse({ ok: true, blocs });
  } catch (e) {
    console.error('[importer-recette]', String(e));
    return reponse({ ok: false, erreur: "La page n'a pas pu être récupérée." }, 400);
  } finally {
    clearTimeout(minuteur);
  }
});
