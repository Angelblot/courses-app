import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const source = stripTypeScriptTypes(readFileSync(new URL('../functions/inviter/index.ts', import.meta.url), 'utf8')
  .replace(/^import .*createClient.*;$/m, ''));

function setup({ foyer = 'foyer-session', inviteError = null, memberError = null } = {}) {
  const calls = [];
  let handler;
  const admin = {
    auth: { admin: { inviteUserByEmail: async (email, options) => {
      calls.push(['invite', email, options]);
      return { data: { user: { id: 'nouvel-invite' } }, error: inviteError };
    } } },
    from: (table) => ({ upsert: async (row, options) => {
      calls.push(['membership', table, JSON.parse(JSON.stringify(row)), options]);
      return { error: memberError };
    } }),
  };
  vm.runInNewContext(source, {
    Response, console: { error() {} },
    Deno: { env: { get: (key) => key }, serve: (fn) => { handler = fn; } },
    createClient: (_url, key) => key === 'SUPABASE_SERVICE_ROLE_KEY' ? admin : {
      rpc: async () => ({ data: foyer, error: null }),
    },
  });
  return { calls, run: (headers = { Authorization: 'Bearer session' }) => handler(new Request('https://example.test', {
    method: 'POST', headers,
    body: JSON.stringify({ email: ' Invite@example.test ', household_id: 'foyer-usurpe' }),
  })) };
}

test('aucun envoi sans session ni foyer', async () => {
  const a = setup();
  assert.equal((await a.run({})).status, 401);
  assert.equal(a.calls.length, 0);
  const b = setup({ foyer: null });
  assert.equal((await b.run()).status, 403);
  assert.equal(b.calls.length, 0);
});
test('le serveur rattache au foyer de la session sans métadonnées utilisateur', async () => {
  const a = setup();
  assert.equal((await a.run()).status, 200);
  assert.equal(a.calls[0][1], 'invite@example.test');
  assert.equal(a.calls[0][2].data, undefined);
  assert.deepEqual(a.calls[1][2], { household_id: 'foyer-session', user_id: 'nouvel-invite', role: 'membre' });
});
test('pas de rattachement après un échec d’invitation', async () => {
  const a = setup({ inviteError: { message: 'already registered' } });
  assert.equal((await a.run()).status, 400);
  assert.equal(a.calls.length, 1);
});
test('un rattachement échoué ne renvoie pas un faux succès', async () => {
  const a = setup({ memberError: { message: 'database unavailable' } });
  assert.equal((await a.run()).status, 500);
});
