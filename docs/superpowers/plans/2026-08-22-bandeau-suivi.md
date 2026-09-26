# Bandeau de suivi persistant — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE — utiliser
> superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans pour dérouler ce plan tâche par tâche. Les étapes
> emploient la syntaxe à cases (`- [ ]`).

**But :** rendre visible depuis n'importe quel écran qu'un remplissage de panier
attend, tourne, ou vient de finir.

**Architecture :** la décision d'afficher est une fonction pure, testable sous
Node. Un hook suit le travail actif par abonnement temps réel. Le bandeau se
pose au-dessus de la barre d'onglets et n'anime que l'attente. Le suivi détaillé
quitte le wizard pour devenir un écran autonome, sans quoi le bandeau n'aurait
nulle part où mener.

**Pile :** Expo SDK 57, expo-router, Supabase Realtime, `Animated` du cœur de
React Native, AsyncStorage, `node:test`.

**Spécification :** `docs/superpowers/specs/2026-08-22-bandeau-suivi-design.md`

## Contraintes globales

- **Tests : Node ≥ 22.** Depuis `mobile/` :
  `/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs`
- **Aucune nouvelle dépendance.** Ni `react-native-reanimated`, ni
  `expo-notifications`. `Animated` avec `useNativeDriver: true` suffit : la
  translation tourne hors du fil JavaScript.
- **La logique pure ne doit jamais importer Supabase, AsyncStorage ni React
  Native** — elle ne serait plus testable sous Node.
- **Zéro emoji.** Thème clair, couleurs et espacements depuis `lib/theme.ts`.
- **Messages en français**, jamais un code d'état à l'écran.
- **Ne rien pousser avant la tâche 5.** Xcode Cloud surveille `mobile/` sur
  `mobile/expo-scan` avec « Auto-cancel Builds ».

---

### Tâche 1 : décider d'afficher

**Fichiers :**
- Créer : `mobile/lib/suivi-bandeau.ts`
- Test : `mobile/lib/suivi-bandeau.test.mjs`

**Interfaces :**
- Produit :
  - `ETATS_ACTIFS: readonly string[]` — `pending`, `claimed`, `running`, `needs_action`
  - `estActif(statut: string): boolean`
  - `estClos(statut: string): boolean` — `done` ou `failed`
  - `doitAfficher(travail: { id: string; status: string } | null, dernierAcquitte: string | null): boolean`

- [x] **Étape 1 : écrire le test qui échoue**

Créer `mobile/lib/suivi-bandeau.test.mjs` :

```js
/**
 * Décision d'afficher le bandeau de suivi. Fonction pure, sans réseau.
 * Lancer : node --test mobile/lib/suivi-bandeau.test.mjs   (Node >= 22)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { doitAfficher, estActif, estClos } from './suivi-bandeau.ts';

test('les quatre états actifs affichent le bandeau', () => {
  for (const status of ['pending', 'claimed', 'running', 'needs_action']) {
    assert.equal(doitAfficher({ id: 'a', status }, null), true, `manque pour ${status}`);
    assert.equal(estActif(status), true);
  }
});

test('un travail actif reste affiché même si son identifiant a été acquitté', () => {
  // L'acquittement ne vaut que pour un travail clos. Un remplissage relancé
  // sur le même identifiant doit se revoir.
  assert.equal(doitAfficher({ id: 'a', status: 'running' }, 'a'), true);
});

test('un travail terminé mais non acquitté affiche encore', () => {
  // C'est au bilan qu'il y a quelque chose à apprendre : ce qui n'a pas été
  // ajouté. Le faire disparaître tout seul le ferait manquer.
  assert.equal(doitAfficher({ id: 'a', status: 'done' }, null), true);
  assert.equal(doitAfficher({ id: 'a', status: 'failed' }, 'autre'), true);
});

test('un travail terminé et acquitté disparaît', () => {
  assert.equal(doitAfficher({ id: 'a', status: 'done' }, 'a'), false);
  assert.equal(doitAfficher({ id: 'a', status: 'failed' }, 'a'), false);
});

test('un travail annulé ne se montre jamais', () => {
  // « cancelled » n'est ni actif ni clos au sens du bilan : il n'y a rien à
  // regarder.
  assert.equal(doitAfficher({ id: 'a', status: 'cancelled' }, null), false);
  assert.equal(estActif('cancelled'), false);
  assert.equal(estClos('cancelled'), false);
});

test("l'absence de travail n'affiche rien", () => {
  assert.equal(doitAfficher(null, null), false);
  assert.equal(doitAfficher(null, 'a'), false);
});

test('un état inconnu ne fait pas apparaître le bandeau', () => {
  assert.equal(doitAfficher({ id: 'a', status: 'quelque_chose' }, null), false);
});
```

