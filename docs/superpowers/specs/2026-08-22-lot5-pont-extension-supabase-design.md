# Lot 5 — Pont entre l'application mobile et l'extension

**Date :** 22 août 2026
**Statut :** validé, prêt pour le plan d'implémentation

## Objet

Fermer la boucle. Le wizard écrit depuis hier ses listes dans `cart_jobs`, où
rien ne les lit. Ce lot donne à l'extension de quoi les relever, remplir le
panier, et rendre compte.

C'est l'angle mort assumé de la spécification du 22/08 : « terminer le wizard
n'aura aucun effet visible sur le Mac ». Il se referme ici.

## Décisions structurantes

| Question | Décision |
|---|---|
| Deux drives dans une même liste | Enchaînés automatiquement, avec arrêt propre si le second n'est pas prêt |
| Authentification de l'extension | E-mail et mot de passe dans le popup, jeton gardé localement |
| Suivi sur le téléphone | Écran de suivi en temps réel |
| Client Supabase dans l'extension | Appels REST directs, **sans bundler** |
| Réveil de l'extension | `chrome.alarms`, **pas de temps réel** |
| Saisie manuelle | **Conservée** — voir « Ce qui ne disparaît pas » |

## Deux contraintes de plateforme qui décident de l'architecture

**Un service worker Manifest V3 ne peut pas maintenir d'abonnement temps réel.**
Chrome le termine après une trentaine de secondes d'inactivité ; un WebSocket
n'y survit pas. La spécification du 18/08 prévoyait que l'extension « s'abonne à
`cart_jobs` » — ce n'est pas tenable. `chrome.alarms` réveille le worker à
intervalle régulier ; pour une commande mensuelle, une minute de latence ne se
voit pas.

**L'extension n'a aucune chaîne de compilation.** Ce sont des modules ES chargés
tels quels, et elle s'installe en dossier non empaqueté. Ajouter `supabase-js`
imposerait un bundler et changerait la façon de l'installer. Tout ce dont on a
besoin — jeton, lecture, écriture — tient en quelques `fetch` sur l'API REST.

Le temps réel reste employé **côté téléphone**, où React Native n'a aucune de ces
contraintes. La table `cart_jobs` est déjà publiée dans `supabase_realtime` :
vérifié le 22/08, rien à activer.

## Architecture

```
iPhone                    Supabase                      Extension (Mac)
wizard      ──────────►   cart_jobs : pending   ──────►  alarme, pastille
écran suivi ◄─ realtime   claimed → running → done ◄───  progression
                          product_equivalents    ◄──────  « Choisir », absences
```

## Ce qu'il faut ouvrir en base

Une politique RLS autorise le propriétaire à faire avancer son propre travail :
`pending` → `claimed` → `running` → `done` / `failed` / `needs_action`, en
écrivant `progress`, `results`, `error`, `claimed_at` et `finished_at`.

Elle interdit de modifier `items` et `user_id` : une liste validée sur le
téléphone ne doit pas pouvoir changer sous les pieds de son auteur.

La politique d'annulation existante est conservée. Elle couvre le cas où tu
annules depuis le téléphone pendant que le Mac travaille.

La contrainte de statut prévoit déjà les sept valeurs nécessaires, `claimed` et
`needs_action` compris. Rien à y ajouter.

## Le trou laissé par le lot 4

`product_equivalents.product_id` est **obligatoire**, mais la liste écrite dans
`cart_jobs.items` ne porte que `name`, `quantity`, `unit`, `ean13` et
`category`. Sans identifiant de produit, aucune équivalence ne peut être
enregistrée — et c'est tout l'intérêt de ce lot.

`product_id` entre donc dans `LigneConsolidee`, dans `ItemPanier` et dans la
consolidation.

**Un cas doit être tranché explicitement.** `buildConsolidatedItems` fusionne les
lignes par nom et unité. Deux produits distincts portant le même nom n'en font
alors qu'un, et leurs identifiants entrent en concurrence. La règle retenue : la
ligne garde le `product_id` de la **première** origine rencontrée, et passe à
`null` dès qu'une seconde origine apporte un identifiant différent. Une
équivalence ne s'écrit que sur une ligne dont l'origine est certaine — mieux vaut
ne rien mémoriser que de mémoriser un rapprochement faux, qui se rejouerait à
chaque commande.

## L'extension

### Un client REST, sans dépendance

Un module `extension/supabase.js` :

| Fonction | Appel |
|---|---|
| `connexion(email, motDePasse)` | `POST /auth/v1/token?grant_type=password` |
| `rafraichir()` | `POST /auth/v1/token?grant_type=refresh_token` |
| `travauxEnAttente()` | `GET /rest/v1/cart_jobs?status=eq.pending` |
| `revendiquer(id)` | `PATCH` — `claimed`, `claimed_at` |
| `progresser(id, avancement)` | `PATCH` — `progress` |
| `terminer(id, statut, resultats)` | `PATCH` — statut final, `results`, `finished_at` |
| `equivalences(drive)` | `GET /rest/v1/product_equivalents?drive=eq.…` |
| `enregistrerEquivalence(…)` | `POST` avec résolution de conflit sur (`user_id`, `product_id`, `drive`) |

La session — jeton d'accès, jeton de rafraîchissement, échéance — vit dans
`chrome.storage.local`. Le jeton est rafraîchi lorsqu'il expire dans moins d'une
minute, jamais à chaque appel.

