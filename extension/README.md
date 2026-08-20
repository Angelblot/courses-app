# Extension « Courses » — remplissage de panier

Remplit le panier d'un drive à partir d'une liste, **dans ton propre navigateur,
sur ta session déjà connectée**.

## Pourquoi une extension et pas un worker

Carrefour et Leclerc Drive répondent `403` à tout accès programmatique, avec un
challenge explicite (« vérifions que vous n'êtes pas un robot »). Mesures et
sources dans [`../DECISION_DRIVES.md`](../DECISION_DRIVES.md) § 5 ter.

Passer ce contrôle depuis un serveur supposerait de masquer le caractère
automatisé du navigateur. Ce n'est pas ce que fait cette extension : elle
travaille dans **ton** navigateur, où le contrôle a déjà été franchi par toi,
humain, en navigant normalement. Rien n'est falsifié. Si une vérification
apparaît en cours de route, l'extension **s'arrête et te rend la main** ; tu la
résous, tu reprends.

Concrètement : un clic pour quarante produits, au lieu de quarante allers-retours.

## Installation

1. Ouvre `chrome://extensions`
2. Active **Mode développeur** (en haut à droite)
3. **Charger l'extension non empaquetée** → sélectionne ce dossier `extension/`

## Utilisation

1. Connecte-toi normalement au site du drive et choisis ton magasin — une fois,
   à la main.
2. Clique l'icône de l'extension.
3. Choisis l'enseigne, colle ta liste, puis **Remplir le panier**. Chaque ligne
   est soit un nom de produit, soit une **URL de fiche produit** — quantité
   optionnelle en suffixe `x2` dans les deux cas.
4. Laisse l'onglet travailler. Le popup affiche la progression et ce qui n'a pas
   été trouvé.
5. Vérifie le panier et paie **toi-même** sur le site : l'extension ne valide
   jamais de commande.

## Première utilisation : calibrer les sélecteurs

**Carrefour et Leclerc sont tous deux calibrés** sur des rapports de diagnostic
réels (18/08/2026).

Une différence importante entre les deux : chez Carrefour, l'EAN figure dans
l'URL des fiches, ce qui permet l'accès direct au produit. **Chez Leclerc, les
liens produit n'ont pas de href** — la navigation est pilotée en JavaScript, et
aucun code-barres n'est lisible dans l'adresse. La recherche par nom, avec son
score et sa détection d'ambiguïté, y reste donc la seule voie.

Les sélecteurs de `content/sites.js` ne peuvent pas être validés
automatiquement, puisque les deux sites refusent l'accès programmatique. Ils
sont donnés en listes de candidats et se calibrent en une passe :

1. Va sur une page de résultats de recherche du drive, connecté.
2. Ouvre l'extension → **Diagnostiquer cette page**.
3. Le rapport indique, pour chaque sélecteur candidat, combien d'éléments il
   trouve, et un échantillon de titres lus.
4. Reporte les sélecteurs qui renvoient un nombre cohérent (≈ le nombre de
   produits affichés) en tête des listes de `content/sites.js`.

Attention au piège rencontré : `innerText` renvoie une chaîne vide pour un
élément non rendu (carrousel hors écran). Un diagnostic lancé sur la page
d'accueil affiche donc des titres vides alors que les sélecteurs sont bons.
Lance-le sur une page qui affiche vraiment des produits.

Attends-toi à devoir refaire ce réglage après une refonte du site : beaucoup de
classes CSS y sont générées à la compilation et changent à chaque déploiement.

## Viser un produit précis

La recherche par nom reste approximative : « Lardons fumés » ne se distingue pas
de « Lardons fumés BIO » ni de « Lardons fumés allégés ». Trois garde-fous :

1. **Départage automatique** — à score égal, le produit ayant le moins de mots
   superflus l'emporte. Demander « lardons fumés bio » sélectionne bien le bio.
   Les grammages sont normalisés : « 500g » et « 500 g » se rejoignent.
   Un terme qu'aucun résultat ne porte — une marque que le rayon ne référence
   pas — est écarté plutôt que de condamner la liste ; le journal l'indique
   alors par « sans « herta » ». Cet écart n'est toléré que si l'essentiel de
   la recherche reste couvert : chercher « saumon fumé » ne peut pas retomber
   sur des lardons.
2. **Aveu d'ambiguïté** — deux candidats indiscernables ne sont pas départagés
   au hasard. La ligne est signalée et les trois meilleurs résultats sont
   listés, chacun avec un bouton **Choisir** : un clic revient sur la page de
   recherche et ajoute exactement ce produit. C'est le cas courant quand tu
   demandes une marque que ton rayon ne propose pas — mieux vaut choisir
   soi-même qu'obtenir une autre marque sans le savoir.
3. **URL de fiche** — la seule méthode sûre. Colle l'adresse du produit dans la
   liste : l'extension y va directement, sans passer par la recherche.

**Avec un code EAN, il n'y a plus de recherche du tout.** Le segment textuel
d'une URL de fiche Carrefour est décoratif : `/p/x-3443660013046` ouvre le bon
produit. L'extension construit donc l'adresse à partir du code-barres et s'y
rend directement — aucune recherche, aucun libellé à interpréter, aucune
ambiguïté possible.

L'application préfixe automatiquement chaque ligne d'un `[3760040427577]`, les
65 produits en base ayant un EAN13. Le journal signale ces ajouts par la
mention « par code-barres » : ce sont les seuls qui soient certains.

Si la fiche n'existe pas ou si le produit n'est pas proposé par ton drive,
l'extension retombe automatiquement sur la recherche par nom, avec son score et
sa détection d'ambiguïté.

À noter : *rechercher* un code-barres ne donne rien (0 résultat, Carrefour
n'indexe pas les EAN). C'est bien l'URL, et elle seule, qui les exploite.

## Sécurité et limites

- **Aucun mot de passe n'est stocké ni demandé.** L'extension utilise la session
  de ton navigateur, rien d'autre.
- **Elle ne paie jamais** et ne valide aucune commande.
- Elle ne contourne aucune protection : sur un challenge, elle s'arrête.
- L'accès automatisé peut contrevenir aux CGU des enseignes. Usage familial,
  à ton appréciation.
- Rythme volontairement lent (2,5 s entre deux produits) pour rester proche
  d'une navigation humaine.

## Tests

```bash
node test-matching.mjs
```

Couvre l'analyse de la liste saisie et le score de correspondance — les deux
endroits où une erreur ferait entrer le mauvais produit dans le panier. Le seuil
d'acceptation est volontairement exigeant (0,75, pondéré par la longueur des
mots) : mieux vaut signaler un produit manquant que d'en ajouter un faux.

## Architecture

| Fichier | Rôle |
|---|---|
| `background.js` | Orchestrateur. Pilote l'onglet et enchaîne les produits — une navigation détruit les scripts injectés, le pilote doit donc rester extérieur. |
| `content/page-agent.js` | Injecté par produit : trouve la carte, score les titres, clique « Ajouter ». |
| `content/sites.js` | Sélecteurs et URL par enseigne. **C'est le seul fichier à retoucher** quand un site change. |
| `popup.*` | Lancement, progression, diagnostic. |