- [x] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/suivi-bandeau.test.mjs
```

Attendu : ÉCHEC, `ERR_MODULE_NOT_FOUND` sur `./suivi-bandeau.ts`.

- [x] **Étape 3 : écrire le module**

Créer `mobile/lib/suivi-bandeau.ts` :

```ts
/**
 * Décision d'afficher le bandeau de suivi.
 *
 * Fonction pure, sans accès au réseau ni au stockage : c'est la règle la plus
 * facile à se tromper, et la seule qu'on puisse éprouver sous Node.
 */

/** Un travail dans l'un de ces états mérite qu'on le signale. */
export const ETATS_ACTIFS = ['pending', 'claimed', 'running', 'needs_action'] as const;

/** Clos avec quelque chose à lire : un bilan, ou une explication d'échec. */
const ETATS_CLOS = ['done', 'failed'] as const;

export function estActif(statut: string): boolean {
  return (ETATS_ACTIFS as readonly string[]).includes(statut);
}

export function estClos(statut: string): boolean {
  return (ETATS_CLOS as readonly string[]).includes(statut);
}

/**
 * Dit si le bandeau doit apparaître.
 *
 * Un travail clos reste affiché tant qu'on ne l'a pas ouvert : c'est au bilan
 * qu'on apprend ce qui n'a pas été ajouté, et le faire disparaître tout seul
 * le ferait manquer.
 *
 * `cancelled` n'apparaît jamais : il n'y a rien à regarder.
 */
export function doitAfficher(
  travail: { id: string; status: string } | null,
  dernierAcquitte: string | null,
): boolean {
  if (!travail) return false;
  if (estActif(travail.status)) return true;
  if (estClos(travail.status)) return travail.id !== dernierAcquitte;
  return false;
}
```

- [x] **Étape 4 : lancer les tests et vérifier qu'ils passent**

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
npx tsc --noEmit
```

Attendu : `# fail 0`, aucune erreur TypeScript.

- [x] **Étape 5 : commit**

```bash
git add mobile/lib/suivi-bandeau.ts mobile/lib/suivi-bandeau.test.mjs
git commit -m "feat: règle d'affichage du bandeau de suivi"
```

---

### Tâche 2 : suivre le travail actif

**Fichiers :**
- Créer : `mobile/stores/acquittement.ts`
- Modifier : `mobile/stores/suivi.ts`

**Interfaces :**
- Consomme : `doitAfficher`, `ETATS_ACTIFS`, `estClos` de `lib/suivi-bandeau.ts` ; `Travail` de `stores/suivi.ts`.
- Produit :
  - `lireAcquittement(): Promise<string | null>`
  - `ecrireAcquittement(id: string): Promise<void>`
  - `useTravailActif(): { travail: Travail | null; acquitte: (id: string) => Promise<void> }`

- [x] **Étape 1 : le stockage de l'acquittement**

Créer `mobile/stores/acquittement.ts` :

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Dernier travail clos dont on a vu le bilan.
 *
 * Volontairement local à l'appareil, et non une colonne en base : une fois le
 * foyer partagé, que quelqu'un d'autre ait vu le bilan ne signifiera pas que
 * moi je l'ai vu.
 */
const CLE = 'courses.travail_acquitte';

