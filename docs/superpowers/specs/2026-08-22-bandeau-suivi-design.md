# Bandeau de suivi persistant

**Date :** 22 août 2026
**Statut :** validé, prêt pour le plan d'implémentation

## Objet

Rendre visible depuis n'importe quel écran qu'un remplissage de panier attend
d'être lancé, tourne, ou vient de finir — comme le fait Uber Eats pour une
commande.

Aujourd'hui, cette information n'existe que dans la dernière étape du wizard.
Qui la quitte ne sait plus rien, alors que le remplissage dure plusieurs minutes
et se passe sur une autre machine.

## Décisions structurantes

| Question | Décision |
|---|---|
| Fin du remplissage | Le bandeau reste jusqu'à ce qu'on l'ouvre |
| Animation d'attente | Un balayage clair traversant le bandeau |
| Acquittement | Local à l'appareil, dans `AsyncStorage` |
| Écran de suivi | Extrait du wizard, autonome |

## Ce qu'il faut déplacer d'abord

Le suivi vit aujourd'hui dans `components/wizard/EtapeGeneration.tsx` et dépend
du contexte du wizard. Un bandeau touché depuis l'onglet Produits ne peut pas y
mener.

Le suivi devient donc un écran autonome, `/suivi/[id]`. `EtapeGeneration` cesse
d'afficher le bilan : après l'envoi, il redirige vers cet écran. Ce déplacement
n'est pas un supplément, c'est la condition du bandeau.

De même, `useSuiviTravail(jobId)` suit un travail dont on connaît l'identifiant.
Le bandeau doit suivre « le travail actif, quel qu'il soit » : c'est une autre
requête et un autre abonnement, d'où un hook distinct plutôt qu'un paramètre de
plus.

## Le travail actif

`useTravailActif()` cherche le travail le plus récent qui soit :

- **non clos** — `pending`, `claimed`, `running` ou `needs_action` ; ou
- **clos mais pas acquitté** — `done` ou `failed`, et son identifiant ne
  correspond pas au dernier acquittement retenu.

Il s'abonne aux changements de `cart_jobs` sans filtre d'identifiant ; RLS
garantit que seuls les travaux de l'utilisateur remontent. La table est déjà
publiée dans `supabase_realtime` — vérifié le 22/08.

## Le bandeau

Une bande posée **au-dessus de la barre d'onglets**, sur tous les écrans de la
zone `(tabs)`. Quatre visages :

| État | Texte | Animation |
|---|---|---|
| `pending`, `claimed` | « Ta liste attend sur ton Mac » | balayage |
| `running` | « 12 sur 34 chez Carrefour » | barre de progression réelle |
| `needs_action` | le message d'erreur du travail, en ton d'alerte | aucune |
| `done`, `failed` | « Panier rempli » ou l'échec, en vert ou en rouge | aucune |

**Le balayage n'anime que l'attente.** En cours, la progression *est*
l'information ; une animation par-dessus la brouillerait. Terminé, il n'y a plus
rien à attendre.

### L'animation

Une bande claire translatée d'un bord à l'autre, en boucle, par `Animated` du
cœur de React Native avec `useNativeDriver: true` : la translation tourne alors
hors du fil JavaScript et ne coûte presque rien. `react-native-reanimated`
n'apporterait rien ici — il sert aux gestes, pas aux boucles simples.

L'animation s'arrête quand le bandeau quitte l'état d'attente, et à la
disparition du composant : une boucle laissée tourner survivrait au démontage.

## L'acquittement

Toucher le bandeau ouvre `/suivi/[id]`. Si le travail y est clos, l'ouverture
l'acquitte : son identifiant est retenu sous la clé `courses.travail_acquitte`
dans `AsyncStorage`, et le bandeau disparaît.

**Pas de colonne en base.** L'acquittement est propre à l'appareil, et ce sera
encore plus juste une fois le foyer partagé : que quelqu'un d'autre ait vu le
bilan ne signifie pas que toi tu l'as vu.

## Tests

La décision d'afficher est une fonction pure, donc testable :

`doitAfficher(travail, dernierAcquitte)` — les quatre états actifs affichent, un
travail clos non acquitté affiche, le même une fois acquitté n'affiche plus,
l'absence de travail n'affiche rien.

Les textes du bandeau réutilisent `libelleEtat` et `resume` de
`lib/suivi-libelles.ts`, déjà couverts.

## Ce qui n'est pas construit

- **Une notification système** quand le remplissage finit. Le bandeau suppose
  l'application ouverte ; les notifications demanderaient `expo-notifications`,
  un nouveau `prebuild`, et l'autorisation correspondante.
- **L'annulation depuis le bandeau.** La politique RLS d'annulation existe, mais
  un geste destructeur à portée de pouce sur tous les écrans est une mauvaise
  idée.
- **Le compte et le partage du foyer.**
- **L'import de recettes.**
