import { useState } from 'react';
import {
  ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { PileSwipe } from './PileSwipe';
import { EtatVide } from '../EtatVide';
import { useWizard } from '../../contexts/WizardContext';
import { useRecipes, type Recipe } from '../../stores/recipes';
import { colors, radius, spacing } from '../../lib/theme';

/** Carte verticale : l'image occupe le haut, le titre et le détail le bas. */
function CarteRecette({ recette }: { recette: Recipe }) {
  const n = recette.ingredients.length;
  return (
    <View style={s.carte}>
      {recette.image_url
        ? <Image source={{ uri: recette.image_url }} style={s.image} resizeMode="cover" />
        : <View style={[s.image, s.imageVide]} />}
      <View style={s.carteTexte}>
        <Text style={s.carteTitre} numberOfLines={2}>{recette.name}</Text>
        <Text style={s.carteDetail}>
          {`${recette.servings_default} parts · ${n} ingrédient${n > 1 ? 's' : ''}`}
        </Text>
      </View>
    </View>
  );
}

export function EtapeRecettes() {
  const { recettes, chargement } = useRecipes();
  const w = useWizard();
  const router = useRouter();
  const [listeOuverte, setListeOuverte] = useState(false);

  if (chargement && recettes.length === 0) {
    return <View style={s.centre}><ActivityIndicator color={colors.accent} /></View>;
  }

  if (recettes.length === 0) {
    return (
      <View style={s.centre}>
        <EtatVide titre="Aucune recette">
          Le wizard compose ta liste à partir de tes recettes. Crée-en une pour commencer.
        </EtatVide>
        <Pressable style={s.lien} onPress={() => router.push('/recettes/nouvelle')}>
          <Text style={s.lienTexte}>Créer une recette</Text>
        </Pressable>
      </View>
    );
  }

  const retenues = recettes.filter((r) => w.selectedRecipes[r.id] != null);

  return (
    <View style={s.bloc}>
      {!listeOuverte && (
        <>
          <View style={s.pile}>
            <PileSwipe
              items={recettes}
              getId={(r) => r.id}
              onAccepter={(r) => w.toggleRecette(r.id, r.servings_default)}
              onRejeter={() => {}}
              rendreCarte={(r) => <CarteRecette recette={r} />}
              etatVide={<EtatVide titre="Tu as vu toutes tes recettes." />}
            />
          </View>
          <Text style={s.consigne}>
            Droite : je la retiens · Gauche : pas cette fois
          </Text>
        </>
      )}

      <Pressable style={s.bascule} onPress={() => setListeOuverte((v) => !v)}>
        <Text style={s.basculeTexte}>
          {listeOuverte ? 'Revenir aux cartes' : `Voir mes recettes (${retenues.length})`}
        </Text>
      </Pressable>

      {listeOuverte && (
        <ScrollView style={s.liste} contentContainerStyle={s.listeContenu}>
          {retenues.length === 0 ? (
            <EtatVide titre="Aucune recette retenue">
              Fais glisser une carte vers la droite pour la retenir.
            </EtatVide>
          ) : (
            retenues.map((r) => (
              <View key={r.id} style={s.ligne}>
                {r.image_url
                  ? <Image source={{ uri: r.image_url }} style={s.vignette} resizeMode="cover" />
                  : <View style={[s.vignette, s.imageVide]} />}
                <Text style={s.ligneNom} numberOfLines={2}>{r.name}</Text>
                <View style={s.compteur}>
                  <Pressable
                    style={s.pas}
                    onPress={() => w.setParts(r.id, w.selectedRecipes[r.id] - 1)}
                    hitSlop={6}
                  >
                    <Text style={s.pasTexte}>−</Text>
                  </Pressable>
                  <Text style={s.compteurTexte}>{`${w.selectedRecipes[r.id]} p.`}</Text>
                  <Pressable
                    style={s.pas}
                    onPress={() => w.setParts(r.id, w.selectedRecipes[r.id] + 1)}
                    hitSlop={6}
                  >
                    <Text style={s.pasTexte}>+</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  bloc: { flex: 1 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  pile: { flex: 1, marginHorizontal: spacing.lg },
  carte: {
    flex: 1,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, overflow: 'hidden',
  },
  image: { flex: 1, width: '100%', backgroundColor: colors.bg },
  imageVide: { borderBottomWidth: 1, borderBottomColor: colors.border },
  carteTexte: { padding: spacing.lg, gap: spacing.xs },
  carteTitre: { fontSize: 22, fontWeight: '800', color: colors.text },
  carteDetail: { fontSize: 15, color: colors.textMuted },
  consigne: {
    fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md,
  },
  bascule: {
    alignSelf: 'center', marginTop: spacing.md,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.xl,
    backgroundColor: colors.surface,
  },
  basculeTexte: { fontSize: 13, fontWeight: '700', color: colors.accent },
  liste: { flex: 1, marginTop: spacing.md },
  listeContenu: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  ligne: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
  },
  vignette: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.bg },
  ligneNom: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  compteur: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pas: {
    width: 28, height: 28, borderRadius: radius.pill, borderWidth: 1,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  pasTexte: { fontSize: 16, fontWeight: '700', color: colors.text },
  compteurTexte: { fontSize: 13, color: colors.text, minWidth: 34, textAlign: 'center' },
  lien: {
    borderWidth: 1, borderColor: colors.accent, borderRadius: radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.xl,
  },
  lienTexte: { color: colors.accent, fontWeight: '700', fontSize: 15 },
});
