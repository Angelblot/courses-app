import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SelecteurRayon } from '../../../components/SelecteurRayon';
import { useProducts } from '../../../stores/products';
import { creerRecette } from '../../../stores/recipes';
import {
  UNITES, rayonPropose, valideBrouillon,
  type IngredientBrouillon,
} from '../../../lib/recette-brouillon.ts';
import { libelleRayon, type CleRayon } from '../../../lib/rayons.ts';
import { colors, radius, spacing } from '../../../lib/theme';

const INGREDIENT_VIDE: IngredientBrouillon = {
  name: '', quantity_per_serving: 1, unit: 'unité', rayon: 'autre', product_id: null,
};

export default function NouvelleRecette() {
  const router = useRouter();
  const { produits } = useProducts();
  const [nom, setNom] = useState('');
  const [parts, setParts] = useState('4');
  const [ingredients, setIngredients] = useState<IngredientBrouillon[]>([{ ...INGREDIENT_VIDE }]);
  const [rayonOuvert, setRayonOuvert] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const majIngredient = (i: number, champs: Partial<IngredientBrouillon>) => {
    setIngredients((liste) => liste.map((ing, n) => (n === i ? { ...ing, ...champs } : ing)));
  };

  /**
   * À la sortie du champ nom, on propose un rayon. On ne le fait qu'une fois,
   * tant que l'utilisateur n'a rien choisi : écraser un choix manuel à chaque
   * frappe serait déroutant.
   */
  const proposerRayon = (i: number) => {
    const ing = ingredients[i];
    if (!ing.name.trim() || ing.rayon !== 'autre') return;
    majIngredient(i, { rayon: rayonPropose(ing.name, produits) });
  };

  const enregistrer = async () => {
    if (enCours) return;
    const brouillon = {
      name: nom,
      servings_default: Number.parseInt(parts, 10),
      ingredients,
    };
    const probleme = valideBrouillon(brouillon);
    if (probleme) {
      setErreur(probleme);
      return;
    }
    setErreur(null);
    setEnCours(true);
    const r = await creerRecette(brouillon);
    setEnCours(false);
    if (r.ok) router.back();
    else setErreur(r.erreur ?? "Impossible d'enregistrer la recette.");
  };

  return (
    <SafeAreaView style={s.ecran}>
      <KeyboardAvoidingView
        style={s.ecran}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.entete}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={s.retour}>Annuler</Text>
          </Pressable>
          <Text style={s.titre}>Nouvelle recette</Text>
          <View style={s.equilibre} />
        </View>

        <ScrollView contentContainerStyle={s.corps} keyboardShouldPersistTaps="handled">
          <Text style={s.label}>Nom de la recette</Text>
          <TextInput
            style={s.champ}
            value={nom}
            onChangeText={setNom}
            placeholder="Gratin dauphinois"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={s.label}>Nombre de parts</Text>
          <TextInput
            style={s.champ}
            value={parts}
            onChangeText={setParts}
            keyboardType="number-pad"
          />

          <Text style={s.section}>Ingrédients</Text>

          {ingredients.map((ing, i) => (
            <View key={i} style={s.carte}>
              <View style={s.carteEntete}>
                <Text style={s.carteTitre}>{`Ingrédient ${i + 1}`}</Text>
                {ingredients.length > 1 && (
                  <Pressable
                    onPress={() => setIngredients((l) => l.filter((_, n) => n !== i))}
                    hitSlop={8}
                  >
                    <Text style={s.retirer}>Retirer</Text>
                  </Pressable>
                )}
              </View>

              <TextInput
                style={s.champ}
                value={ing.name}
                onChangeText={(t) => majIngredient(i, { name: t })}
                onBlur={() => proposerRayon(i)}
                placeholder="Pommes de terre"
                placeholderTextColor={colors.textMuted}
              />

              <View style={s.rangee}>
                <View style={s.moitie}>
                  <Text style={s.label}>Quantité par part</Text>
                  <TextInput
                    style={s.champ}
                    value={String(ing.quantity_per_serving)}
                    onChangeText={(t) =>
                      majIngredient(i, { quantity_per_serving: Number(t.replace(',', '.')) || 0 })}
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
                          onPress={() => majIngredient(i, { unit: u })}
                        >
                          <Text style={[s.uniteTexte, ing.unit === u && s.uniteTexteActif]}>{u}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>

              {rayonOuvert === i ? (
                <SelecteurRayon
                  valeur={ing.rayon}
                  onChoisir={(cle: CleRayon) => {
                    majIngredient(i, { rayon: cle });
                    setRayonOuvert(null);
                  }}
                  onFermer={() => setRayonOuvert(null)}
                />
              ) : (
                <Pressable style={s.rayon} onPress={() => setRayonOuvert(i)}>
                  <Text style={s.rayonLabel}>Rayon</Text>
                  <Text style={s.rayonValeur}>{libelleRayon(ing.rayon)}</Text>
                </Pressable>
              )}
            </View>
          ))}

          <Pressable
            style={s.ajouter}
            onPress={() => setIngredients((l) => [...l, { ...INGREDIENT_VIDE }])}
          >
            <Text style={s.ajouterTexte}>Ajouter un ingrédient</Text>
          </Pressable>

          {erreur && <Text style={s.erreur}>{erreur}</Text>}

          <Pressable style={s.bouton} onPress={enregistrer} disabled={enCours}>
            {enCours
              ? <ActivityIndicator color={colors.accentContrast} />
              : <Text style={s.boutonTexte}>Enregistrer</Text>}
          </Pressable>
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
  section: {
    fontSize: 17, fontWeight: '700', color: colors.text,
    marginTop: spacing.xl, marginBottom: spacing.xs,
  },
  champ: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, fontSize: 16, color: colors.text, backgroundColor: colors.surface,
  },
  carte: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.md,
  },
  carteEntete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  carteTitre: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
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
  rayon: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
  },
  rayonLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  rayonValeur: { fontSize: 15, fontWeight: '600', color: colors.accent },
  ajouter: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center',
  },
  ajouterTexte: { color: colors.text, fontWeight: '600', fontSize: 14 },
  erreur: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
  bouton: {
    backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.lg,
    alignItems: 'center', marginTop: spacing.lg,
  },
  boutonTexte: { color: colors.accentContrast, fontWeight: '700', fontSize: 16 },
});