export async function lireAcquittement(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CLE);
  } catch (e) {
    // Un stockage illisible ne doit pas empêcher le bandeau de fonctionner :
    // au pire on remontre un bilan déjà vu.
    console.error('[acquittement:lire]', e);
    return null;
  }
}

export async function ecrireAcquittement(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CLE, id);
  } catch (e) {
    console.error('[acquittement:ecrire]', e);
  }
}
```

- [x] **Étape 2 : le hook du travail actif**

Ajouter à la fin de `mobile/stores/suivi.ts` :

```ts
/**
 * Suit le travail à signaler, quel qu'il soit.
 *
 * Distinct de `useSuiviTravail`, qui suit un travail dont on connaît déjà
 * l'identifiant : ici on ne le connaît pas, et la requête comme l'abonnement
 * en diffèrent.
 *
 * L'abonnement ne porte aucun filtre d'identifiant ; RLS garantit que seuls
 * les travaux de l'utilisateur remontent. `cart_jobs` est déjà publiée dans
 * `supabase_realtime` — vérifié le 22/08.
 */
export function useTravailActif() {
  const [travail, setTravail] = useState<Travail | null>(null);
  const [dernierAcquitte, setDernierAcquitte] = useState<string | null>(null);

  const relire = useCallback(async () => {
    const { data, error } = await supabase
      .from('cart_jobs')
      .select('id, status, progress, results, error')
      .in('status', [...ETATS_ACTIFS, 'done', 'failed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('[travailActif]', error);
      return;
    }
    setTravail((data as Travail) ?? null);
  }, []);

  useEffect(() => {
    let vivant = true;
    lireAcquittement().then((v) => { if (vivant) setDernierAcquitte(v); });
    relire();

    const canal = supabase
      .channel('travail-actif')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cart_jobs' },
        // On relit plutôt que de se fier à la charge de l'événement : une
        // insertion et une mise à jour n'ont pas la même forme, et le travail
        // le plus récent peut changer d'identité.
        () => { if (vivant) relire(); },
      )
      .subscribe();

    return () => {
      vivant = false;
      supabase.removeChannel(canal);
    };
  }, [relire]);

  const acquitte = useCallback(async (id: string) => {
    await ecrireAcquittement(id);
    setDernierAcquitte(id);
  }, []);

  const aMontrer = doitAfficher(travail, dernierAcquitte) ? travail : null;
  return { travail: aMontrer, acquitte };
}
```

Ajouter les imports en tête du fichier :

```ts
import { useCallback } from 'react';
import { doitAfficher, ETATS_ACTIFS } from '../lib/suivi-bandeau.ts';
import { lireAcquittement, ecrireAcquittement } from './acquittement';
```

`useCallback` rejoint l'import de React existant.

- [x] **Étape 3 : vérifier**

```bash
npx tsc --noEmit
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
```

Attendu : aucune erreur, `# fail 0`.

- [x] **Étape 4 : commit**

```bash
git add mobile/stores/acquittement.ts mobile/stores/suivi.ts
git commit -m "feat: suivi du travail actif et acquittement local"
```

---

### Tâche 3 : sortir le suivi du wizard

**Fichiers :**
- Créer : `mobile/app/(tabs)/suivi/[id].tsx`
- Créer : `mobile/app/(tabs)/suivi/_layout.tsx`
- Modifier : `mobile/components/wizard/EtapeGeneration.tsx`

**Interfaces :**
- Consomme : `useSuiviTravail`, `useTravailActif` ; `libelleEtat`, `libelleDrive`, `resume` ; `estClos`.

- [x] **Étape 1 : la pile**

Créer `mobile/app/(tabs)/suivi/_layout.tsx` :

