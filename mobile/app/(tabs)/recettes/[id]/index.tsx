import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { EtatVide } from '../../../../components/EtatVide';
import { PastilleIngredient } from '../../../../components/PastilleIngredient';
import { SelecteurIngredient, type ChoixIngredient } from '../../../../components/SelecteurIngredient';
import { useRecette, supprimerRecette, rattacherIngredient } from '../../../../stores/recipes';
import { useProducts } from '../../../../stores/products';
import {
  quantitePourParts, initiale, indiceAplat, formatDuree,
} from '../../../../lib/recettes-affichage.ts';
import { formatIngredientQty } from '../../../../lib/unites.ts';
import { colors, radius, spacing, texte } from '../../../../lib/theme';

export default function DetailRecette() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { recette, chargement, erreur, recharger } = useRecette(id);
  const { produits } = useProducts();
  // Le réglage n'est qu'une aide à la lecture : il repart de la valeur
  // enregistrée à chaque ouverture et ne modifie jamais la recette.
  const [parts, setParts] = useState<number | null>(null);
  const [erreurSuppression, setErreurSuppression] = useState<string | null>(null);
  /** Ingrédient dont on cherche le produit, ou `null` si le sélecteur est fermé. */
  const [aRattacher, setARattacher] = useState<{ id: string; nom: string } | null>(null);

  const choisirProduit = async (choix: ChoixIngredient) => {
    const cible = aRattacher;
    setARattacher(null);
    if (!cible) return;
    const r = await rattacherIngredient(cible.id, choix.product_id, choix.rayon);
    if (r.ok) recharger();
    else setErreurSuppression(r.erreur ?? 'Impossible de rattacher cet ingrédient.');
  };

  const demanderSuppression = (id: string) => {
    Alert.alert(
      'Supprimer cette recette ?',
      'Ses ingrédients seront supprimés avec elle. Cette action est définitive.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const r = await supprimerRecette(id);
            if (r.ok) router.back();
            else setErreurSuppression(r.erreur ?? 'Impossible de supprimer cette recette.');
          },
        },
      ],
    );
  };

  const rechargerAuFocus = useCallback(() => { recharger(); }, [recharger]);
  useFocusEffect(rechargerAuFocus);

  if (chargement && !recette) {
    return <SafeAreaView style={s.centre}><ActivityIndicator color={colors.accent} /></SafeAreaView>;
  }

  if (erreur) {
    return (
      <SafeAreaView style={s.centre}>
        <Text style={s.erreur}>{erreur}</Text>
        <Pressable style={s.reessayer} onPress={recharger}>
          <Text style={s.reessayerTexte}>Réessayer</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!recette) {
    return (
      <SafeAreaView style={s.centre}>
        <EtatVide titre="Recette introuvable">
          Elle a peut-être été supprimée depuis un autre appareil.
        </EtatVide>
      </SafeAreaView>
    );
  }

  const n = parts ?? recette.servings_default;

  // Trois informations, montrées seulement si la recette les porte : une
  // colonne vide vaudrait mieux qu'un « 0 min » inventé, et une absence de
  // colonne vaut mieux qu'une colonne vide.
  const stats = [
    { cle: 'prep', icone: 'clock' as const, valeur: formatDuree(recette.prep_minutes), libelle: 'Préparation' },
    { cle: 'cuisson', icone: 'thermometer' as const, valeur: formatDuree(recette.cook_minutes), libelle: 'Cuisson' },
    {
      cle: 'kcal', icone: 'activity' as const,
      valeur: recette.kcal_per_serving ? `${recette.kcal_per_serving} kcal` : null,
      libelle: 'Par portion',
    },
  ].filter((x) => x.valeur);

  return (
    <View style={s.ecran}>
      <ScrollView contentContainerStyle={s.corps}>
        <View>
          {recette.image_url ? (
            <Image source={{ uri: recette.image_url }} style={s.bandeau} resizeMode="cover" />
          ) : (
            <View style={[s.bandeau, s.aplat, { backgroundColor: colors.aplats[indiceAplat(recette.name)] }]}>
              <Text style={[s.initiale, { color: colors.aplatsEncre[indiceAplat(recette.name)] }]}>
            {initiale(recette.name)}
          </Text>
            </View>
          )}
          <SafeAreaView style={s.barre} edges={['top']}>
            <Pressable style={s.rond} onPress={() => router.back()} hitSlop={8}>
              <Feather name="arrow-left" size={20} color={colors.text} />
            </Pressable>
            <Pressable
              style={s.rond}
              onPress={() => router.push(`/recettes/${recette.id}/modifier`)}
              hitSlop={8}
            >
              <Feather name="edit-2" size={18} color={colors.text} />
            </Pressable>
          </SafeAreaView>
        </View>

        <View style={s.texte}>
          <Text style={s.titre}>{recette.name}</Text>
          {recette.description && <Text style={s.description}>{recette.description}</Text>}

          {stats.length > 0 && (
            <View style={s.stats}>
              {stats.map((x) => (
                <View key={x.cle} style={s.stat}>
                  <Feather name={x.icone} size={16} color={colors.accentContrast} />
                  <Text style={s.statValeur}>{x.valeur}</Text>
                  <Text style={s.statLibelle}>{x.libelle}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={s.blocIngredients}>
          <View style={s.enteteIngredients}>
            <Text style={s.section}>{`Ingrédients pour ${n} part${n > 1 ? 's' : ''}`}</Text>
            {/* Le réglage jouxte le titre, comme chez Jow : c'est là qu'on
                pense au nombre de convives, pas plus haut. Il n'est qu'une
                aide à la lecture et ne modifie jamais la recette. */}
            <View style={s.compteur}>
              <Pressable style={s.pas} onPress={() => setParts(Math.max(1, n - 1))} hitSlop={8}>
                <Text style={s.pasTexte}>−</Text>
              </Pressable>
              <Text style={s.compteurTexte}>{n}</Text>
              <Pressable style={s.pas} onPress={() => setParts(n + 1)} hitSlop={8}>
                <Text style={s.pasTexte}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={s.pastilles}>
            {recette.ingredients.map((ing) => {
              const produit = ing.product_id
                ? produits.find((p) => p.id === ing.product_id)
                : null;
              return (
                <Pressable
                  key={ing.id}
                  style={s.cellule}
                  onPress={() => setARattacher({ id: ing.id, nom: ing.name })}
                >
                  <PastilleIngredient
                    nom={ing.name}
                    quantite={formatIngredientQty(
                      quantitePourParts(ing.quantity_per_serving, n), ing.unit,
                    )}
                    image={produit?.image_url ?? null}
                    rattache={Boolean(ing.product_id)}
                  />
                </Pressable>
              );
            })}
          </View>
          </View>

          {erreurSuppression && <Text style={s.erreur}>{erreurSuppression}</Text>}

          <Text style={s.aideRattachement}>
            Touche un ingrédient pour lui choisir un produit du catalogue.
          </Text>

          <Pressable style={s.supprimer} onPress={() => demanderSuppression(recette.id)}>
            <Text style={s.supprimerTexte}>Supprimer cette recette</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={aRattacher !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setARattacher(null)}
      >
        <SelecteurIngredient onChoisir={choisirProduit} onFermer={() => setARattacher(null)} />
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.bg },
  centre: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bg, gap: spacing.md, padding: spacing.xl,
  },
  corps: { paddingBottom: spacing.xxl },
  bandeau: { height: 220, width: '100%', backgroundColor: colors.bg },
  aplat: { alignItems: 'center', justifyContent: 'center' },
  initiale: { fontSize: 64, fontWeight: '400' },
  barre: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  rond: {
    width: 36, height: 36, borderRadius: radius.pill,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.sm,
  },
  texte: { padding: spacing.lg, gap: spacing.sm },
  titre: { fontSize: 30, fontWeight: '700', color: colors.text, textAlign: 'center', lineHeight: 36 },
  description: { fontSize: 15, color: colors.textMuted, lineHeight: 22, textAlign: 'center' },
  // Bandeau de statistiques : un bloc de couleur pleine, comme chez Jow, qui
  // sépare le titre de la liste des ingrédients. Leur bandeau est rouge
  // sombre ; on garde notre vert, il n'y a pas de raison d'emprunter aussi
  // leur couleur.
  stats: {
    flexDirection: 'row', backgroundColor: colors.accent,
    borderRadius: radius.card, paddingVertical: spacing.lg,
    marginTop: spacing.lg,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValeur: { fontSize: 16, fontWeight: '600', color: colors.accentContrast, marginTop: 2 },
  statLibelle: { fontSize: 12, fontWeight: '400', color: colors.accentContrast, opacity: 0.85 },

  // Fond blanc : c'est le contraste avec le crème de la page qui détache le
  // bloc chez Jow, sans le moindre trait ni la moindre ombre.
  blocIngredients: {
    backgroundColor: colors.surface, borderRadius: radius.card,
    padding: spacing.xl, marginTop: spacing.xl,
  },
  enteteIngredients: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.md,
  },
  cellule: { width: '48%', alignItems: 'center' },
  aideRattachement: {
    fontSize: 12, color: colors.textMuted, textAlign: 'center',
    marginTop: spacing.lg, lineHeight: 17,
  },
  compteur: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: 4, paddingHorizontal: spacing.sm,
  },
  pas: {
    width: 26, height: 26, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  pasTexte: { fontSize: 18, fontWeight: '700', color: colors.accent },
  compteurTexte: { fontSize: 15, fontWeight: '700', color: colors.text, minWidth: 18, textAlign: 'center' },
  section: { ...texte.section, color: colors.text, textAlign: 'center' },
  pastilles: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-between', rowGap: spacing.xl, marginTop: spacing.xl,
  },
  erreur: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  supprimer: {
    marginTop: spacing.xxl, alignItems: 'center',
    paddingVertical: spacing.md,
  },
  supprimerTexte: { color: colors.danger, fontSize: 14, fontWeight: '600' },
  reessayer: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.lg,
  },
  reessayerTexte: { color: colors.text, fontWeight: '600', fontSize: 14 },
});
