import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Recipe } from '../stores/recipes';
import { initiale, indiceAplat } from '../lib/recettes-affichage.ts';
import { colors, radius, spacing } from '../lib/theme';

/**
 * Carte de recette : photo en bandeau, nom, parts et ingrédients.
 *
 * Sans photo, un aplat coloré portant l'initiale. Jamais une image générique
 * récupérée ailleurs : une fausse photo dit quelque chose de faux.
 */
export function CarteRecette({ recette, onOuvrir }: { recette: Recipe; onOuvrir: () => void }) {
  const n = recette.ingredients.length;
  return (
    <Pressable style={s.carte} onPress={onOuvrir}>
      {recette.image_url ? (
        <Image source={{ uri: recette.image_url }} style={s.image} resizeMode="cover" />
      ) : (
        <View style={[s.image, s.aplat, { backgroundColor: colors.aplats[indiceAplat(recette.name)] }]}>
          <Text style={s.initiale}>{initiale(recette.name)}</Text>
        </View>
      )}
      <View style={s.texte}>
        <Text style={s.nom} numberOfLines={2}>{recette.name}</Text>
        <Text style={s.detail}>
          {`${recette.servings_default} parts · ${n} ingrédient${n > 1 ? 's' : ''}`}
        </Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  carte: {
    backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border,
  },
  image: { height: 160, width: '100%', backgroundColor: colors.bg },
  aplat: { alignItems: 'center', justifyContent: 'center' },
  initiale: { fontSize: 44, fontWeight: '800', color: '#FFFFFF' },
  texte: { padding: spacing.lg, gap: spacing.xs },
  nom: { fontSize: 17, fontWeight: '700', color: colors.text },
  detail: { fontSize: 13, color: colors.textMuted },
});
