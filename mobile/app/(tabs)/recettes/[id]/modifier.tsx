import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SelecteurIngredient, type ChoixIngredient } from '../../../../components/SelecteurIngredient';
import { useProducts } from '../../../../stores/products';
import { modifierRecette, supprimerRecette, useRecette } from '../../../../stores/recipes';
import {
  UNITES, valideBrouillon,
  type Brouillon, type IngredientBrouillon,
} from '../../../../lib/recette-brouillon.ts';
import { libelleRayon } from '../../../../lib/rayons.ts';
import { choisirPhoto, deposerPhoto } from '../../../../lib/photo-recette.ts';
import { colors, radius, spacing } from '../../../../lib/theme';

export default function ModifierRecette() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { recette, chargement } = useRecette(id);
  const { produits } = useProducts();
  const [nom, setNom] = useState('');
  const [parts, setParts] = useState('4');
  const [ingredients, setIngredients] = useState<IngredientBrouillon[]>([]);
  const [prerempli, setPrerempli] = useState(false);

  // Préremplissage unique : sans ce garde-fou, chaque rechargement de la
  // recette écraserait les modifications en cours de saisie.
  useEffect(() => {
    if (prerempli || !recette) return;
    setNom(recette.name);
    setParts(String(recette.servings_default));
    setPhotoExistante(recette.image_url);
    setIngredients(recette.ingredients.map((i) => ({
      name: i.name,
      quantity_per_serving: i.quantity_per_serving,
      unit: i.unit,
      rayon: i.rayon,
      product_id: i.product_id,
    })));
    setPrerempli(true);
  }, [recette, prerempli]);
  const [selecteurOuvert, setSelecteurOuvert] = useState(false);
  const [photo, setPhoto] = useState<{ base64: string } | null>(null);
  const [photoExistante, setPhotoExistante] = useState<string | null>(null);
  const [avertissement, setAvertissement] = useState<string | null>(null);

  const proposerPhoto = () => {
    Alert.alert('Photo de la recette', undefined, [
      { text: 'Prendre une photo', onPress: async () => setPhoto(await choisirPhoto('appareil')) },
      { text: 'Choisir dans la photothèque', onPress: async () => setPhoto(await choisirPhoto('bibliotheque')) },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const ajouter = (choix: ChoixIngredient) => {
    setSelecteurOuvert(false);
    setIngredients((l) => [...l, { ...choix, quantity_per_serving: 1 }]);
  };

  const majQuantite = (i: number, valeur: string) => {
    const n = Number(valeur.replace(',', '.')) || 0;
    setIngredients((l) => l.map((ing, k) => (k === i ? { ...ing, quantity_per_serving: n } : ing)));
  };

  const majUnite = (i: number, unite: string) => {
    setIngredients((l) => l.map((ing, k) => (k === i ? { ...ing, unit: unite } : ing)));
  };

  const enregistrer = async () => {
    if (enCours) return;
    const brouillon: Brouillon = { name: nom, servings_default: Number.parseInt(parts, 10), ingredients };
    const probleme = valideBrouillon(brouillon);
    if (probleme) { setErreur(probleme); return; }
    setErreur(null);
    setAvertissement(null);
    setEnCours(true);

    // Le dépôt a lieu ici et pas au choix de la photo : inutile d'encombrer le
    // stockage si la recette n'est finalement pas enregistrée.
    let adressePhoto = photoExistante;
    if (photo) {
      const d = await deposerPhoto(photo.base64);
      if (d.ok && d.url) adressePhoto = d.url;
      // Une photo qui ne passe pas ne doit pas faire perdre la recette.
      else setAvertissement("La recette est enregistrée, mais la photo n'a pas pu être envoyée.");
    }
    brouillon.image_url = adressePhoto;
    const r = await modifierRecette(id, brouillon);
    setEnCours(false);
    if (r.ok) router.back();
    else setErreur(r.erreur ?? "Impossible d'enregistrer la recette.");
  };

  if (chargement && !recette) {
    return (
      <SafeAreaView style={[s.ecran, s.centre]}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.ecran}>
      <KeyboardAvoidingView style={s.ecran} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.entete}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={s.retour}>Annuler</Text>
          </Pressable>
          <Text style={s.titre}>Modifier la recette</Text>
          <View style={s.equilibre} />
        </View>

        <ScrollView contentContainerStyle={s.corps} keyboardShouldPersistTaps="handled">
          <Pressable style={s.photo} onPress={proposerPhoto}>
            {photo || photoExistante ? (
              <Image
                source={{ uri: photo ? `data:image/jpeg;base64,${photo.base64}` : photoExistante! }}
                style={s.photoImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[s.photoImage, s.photoVide]}>
                <Text style={s.photoTexte}>Ajouter une photo</Text>
              </View>
            )}
          </Pressable>

          <Text style={s.label}>Nom de la recette</Text>
          <TextInput
            style={s.champ}
            value={nom}
            onChangeText={setNom}
            placeholder="Gratin dauphinois"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={s.label}>Nombre de parts</Text>
          <TextInput style={s.champ} value={parts} onChangeText={setParts} keyboardType="number-pad" />

          <Text style={s.section}>Ingrédients</Text>

          {ingredients.length === 0 && (
            <Text style={s.vide}>
              Aucun ingrédient. Cherche-les dans ton catalogue plutôt que de les ressaisir.
            </Text>
          )}

          {ingredients.map((ing, i) => {
            const produit = ing.product_id ? produits.find((p) => p.id === ing.product_id) : null;
            return (
              <View key={`${ing.name}-${i}`} style={s.carte}>
                <View style={s.carteHaut}>
                  {produit?.image_url
                    ? <Image source={{ uri: produit.image_url }} style={s.vignette} resizeMode="contain" />
                    : <View style={[s.vignette, s.vignetteVide]} />}
                  <View style={s.carteTexte}>
                    <Text style={s.nom} numberOfLines={2}>{ing.name}</Text>
                    <Text style={s.rayon}>{libelleRayon(ing.rayon)}</Text>
                  </View>
                  <Pressable
                    onPress={() => setIngredients((l) => l.filter((_, k) => k !== i))}
                    hitSlop={8}
                  >
                    <Text style={s.retirer}>Retirer</Text>
                  </Pressable>
                </View>

                <View style={s.rangee}>
                  <View style={s.moitie}>
                    <Text style={s.label}>Quantité par part</Text>
                    <TextInput
                      style={s.champ}
                      value={String(ing.quantity_per_serving)}
                      onChangeText={(t) => majQuantite(i, t)}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={s.moitie}>
                    <Text style={s.label}>Unité</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={s.unites}>
                        {UNITES.map((u) => (
                          <Pressable
                            key={u}
                            style={[s.unite, ing.unit === u && s.uniteActive]}
                            onPress={() => majUnite(i, u)}
                          >
                            <Text style={[s.uniteTexte, ing.unit === u && s.uniteTexteActif]}>{u}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                </View>
              </View>
            );
          })}

          <Pressable style={s.ajouter} onPress={() => setSelecteurOuvert(true)}>
            <Text style={s.ajouterTexte}>Ajouter un ingrédient</Text>
          </Pressable>

          {avertissement && <Text style={s.avertissement}>{avertissement}</Text>}
          {erreur && <Text style={s.erreur}>{erreur}</Text>}

          <Pressable style={s.bouton} onPress={enregistrer} disabled={enCours}>
            {enCours
              ? <ActivityIndicator color={colors.accentContrast} />
              : <Text style={s.boutonTexte}>Enregistrer</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={selecteurOuvert} animationType="slide" presentationStyle="pageSheet">
        <SelecteurIngredient onChoisir={ajouter} onFermer={() => setSelecteurOuvert(false)} />
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.bg },
  centre: { alignItems: 'center', justifyContent: 'center' },
  entete: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  retour: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  titre: { fontSize: 17, fontWeight: '700', color: colors.text },
  equilibre: { width: 56 },
  corps: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  photo: { borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.md },
  photoImage: { width: '100%', height: 180, backgroundColor: colors.surface },
  photoVide: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  photoTexte: { color: colors.accent, fontWeight: '700', fontSize: 15 },
  avertissement: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },

  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: spacing.sm },
  section: {
    fontSize: 17, fontWeight: '700', color: colors.text,
    marginTop: spacing.xl, marginBottom: spacing.xs,
  },
  vide: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.sm },
  champ: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, fontSize: 16, color: colors.text, backgroundColor: colors.surface,
  },
  carte: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.md,
  },
  carteHaut: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  vignette: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.bg },
  vignetteVide: { borderWidth: 1, borderColor: colors.border },
  carteTexte: { flex: 1, gap: 2 },
  nom: { fontSize: 15, fontWeight: '600', color: colors.text },
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
    padding: spacing.md, alignItems: 'center',
  },
  ajouterTexte: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  erreur: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
  bouton: {
    backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.lg,
    alignItems: 'center', marginTop: spacing.lg,
  },
  boutonTexte: { color: colors.accentContrast, fontWeight: '700', fontSize: 16 },
});
