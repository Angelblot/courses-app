import { useState } from 'react';
import {
  ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { filtrerCatalogue } from '../lib/recettes-affichage.ts';
import { rechercherParNom, type FicheProduit } from '../lib/openfoodfacts.ts';
import { rayonDepuisLibelle, type CleRayon } from '../lib/rayons.ts';
import { useProducts, ajouterProduit, type Product } from '../stores/products';
import { PastilleNutri } from './PastilleNutri';
import { colors, radius, spacing } from '../lib/theme';

export type ChoixIngredient = {
  name: string;
  product_id: string | null;
  unit: string;
  rayon: CleRayon;
};

type Props = { onChoisir: (choix: ChoixIngredient) => void; onFermer: () => void };

const MAX_CATALOGUE = 8;

function depuisProduit(p: Product): ChoixIngredient {
  return {
    name: p.name,
    product_id: p.id,
    unit: p.unit ?? 'unité',
    rayon: rayonDepuisLibelle(p.category),
  };
}

export function SelecteurIngredient({ onChoisir, onFermer }: Props) {
  const { produits, recharger } = useProducts();
  const [requete, setRequete] = useState('');
  const [enRecherche, setEnRecherche] = useState(false);
  const [resultatsOff, setResultatsOff] = useState<FicheProduit[] | null>(null);
  const [messageOff, setMessageOff] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const duCatalogue = filtrerCatalogue(produits, requete).slice(0, MAX_CATALOGUE);
  const assezLong = requete.trim().length >= 3;

  /** Jamais déclenchée à la frappe : Open Food Facts est gratuit et fragile. */
  const chercherOff = async () => {
    setEnRecherche(true);
    setMessageOff(null);
    setResultatsOff(null);
    const r = await rechercherParNom(requete);
    setEnRecherche(false);
    if (r.etat === 'trouve') setResultatsOff(r.fiches);
    else if (r.etat === 'vide') setMessageOff('Aucun résultat pour cette recherche.');
    else setMessageOff('Open Food Facts est injoignable. Ton catalogue reste utilisable.');
  };

  const choisirFiche = async (fiche: FicheProduit) => {
    // Un code-barres déjà connu ne doit pas créer un doublon : on rattache
    // l'ingrédient au produit existant sans rien insérer.
    const existant = produits.find((p) => p.ean13 && p.ean13 === fiche.ean13);
    if (existant) {
      onChoisir(depuisProduit(existant));
      return;
    }
    setErreur(null);
    const r = await ajouterProduit(fiche);
    if (r.ok && r.produit) {
      await recharger();
      onChoisir(depuisProduit(r.produit));
      return;
    }
    if (r.doublon) {
      onChoisir(depuisProduit(r.doublon));
      return;
    }
    setErreur(r.erreur ?? "Impossible d'ajouter ce produit au catalogue.");
  };

  return (
    <View style={s.feuille}>
      <View style={s.entete}>
        <Text style={s.titre}>Ajouter un ingrédient</Text>
        <Pressable onPress={onFermer} hitSlop={8}>
          <Text style={s.fermer}>Fermer</Text>
        </Pressable>
      </View>

      <TextInput
        style={s.champ}
        value={requete}
        onChangeText={setRequete}
        placeholder="Lardons, crème, spaghetti…"
        placeholderTextColor={colors.textMuted}
        autoFocus
      />

      <ScrollView style={s.liste} keyboardShouldPersistTaps="handled">
        <Text style={s.section}>Ton catalogue</Text>
        {duCatalogue.length === 0 ? (
          <Text style={s.vide}>Aucun produit ne correspond.</Text>
        ) : (
          duCatalogue.map((p) => (
            <Pressable key={p.id} style={s.ligne} onPress={() => onChoisir(depuisProduit(p))}>
              {p.image_url
                ? <Image source={{ uri: p.image_url }} style={s.vignette} resizeMode="contain" />
                : <View style={[s.vignette, s.vignetteVide]} />}
              <View style={s.ligneTexte}>
                <Text style={s.nom} numberOfLines={2}>{p.name}</Text>
                {p.brand && <Text style={s.marque}>{p.brand}</Text>}
              </View>
              <PastilleNutri note={p.nutriscore} />
            </Pressable>
          ))
        )}

        <Text style={s.section}>Open Food Facts</Text>
        <Pressable
          style={[s.bouton, !assezLong && s.desactive]}
          onPress={chercherOff}
          disabled={!assezLong || enRecherche}
        >
          {enRecherche
            ? <ActivityIndicator color={colors.accent} />
            : <Text style={s.boutonTexte}>Chercher dans Open Food Facts</Text>}
        </Pressable>
        {!assezLong && <Text style={s.vide}>Saisis au moins trois caractères.</Text>}
        {messageOff && <Text style={s.vide}>{messageOff}</Text>}

        {resultatsOff?.map((f) => {
          const deja = produits.some((p) => p.ean13 && p.ean13 === f.ean13);
          return (
            <Pressable key={f.ean13} style={s.ligne} onPress={() => choisirFiche(f)}>
              {f.imageUrl
                ? <Image source={{ uri: f.imageUrl }} style={s.vignette} resizeMode="contain" />
                : <View style={[s.vignette, s.vignetteVide]} />}
              <View style={s.ligneTexte}>
                <Text style={s.nom} numberOfLines={2}>{f.name}</Text>
                <Text style={s.marque}>
                  {[f.brand, deja ? 'déjà au catalogue' : null].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <PastilleNutri note={f.nutriscore} />
            </Pressable>
          );
        })}

        {erreur && <Text style={s.erreur}>{erreur}</Text>}

        <Text style={s.section}>À la main</Text>
        <Pressable
          style={[s.bouton, !requete.trim() && s.desactive]}
          disabled={!requete.trim()}
          onPress={() => onChoisir({
            name: requete.trim(), product_id: null, unit: 'unité', rayon: 'autre',
          })}
        >
          <Text style={s.boutonTexte}>
            {requete.trim() ? `Ajouter « ${requete.trim()} » à la main` : 'Ajouter à la main'}
          </Text>
        </Pressable>
        <Text style={s.vide}>
          Un ingrédient saisi à la main n&apos;est rattaché à aucun produit : l&apos;extension
          devra le chercher par son nom.
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  feuille: {
    flex: 1, backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    padding: spacing.lg, gap: spacing.sm,
  },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titre: { fontSize: 17, fontWeight: '700', color: colors.text },
  fermer: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  champ: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, fontSize: 16, color: colors.text, backgroundColor: colors.bg,
  },
  liste: { flex: 1 },
  section: {
    fontSize: 13, fontWeight: '800', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.4,
    marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  ligne: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  vignette: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.bg },
  vignetteVide: { borderWidth: 1, borderColor: colors.border },
  ligneTexte: { flex: 1, gap: 2 },
  nom: { fontSize: 15, fontWeight: '600', color: colors.text },
  marque: { fontSize: 12, color: colors.textMuted },
  vide: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  bouton: {
    borderWidth: 1, borderColor: colors.accent, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center',
  },
  boutonTexte: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  desactive: { opacity: 0.4, borderColor: colors.border },
  erreur: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
});
