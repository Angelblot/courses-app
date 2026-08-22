/**
 * Renseigne le Nutriscore des produits déjà en base, une seule fois.
 *
 * Les produits migrés ont tous un EAN13 mais ont été enregistrés avant que
 * l'application ne lise cette note. Le traitement est séquentiel, une seconde
 * entre deux appels : Open Food Facts est un service gratuit, et une
 * soixantaine de requêtes étalées sur une minute restent courtoises.
 *
 * Lancer (Node >= 22), depuis mobile/ :
 *   EXPO_PUBLIC_SUPABASE_URL=… EXPO_PUBLIC_SUPABASE_ANON_KEY=… \
 *   node scripts/rattrapage_nutriscore.mjs <jeton_de_session>
 *
 * Le jeton de session est nécessaire : RLS n'autorise l'écriture qu'au
 * propriétaire des lignes, et la clé publiable seule est anonyme.
 */
const URL_SB = process.env.EXPO_PUBLIC_SUPABASE_URL;
const CLE = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const JETON = process.argv[2];

if (!URL_SB || !CLE || !JETON) {
  console.error(
    'Usage : EXPO_PUBLIC_SUPABASE_URL=… EXPO_PUBLIC_SUPABASE_ANON_KEY=… '
    + 'node scripts/rattrapage_nutriscore.mjs <jeton>',
  );
  process.exit(2);
}

const entetes = {
  apikey: CLE,
  Authorization: `Bearer ${JETON}`,
  'Content-Type': 'application/json',
};

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const r = await fetch(
  `${URL_SB}/rest/v1/products?select=id,ean13,name&nutriscore=is.null&ean13=not.is.null`,
  { headers: entetes },
);
if (!r.ok) {
  console.error('Lecture impossible :', r.status, await r.text());
  process.exit(1);
}
const produits = await r.json();
console.log(`${produits.length} produits sans note`);

let notes = 0;
let sansNote = 0;
for (const [i, p] of produits.entries()) {
  try {
    const off = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${p.ean13}.json?fields=nutriscore_grade`,
      { headers: { 'User-Agent': 'courses-app/1.0 (rattrapage familial)' } },
    );
    const j = off.ok ? await off.json() : null;
    const brut = (j?.product?.nutriscore_grade ?? '').trim().toLowerCase();
    const note = ['a', 'b', 'c', 'd', 'e'].includes(brut) ? brut : null;

    if (note) {
      const maj = await fetch(`${URL_SB}/rest/v1/products?id=eq.${p.id}`, {
        method: 'PATCH',
        headers: entetes,
        body: JSON.stringify({ nutriscore: note }),
      });
      if (maj.ok) {
        notes += 1;
        console.log(`[${i + 1}/${produits.length}] ${p.name} → ${note.toUpperCase()}`);
      } else {
        console.error(`[${i + 1}] échec écriture ${p.name} :`, maj.status);
      }
    } else {
      sansNote += 1;
      console.log(`[${i + 1}/${produits.length}] ${p.name} → non noté`);
    }
  } catch (e) {
    console.error(`[${i + 1}] ${p.name} :`, e.message);
  }
  await pause(1000);
}

console.log(`\nTerminé : ${notes} notés, ${sansNote} sans note.`);
