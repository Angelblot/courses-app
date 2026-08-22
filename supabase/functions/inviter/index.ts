/**
 * Invite une personne dans le foyer de l'appelant.
 *
 * La clé de service n'est écrite nulle part : Supabase l'injecte dans
 * l'environnement de la fonction sous `SUPABASE_SERVICE_ROLE_KEY`. Elle ne doit
 * ni être commitée, ni transiter par le téléphone.
 *
 * L'appelant est identifié par son propre jeton, avec la clé publiable : c'est
 * ce qui garantit qu'il ne peut inviter que dans son foyer à lui.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const URL_SB = Deno.env.get('SUPABASE_URL')!;
const CLE_PUBLIABLE = Deno.env.get('SUPABASE_ANON_KEY')!;
const CLE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const reponse = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reponse({ ok: false, erreur: 'Méthode refusée.' }, 405);

  const autorisation = req.headers.get('Authorization') ?? '';
  if (!autorisation) return reponse({ ok: false, erreur: 'Session absente.' }, 401);

  let email = '';
  try {
    const corps = await req.json();
    email = String(corps?.email ?? '').trim().toLowerCase();
  } catch {
    return reponse({ ok: false, erreur: 'Requête illisible.' }, 400);
  }
  if (!email.includes('@')) return reponse({ ok: false, erreur: 'Adresse invalide.' }, 400);

  // Client de l'appelant : RLS s'applique, donc `mon_foyer()` rend le sien.
  const appelant = createClient(URL_SB, CLE_PUBLIABLE, {
    global: { headers: { Authorization: autorisation } },
  });
  const { data: foyer, error: erreurFoyer } = await appelant.rpc('mon_foyer');
  if (erreurFoyer || !foyer) {
    return reponse({ ok: false, erreur: "Tu n'appartiens à aucun foyer." }, 403);
  }

  const admin = createClient(URL_SB, CLE_SERVICE);
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { household_id: foyer },
    redirectTo: 'coursesapp://reinitialisation',
  });

  if (error) {
    console.error('[inviter]', error.message);
    // Message français, jamais la réponse brute : « User already registered »
    // ou une limite d'envoi ne veulent rien dire pour qui invite sa famille.
    const dejaInscrit = error.message.toLowerCase().includes('already');
    return reponse({
      ok: false,
      erreur: dejaInscrit
        ? 'Cette adresse a déjà un compte.'
        : "L'invitation n'a pas pu être envoyée. Réessaie dans quelques minutes.",
    }, 400);
  }

  return reponse({ ok: true });
});