Le domaine du projet Supabase entre dans `host_permissions`.

### Le réveil et la pastille

`chrome.alarms` réveille le worker chaque minute. S'il trouve un travail en
attente, la pastille de l'icône affiche le nombre d'articles.

**Un seul travail est traité à la fois, le plus ancien d'abord.** Rien
n'empêche d'en envoyer deux depuis le téléphone ; les traiter en parallèle
ferait se disputer le même onglet. Si plusieurs attendent, la pastille compte
les articles du plus ancien et le popup indique combien suivent.

**Un travail `claimed` depuis plus de trente minutes redevient disponible.**
Sans cela, une extension fermée en plein remplissage laisserait la liste
bloquée pour toujours, sans qu'aucun écran n'explique pourquoi.

**Rien ne démarre sans un clic.** Le popup montre la liste en attente et son
enseigne ; le remplissage commence quand tu le demandes. Une extension qui
piloterait un site marchand sans qu'on l'ait déclenchée serait une mauvaise
surprise, et c'est contraire à ce que promet le README depuis le début.

### Les deux drives enchaînés

L'extension remplit le drive du premier élément de `drives`, puis navigue vers le
second et poursuit.

**Le garde-fou compte autant que la fonctionnalité.** Enchaîner suppose que tu
sois connecté aux deux enseignes et que tu aies choisi ton magasin des deux
côtés. Si le second n'est pas prêt — session absente, magasin non choisi,
vérification anti-robot — l'extension s'arrête, passe le travail en
**`needs_action`**, et consigne dans `results` ce qui a été fait chez le premier.

Elle ne marque jamais `done` un travail qu'elle n'a pas terminé.

### Les équivalences, qui rendent les commandes suivantes déterministes

Avant de chercher un produit, l'extension consulte `product_equivalents` pour le
couple (produit, enseigne) :

| Ce qui est mémorisé | Ce qu'elle fait |
|---|---|
| `product_url` | va droit à la fiche, sans recherche |
| `matched_label` | cherche et retient exactement ce libellé, sans score |
| `unavailable` | passe le produit et le signale au bilan |

Et elle enrichit la table à mesure : un « Choisir » enregistre l'équivalence avec
le libellé retenu, l'adresse de la fiche et le code-barres si le site l'expose ;
un produit qu'aucune recherche ne trouve enregistre son indisponibilité.

C'est le mécanisme décrit le 18/08 : « trancher une ambiguïté une seule fois,
les commandes suivantes sont déterministes des deux côtés ». Chez Carrefour
l'accès par code-barres suffisait déjà ; **chez Leclerc, dont les liens produit
n'ont pas d'adresse lisible, `matched_label` est la seule voie**.

## L'écran de suivi

L'écran de confirmation du wizard cesse d'être un cul-de-sac. Après l'envoi, il
s'abonne au travail et montre :

- l'avancement en cours — « 12 sur 34 chez Carrefour » ; le compte porte sur
  les articles de l'enseigne en cours, pas sur le total des deux, qui donnerait
  une progression trompeuse quand la première enseigne est finie ;
- le bilan à la fin, avec la liste de ce qui n'a pas été trouvé ;
- l'état `needs_action` expliqué en clair, avec ce qu'il reste à faire.

Trois états à couvrir : en attente de reprise par le Mac, en cours, terminé.

## Ce qui ne disparaît pas

**Le champ de saisie manuelle du popup reste.** La spécification du 18/08
annonçait sa disparition — « le copier-coller disparaît, et avec lui le format
texte `[EAN] Nom x2` ». On le garde.

La raison est prudentielle : c'est le seul recours quand Supabase est injoignable,
quand la session a expiré, ou quand on veut remplir un panier sans passer par le
wizard. Le retirer échangerait une commodité contre une panne sans issue.

## Ce qui ne change pas non plus

**Aucun identifiant de drive n'est stocké**, ni maintenant ni plus tard.
L'extension continue de travailler dans la session que tu as ouverte toi-même.

**Rien n'est construit pour masquer le caractère automatisé du navigateur** :
ni empreinte falsifiée, ni `navigator.webdriver` dissimulé, ni résolution de
captcha. Sur un challenge, l'extension s'arrête et rend la main — désormais en
marquant le travail `needs_action` plutôt qu'en se contentant d'une notification.

**L'extension ne valide jamais de commande** et ne paie rien.

## Tests

- **Client REST** : expiration et rafraîchissement du jeton, réponse d'erreur
  d'authentification, absence de session.
- **Sélection d'équivalence** : adresse connue, libellé connu, indisponible,
  rien de mémorisé — les quatre chemins.
- **Fusion et `product_id`** : deux origines de même nom et d'identifiants
  différents doivent produire `null`, pas le premier venu.
- **Mise en forme de la progression** écrite dans `cart_jobs`.
- Les tests de correspondance existants de l'extension ne changent pas.

## Ce qui n'est pas construit

- **Le lot 6** : retrait de FastAPI et du front web.
- **L'import de recettes** par lien ou par OCR, conçu à part.
- **Le partage du foyer**, qui a sa propre conception à venir.
- **La reprise automatique** d'un travail `needs_action` : c'est un clic humain
  qui la déclenche, comme pour le premier départ.