```tsx
import { Stack } from 'expo-router';

export default function SuiviLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [x] **Étape 2 : l'écran autonome**

Créer `mobile/app/(tabs)/suivi/[id].tsx`. Il reprend ce qu'affichait
`EtapeGeneration` après l'envoi, sans dépendre du contexte du wizard :

- `libelleEtat(travail.status)` en titre, `resume(travail)` en dessous ;
- la liste des produits non ajoutés, tirée de `travail.results`, chacun avec son
  enseigne par `libelleDrive` ;
- un bouton **Terminer** qui ramène à l'accueil.

**L'ouverture acquitte le travail s'il est clos** — `estClos(travail.status)` —
par `acquitte(travail.id)` de `useTravailActif`. C'est ce geste qui fait
disparaître le bandeau.

États : chargement, travail introuvable avec
`<EtatVide titre="Suivi introuvable">`.

- [x] **Étape 3 : le wizard redirige au lieu d'afficher**

Dans `mobile/components/wizard/EtapeGeneration.tsx`, remplacer tout le bloc
`if (jobId) { … }` — l'écran de suivi intégré — par une redirection :

```tsx
    if (r.ok && r.id) {
      // Le suivi vit désormais dans son propre écran : le bandeau doit pouvoir
      // y mener depuis n'importe où, ce qu'un écran interne au wizard ne
      // permettait pas.
      w.reinitialiser();
      router.replace(`/suivi/${r.id}`);
      return;
    }
```

Retirer alors `useSuiviTravail`, `libelleEtat`, `libelleDrive`, `resume`, l'état
`jobId` et les styles devenus inutiles — `suivi`, `manquants`, `manquantsTitre`,
`manquant`, `confirmeTitre`, `confirmeCorps`.

- [x] **Étape 4 : régénérer les types de routes**

expo-router engendre ses types au démarrage du serveur. La route `/suivi/[id]`
est nouvelle :

```bash
AVANT=$(stat -f %m .expo/types/router.d.ts)
npx expo start --port 8099 > /tmp/expo-types.log 2>&1 &
PID=$!
for i in $(seq 1 40); do
  A=$(stat -f %m .expo/types/router.d.ts 2>/dev/null || echo 0)
  [ "$A" != "$AVANT" ] && break
  perl -e 'select(undef,undef,undef,0.5)'
done
kill $PID 2>/dev/null
grep -c "suivi" .expo/types/router.d.ts
```

Attendu : un compte supérieur à zéro. Sans cette régénération, `router.replace`
vers `/suivi/…` échoue au typage.

- [x] **Étape 5 : vérifier**

```bash
npx tsc --noEmit
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
```

Attendu : aucune erreur, `# fail 0`.

- [x] **Étape 6 : commit**

```bash
git add "mobile/app/(tabs)/suivi" mobile/components/wizard/EtapeGeneration.tsx
git commit -m "feat: le suivi devient un écran autonome"
```

---

### Tâche 4 : le bandeau

**Fichiers :**
- Créer : `mobile/components/BandeauSuivi.tsx`
- Modifier : `mobile/app/(tabs)/_layout.tsx`

**Interfaces :**
- Consomme : `useTravailActif` ; `libelleDrive`, `resume` ; `estActif`, `estClos`.

- [x] **Étape 1 : écrire le bandeau**

Créer `mobile/components/BandeauSuivi.tsx`.

Il n'affiche rien quand `useTravailActif()` rend `travail === null`. Sinon, une
bande touchable menant à `/suivi/${travail.id}`, avec quatre visages :

| Statut | Texte | Fond | Animation |
|---|---|---|---|
| `pending`, `claimed` | « Ta liste attend sur ton Mac » | `colors.accentSoft` | balayage |
| `running` | `resume(travail)` | `colors.accentSoft` | barre de progression réelle |
| `needs_action` | `travail.error` ou « Ton intervention est nécessaire » | teinte d'alerte | aucune |
| `done` | « Panier rempli » | `colors.accentSoft` | aucune |
| `failed` | « Le remplissage a échoué » | teinte d'alerte | aucune |

**Le balayage.** Une bande claire de 120 points translatée d'un bord à l'autre,
en boucle, par `Animated.loop(Animated.timing(...))` avec
`useNativeDriver: true` — la translation tourne alors hors du fil JavaScript.

