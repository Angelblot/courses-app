/** Interface du popup : lancement, suivi, reprise après vérification. */

const $ = (id) => document.getElementById(id);

const send = (msg) =>
  new Promise((resolve) => chrome.runtime.sendMessage(msg, (r) => resolve(r)));

/**
 * Analyse la liste saisie à la main.
 * Format : un produit par ligne, quantité optionnelle en suffixe « x2 ».
 *
 * @param {string} raw Texte brut du champ.
 * @returns {Array<{name: string, quantity: number}>}
 */
function parseItems(raw) {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.*?)\s*[x×]\s*(\d+)$/i);
      if (m) return { name: m[1].trim(), quantity: Number(m[2]) };
      return { name: line, quantity: 1 };
    });
}

const REASON_LABEL = {
  added: 'ajouté',
  no_match: 'aucun résultat convaincant',
  no_results: 'page non reconnue',
  no_add_button: "bouton d'ajout introuvable",
  ambiguous: 'plusieurs produits possibles — à choisir toi-même',
  click_no_effect: 'clic sans effet, rien ajouté',
  challenge: 'vérification demandée',
  inject_failed: 'injection impossible',
  no_result: 'page muette',
};

function render(state) {
  // Un travail en cours ou en pause masque la saisie ; terminé ou arrêté, on
  // affiche les deux — la liste reste consultable et on peut en relancer un.
  const active = state && ['running', 'paused'].includes(state.status);
  $('idle').hidden = Boolean(active);
  $('running').hidden = !state;

  if (!state) return;

  $('site-label').textContent = state.site === 'leclerc' ? 'E.Leclerc' : 'Carrefour';

  const total = state.items?.length ?? 0;
  const done = state.cursor ?? 0;
  const ok = (state.results ?? []).filter((r) => r.ok).length;

  $('bar').style.width = total ? `${Math.round((done / total) * 100)}%` : '0%';

  const status =
    state.status === 'paused'
      ? 'En pause — vérification à résoudre dans l\'onglet, puis Reprendre.'
      : state.status === 'done'
        ? 'Terminé.'
        : state.status === 'stopped'
          ? 'Arrêté.'
          : 'En cours…';
  $('progress-text').textContent = `${done}/${total} traités · ${ok} ajoutés — ${status}`;

  $('resume').hidden = state.status !== 'paused';

  $('log').innerHTML = '';
  for (const r of (state.results ?? []).slice(-30).reverse()) {
    const li = document.createElement('li');
    li.className = r.ok ? 'log__item log__item--ok' : 'log__item log__item--ko';
    const detail = r.ok ? r.label || '' : REASON_LABEL[r.reason] || r.reason || '';
    li.textContent = `${r.item} — ${detail}`;
    $('log').appendChild(li);
  }
}

$('start').addEventListener('click', async () => {
  const items = parseItems($('items').value);
  if (!items.length) return;
  const res = await send({
    type: 'start',
    payload: { site: $('site').value, items },
  });
  if (!res?.ok) $('progress-text').textContent = `Échec : ${res?.error ?? 'inconnu'}`;
});

$('diagnose').addEventListener('click', async () => {
  const res = await send({ type: 'diagnose', site: $('site').value });
  $('diag').hidden = false;
  $('diag').textContent = JSON.stringify(res?.data ?? res, null, 2);
});

$('resume').addEventListener('click', () => send({ type: 'resume' }));
$('stop').addEventListener('click', () => send({ type: 'stop' }));

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'state') render(msg.state);
});

send({ type: 'getState' }).then((r) => render(r?.data ?? null));
