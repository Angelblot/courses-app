import { useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useProducts } from '../../../stores/products';
import { creerRecette, recupererRecette } from '../../../stores/recipes';
import {
  UNITES, produitPropose, rayonPropose, valideBrouillon,
  type Brouillon, type IngredientBrouillon,
} from '../../../lib/recette-brouillon.ts';
import { analyserLigne } from '../../../lib/import-recette.ts';
import { libelleRayon } from '../../../lib/rayons.ts';
import { colors, radius, spacing } from '../../../lib/theme';

/**
 * Un ingrédient de l'aperçu : le brouillon, plus de quoi le vérifier.
 *
 * On garde la ligne d'origine parce que c'est le seul moyen pour l'utilisateur
 * de juger si l'analyse est juste — « 1 bouteille de vin rouge » ne se devine
 * pas depuis « 0.25 bouteille ».
 */
type LigneApercu = IngredientBrouillon & { origine: string; aVerifier: boolean };

/** Deux décimales suffisent : au-delà, « 0.3333333333 g » n'informe personne. */
const arrondi = (n: number) => Math.round(n * 100) / 100;

export default function ImporterRecette() {
  const router = useRouter();
  const { produits } = useProducts();

  const [adresse, setAdresse] = useState('');
  const [enRecuperation, setEnRecuperation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [nom, setNom] = useState('');
  const [parts, setParts] = useState('4');
  const [image, setImage] = useState<string | null>(null);
  // Repris tels quels de la page : ni saisis, ni devinés.
  const [temps, setTemps] = useState<{
    prep_minutes: number | null; cook_minutes: number | null; kcal_per_serving: number | null;
  }>({ prep_minutes: null, cook_minutes: null, kcal_per_serving: null });
  const [lignes, setLignes] = useState<LigneApercu[] | null>(null);
  const [enCours, setEnCours] = useState(false);

  const importer = async () => {
    if (enRecuperation || !adresse.trim()) return;
    setErreur(null);
    setEnRecuperation(true);
    const r = await recupererRecette(adresse);
    setEnRecuperation(false);

    if (!r.ok || !r.recette) {
      setErreur(r.erreur ?? "La recette n'a pas pu être lue.");
      return;
    }

    const nbParts = r.recette.parts;
    setNom(r.recette.nom);
    setParts(String(nbParts));
    setImage(r.recette.image);
    setTemps({
      prep_minutes: r.recette.preparationMin,
      cook_minutes: r.recette.cuissonMin,
      kcal_per_serving: r.recette.kcalParPart,
    });
    setLignes(
      r.recette.ingredients.map((origine) => {
        const a = analyserLigne(origine);
        const produit = produitPropose(a.nom, produits);
        return {
          name: a.nom || origine,
          // Le site donne des quantités totales ; la base les veut par part.
          quantity_per_serving: arrondi(a.quantite / nbParts),
          unit: a.unite,
          // Le rayon est proposé même sans produit rattaché : sa typologie
          // suffit à ranger l'ingrédient au bon endroit de la liste.
          rayon: rayonPropose(a.nom, produits),
          product_id: produit?.id ?? null,
          origine,
          aVerifier: a.aVerifier,
        };
      }),
    );
  };

  const maj = (i: number, champ: Partial<LigneApercu>) =>
    setLignes((l) => l?.map((ing, k) => (k === i ? { ...ing, ...champ } : ing)) ?? null);

  const enregistrer = async () => {
    if (enCours || !lignes) return;
    const brouillon: Brouillon = {
      name: nom,
      servings_default: Number.parseInt(parts, 10),
      ingredients: lignes.map(({ origine: _o, aVerifier: _v, ...ing }) => ing),
      image_url: image,
      ...temps,
    };
    const probleme = valideBrouillon(brouillon);
    if (probleme) { setErreur(probleme); return; }

    setErreur(null);
    setEnCours(true);
    const r = await creerRecette(brouillon);
    setEnCours(false);
    if (r.ok) router.back();
    else setErreur(r.erreur ?? "Impossible d'enregistrer la recette.");
  };

  const aVerifier = lignes?.filter((l) => l.aVerifier).length ?? 0;

  return (
    <SafeAreaView style={s.ecran}>
      <KeyboardAvoidingView style={s.ecran} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.entete}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={s.retour}>Annuler</Text>
          </Pressable>
          <Text style={s.titre}>Importer une recette</Text>
          <View style={s.equilibre} />
        </View>

        <ScrollView contentContainerStyle={s.corps} keyboardShouldPersistTaps="handled">
          <Text style={s.label}>Adresse de la recette</Text>
          <TextInput
            style={s.champ}
            value={adresse}
            onChangeText={setAdresse}
            placeholder="https://www.marmiton.org/recettes/..."
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onSubmitEditing={importer}
            returnKeyType="go"
          />
          <Text style={s.aide}>
            Colle l'adresse d'une recette. Elle sera lue, pas enregistrée : tu verras ce qui
            en a été compris avant de valider.
          </Text>

          <Pressable style={s.ajouter} onPress={importer} disabled={enRecuperation}>
            {enRecuperation
              ? <ActivityIndicator color={colors.accent} />
              : <Text style={s.ajouterTexte}>Importer</Text>}
          </Pressable>

          {erreur && <Text style={s.erreur}>{erreur}</Text>}

          {lignes && (
            <>
              <Text style={s.section}>Ce qui a été compris</Text>

              {image && <Image source={{ uri: image }} style={s.photo} resizeMode="cover" />}

              <Text style={s.label}>Nom de la recette</Text>
              <TextInput style={s.champ} value={nom} onChangeText={setNom} />

              <Text style={s.label}>Nombre de parts</Text>
              <TextInput
                style={s.champ}
                value={parts}
                onChangeText={setParts}
                keyboardType="number-pad"
              />

              {aVerifier > 0 && (
                <Text style={s.avertissement}>
                  {aVerifier === 1
                    ? '1 ingrédient sans quantité. Complète-le ou retire-le.'
                    : `${aVerifier} ingrédients sans quantité. Complète-les ou retire-les.`}
                </Text>
              )}

              <Text style={s.section}>Ingrédients</Text>

              {lignes.map((ing, i) => {
                const produit = ing.product_id ? produits.find((p) => p.id === ing.product_id) : null;
                return (
                  <View key={`${ing.origine}-${i}`} style={s.carte}>
                    <View style={s.carteHaut}>
                      {produit?.image_url
                        ? <Image source={{ uri: produit.image_url }} style={s.vignette} resizeMode="contain" />
                        : <View style={[s.vignette, s.vignetteVide]} />}
                      <View style={s.carteTexte}>
                        <TextInput
                          style={s.nomChamp}
                          value={ing.name}
                          onChangeText={(t) => maj(i, { name: t })}
                        />
                        <Text style={s.origine} numberOfLines={1}>{ing.origine}</Text>
                        <Text style={s.rayon}>
                          {libelleRayon(ing.rayon)}
                          {produit ? ' · rattaché au catalogue' : ' · nouveau produit'}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => setLignes((l) => l?.filter((_, k) => k !== i) ?? null)}
                        hitSlop={8}
                      >
                        <Text style={s.retirer}>Retirer</Text>
                      </Pressable>
                    </View>

                    {ing.aVerifier && <Text style={s.aVerifier}>Quantité à vérifier</Text>}

                    <View style={s.rangee}>
                      <View style={s.moitie}>
                        <Text style={s.label}>Quantité par part</Text>
                        <TextInput
                          style={[s.champ, ing.aVerifier && s.champAlerte]}
                          value={String(ing.quantity_per_serving)}
                          onChangeText={(t) =>
                            maj(i, { quantity_per_serving: Number(t.replace(',', '.')) || 0 })
                          }
                          keyboardType="decimal-pad"
                        />
                      </View>
                      <View style={s.moitie}>
                        <Text style={s.label}>Unité</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View style={s.unites}>
                            {/* L'unité lue peut être absente de la liste — « bouteille »,
                                « gousse ». On la propose en tête plutôt que de la perdre. */}
                            {[...new Set([ing.unit, ...UNITES])].map((u) => (
                              <Pressable
                                key={u}
                                style={[s.unite, ing.unit === u && s.uniteActive]}
                                onPress={() => maj(i, { unit: u })}
                              >
                                <Text style={[s.uniteTexte, ing.unit === u && s.uniteTexteActif]}>
                                  {u}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </ScrollView>
                      </View>
                    </View>
                  </View>
                );
              })}

              <Pressable style={s.bouton} onPress={enregistrer} disabled={enCours}>
                {enCours
                  ? <ActivityIndicator color={colors.accentContrast} />
                  : <Text style={s.boutonTexte}>Enregistrer la recette</Text>}
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.bg },
  entete: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  retour: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  titre: { fontSize: 17, fontWeight: '700', color: colors.text },
  equilibre: { width: 56 },
  corps: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },

  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: spacing.sm },
  aide: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginTop: spacing.xs },
  section: {
    fontSize: 17, fontWeight: '700', color: colors.text,
    marginTop: spacing.xl, marginBottom: spacing.xs,
  },
  champ: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, fontSize: 16, color: colors.text, backgroundColor: colors.surface,
  },
  champAlerte: { borderColor: colors.danger },
  photo: {
    width: '100%', height: 180, borderRadius: radius.lg,
    backgroundColor: colors.surface, marginBottom: spacing.sm,
  },
  avertissement: { color: colors.danger, fontSize: 13, marginTop: spacing.md },
  aVerifier: { color: colors.danger, fontSize: 12, fontWeight: '600' },

  carte: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.md,
  },
  carteHaut: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  vignette: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.bg },
  vignetteVide: { borderWidth: 1, borderColor: colors.border },
  carteTexte: { flex: 1, gap: 2 },
  nomChamp: { fontSize: 15, fontWeight: '600', color: colors.text, padding: 0 },
  origine: { fontSize: 11, color: colors.textMuted, fontStyle: 'italic' },
  rayon: { fontSize: 12, color: colors.textMuted },
  retirer: { fontSize: 13, fontWeight: '600', color: colors.danger },
  rangee: { flexDirection: 'row', gap: spacing.md },
  moitie: { flex: 1 },
  unites: { flexDirection: 'row', gap: spacing.xs, paddingVertical: spacing.xs },
  unite: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill,
    paddingVertical: spacing.xs, paddingHorizontal: spacing.md,
  },
  uniteActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  uniteTexte: { fontSize: 13, color: colors.text },
  uniteTexteActif: { fontWeight: '700', color: colors.accent },

  ajouter: {
    borderWidth: 1, borderColor: colors.accent, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.md,
  },
  ajouterTexte: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  erreur: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
  bouton: {
    backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.lg,
    alignItems: 'center', marginTop: spacing.lg,
  },
  boutonTexte: { color: colors.accentContrast, fontWeight: '700', fontSize: 16 },
});
