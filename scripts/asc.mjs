/**
 * Client minimal de l'API App Store Connect.
 *
 * La clé privée ne quitte jamais la machine : elle sert à signer localement un
 * jeton JWT ES256, valable 20 minutes, seul élément transmis à Apple. Elle
 * vit dans ~/.appstoreconnect/, hors du dépôt, et n'y entrera jamais.
 *
 * Ce fichier est versionné parce que `mobile/XCODE_CLOUD.md` s'y réfère et
 * qu'il se perdait autrement à chaque session de travail.
 *
 * Usage :
 *   node scripts/asc.mjs "/v1/ciProducts"
 *   node scripts/asc.mjs "/v1/ciBuildRuns" '{"data":{...}}'   -> POST
 *
 * Variables requises :
 *   ASC_KEY_ID     identifiant de la clé, ex. AYC86383MB
 *   ASC_ISSUER_ID  identifiant de l'émetteur, visible dans App Store Connect
 *   ASC_KEY_PATH   chemin du fichier .p8
 */
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const KEY_ID = process.env.ASC_KEY_ID;
const ISSUER_ID = process.env.ASC_ISSUER_ID;
const KEY_PATH = process.env.ASC_KEY_PATH;

if (!KEY_ID || !ISSUER_ID || !KEY_PATH) {
  console.error('ASC_KEY_ID, ASC_ISSUER_ID et ASC_KEY_PATH sont requis.');
  process.exit(2);
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

function jeton() {
  const maintenant = Math.floor(Date.now() / 1000);
  const entete = { alg: 'ES256', kid: KEY_ID, typ: 'JWT' };
  const charge = {
    iss: ISSUER_ID,
    iat: maintenant,
    // 20 minutes : Apple refuse au-delà.
    exp: maintenant + 20 * 60,
    aud: 'appstoreconnect-v1',
  };
  const corps = `${b64(entete)}.${b64(charge)}`;
  const s = createSign('SHA256');
  s.update(corps);
  s.end();
  // Apple exige une signature ES256 au format brut (r||s), pas DER.
  const signature = s.sign({ key: readFileSync(KEY_PATH), dsaEncoding: 'ieee-p1363' });
  return `${corps}.${signature.toString('base64url')}`;
}

const chemin = process.argv[2];
if (!chemin) {
  console.error('Indiquer un chemin, ex. /v1/ciProducts');
  process.exit(2);
}

// Un second argument bascule la requête en POST : c'est ainsi qu'on déclenche
// une compilation quand le déclencheur automatique reste muet.
const corpsJson = process.argv[3];
const r = await fetch(`https://api.appstoreconnect.apple.com${chemin}`, {
  method: corpsJson ? 'POST' : 'GET',
  headers: {
    Authorization: `Bearer ${jeton()}`,
    ...(corpsJson ? { 'Content-Type': 'application/json' } : {}),
  },
  ...(corpsJson ? { body: corpsJson } : {}),
});

const texte = await r.text();
if (!r.ok) {
  console.error(`HTTP ${r.status}`);
  console.error(texte.slice(0, 800));
  process.exit(1);
}
console.log(texte);
