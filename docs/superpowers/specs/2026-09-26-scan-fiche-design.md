# Import d'une recette par photo de fiche

**Date :** 26 septembre 2026
**Statut :** construit, en attente du secret `ANTHROPIC_API_KEY` et du déploiement

## Objet

Photographier une fiche recette papier — HelloFresh, livre, carnet — et la créer
sans ressaisir ses ingrédients. C'est le « chantier suivant » annoncé par
`2026-08-22-import-recettes-design.md`.

## Décisions structurantes

| Question | Décision |
|---|---|
| Qui lit la photo | Claude (vision), appelé par une fonction Edge `lire-fiche` |
| Pourquoi pas un OCR sur l'appareil | Une fiche HelloFresh a deux colonnes, un tableau, une section « à ajouter vous-même » : un OCR rend du texte en vrac, pas des ingrédients |
| Format rendu | Des lignes « 500 g de pommes de terre », comme une page de recette |
| Où vit la clé | Secret Supabase ; elle ne transite jamais par le téléphone |
| Qui peut appeler | Un membre d'un foyer (`mon_foyer()`), chaque lecture étant facturée |
| Où vit la consigne | Dans la fonction Edge : la corriger ne demande pas de build |

## Le partage des rôles

Le même que pour l'import par lien.

**`lire-fiche`** reçoit la photo en base64, l'envoie à Claude avec une sortie
structurée (`lisible`, `nom`, `parts`, `ingredients[]`) et rend cette réponse
telle quelle.

**L'application** la valide (`lib/fiche-recette.ts`, fonction pure testée), puis
chaque ligne passe par le même `analyserLigne` et le même aperçu que l'import
par lien. Rien n'est enregistré avant validation ; une ligne sans quantité
(« sel ») reste signalée « à vérifier ».

## Parcours

Écran « Importer une recette » : « Prendre en photo » ou « Photothèque », puis
l'aperçu habituel. Pas de recadrage — sur iOS il impose un carré qui couperait
la colonne des ingrédients. Qualité 0.5 : le texte reste net et l'image passe
sous le plafond de 5 Mo de l'API.

## Mise en service

```bash
supabase secrets set ANTHROPIC_API_KEY=... --project-ref qmymwicsgilhoihtfdjm
supabase functions deploy lire-fiche --project-ref qmymwicsgilhoihtfdjm
```

`ANTHROPIC_MODEL` est facultatif (défaut : `claude-opus-5`). Sans le secret,
la fonction répond « La lecture de photo n'est pas encore activée. »

## Ce qui n'est pas construit

- Plusieurs photos pour une même recette (recto et verso).
- Les étapes de préparation : l'application ne les stocke pas.