Elle ne démarre **que** pour `pending` et `claimed`, et s'arrête au démontage
comme au changement d'état :

```tsx
  useEffect(() => {
    if (!enAttente) return undefined;
    const boucle = Animated.loop(
      Animated.timing(balayage, {
        toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: true,
      }),
    );
    boucle.start();
    // Une boucle laissée tourner survivrait au démontage et continuerait de
    // consommer pour un bandeau qui n'existe plus.
    return () => { boucle.stop(); balayage.setValue(0); };
  }, [enAttente, balayage]);
```

**La barre de progression** en `running` : une vue dont la largeur vaut
`fait / total`, sans animation. La progression est l'information ; un mouvement
par-dessus la brouillerait. Si `total` vaut zéro ou manque, aucune barre — pas
une barre pleine, qui mentirait.

- [x] **Étape 2 : le poser au-dessus des onglets**

Dans `mobile/app/(tabs)/_layout.tsx`, envelopper `<Tabs>` :

```tsx
export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs screenOptions={{ /* inchangé */ }}>
        {/* écrans inchangés */}
      </Tabs>
      <BandeauSuivi />
    </View>
  );
}
```

Le bandeau se pose en `position: 'absolute'` juste au-dessus de la barre
d'onglets — `bottom` valant la hauteur de celle-ci, obtenue par
`useSafeAreaInsets().bottom + 49`, la hauteur standard d'une barre d'onglets iOS.

- [x] **Étape 3 : vérifier**

```bash
npx tsc --noEmit
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
```

Attendu : aucune erreur, `# fail 0`.

- [x] **Étape 4 : commit**

```bash
git add mobile/components/BandeauSuivi.tsx "mobile/app/(tabs)/_layout.tsx"
git commit -m "feat: bandeau de suivi visible depuis tous les écrans"
```

---

### Tâche 5 : livrer

- [x] **Étape 1 : vérification complète**

```bash
npx tsc --noEmit
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
npx expo-doctor
```

Attendu : aucune erreur TypeScript, `# fail 0`, expo-doctor sans échec autre que
les deux connus — CocoaPods local et l'avertissement CNG.

- [x] **Étape 2 : vérifier le bundle, comme la CI**

```bash
EXPO_PUBLIC_SUPABASE_URL="https://qmymwicsgilhoihtfdjm.supabase.co" \
EXPO_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_PueJWmalqhZO0ctPu95GKQ_EaAgVulr" \
npx expo export --platform ios --output-dir /tmp/export-bandeau
```

Attendu : `Exported:` sans erreur.

- [x] **Étape 3 : pousser**

```bash
git push origin mobile/expo-scan
```

- [x] **Étape 4 : suivre le build**

Avec `asc.mjs`, en **triant explicitement** : l'API ne rend pas les exécutions de
la plus récente à la plus ancienne, et `limit=1` renvoie la première, pas la
dernière — piège rencontré le 22/08.

```bash
ASC_KEY_ID=AYC86383MB \
ASC_ISSUER_ID=a725aaeb-78b3-44bb-80ee-018ca724ba5f \
ASC_KEY_PATH="$HOME/.appstoreconnect/AuthKey_AYC86383MB.p8" \
node asc.mjs "/v1/ciProducts/4ece9928-69b5-4a0a-a0cc-bdd408d09a57/buildRuns?limit=10"
```

- [ ] **Étape 5 : éprouver sur l'appareil**

1. Envoyer une liste depuis le wizard : l'écran de suivi s'ouvre directement.
2. Aller sur l'onglet Produits : le bandeau est là, avec son balayage.
3. Lancer le remplissage depuis l'extension : le bandeau passe en progression.
4. À la fin, il passe au vert et **reste**.
5. Le toucher : le bilan s'ouvre, et le bandeau disparaît.
6. Redémarrer l'application : il ne revient pas.

## Ce que ce plan ne fait pas

- Les notifications système à la fin d'un remplissage.
- L'annulation depuis le bandeau.
- Le compte et le partage du foyer.
- L'import de recettes.
