import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, ombre, radius, spacing } from '../lib/theme';

/** Diamètre de la pastille. Trois par rangée sur un téléphone courant. */
const TAILLE = 96;

/**
 * Un ingrédient présenté en pastille ronde : l'image du produit, la quantité,
 * puis le nom.
 *
 * C'est la signature de Jow, et elle vaut mieux qu'une liste : on reconnaît
 * un ingrédient à sa photo bien avant de lire son nom.
 *
 * Un ingrédient non rattaché au catalogue n'a pas d'image, et le dit — c'est
 * lui que l'extension devra chercher par son nom, donc celui qui risque de
 * manquer dans le panier.
 */
export function PastilleIngredient({
  nom, quantite, image, rattache,
}: {
  nom: string;
  quantite: string;
  image: string | null;
  rattache: boolean;
}) {
  // Une image qui n'arrive pas laissait un cercle vide : son fond opaque
  // masquait l'initiale posée dessous. On la retire plutôt que de la couvrir.
  const [imageCassee, setImageCassee] = useState(false);
  const montrerImage = Boolean(image) && !imageCassee;

  return (
    <View style={s.bloc}>
      <View style={s.cercle}>
        {/* L'initiale est toujours dessous : si l'image ne charge pas, le
            cercle porte encore quelque chose plutôt que de rester vide. */}
        <Text style={s.initiale}>{(nom.trim()[0] ?? '?').toUpperCase()}</Text>
        {montrerImage && (
          <Image
            source={{ uri: image! }}
            style={s.image}
            resizeMode="contain"
            onError={() => setImageCassee(true)}
          />
        )}
        {!rattache && (
          <View style={s.badge}>
            <Text style={s.badgeTexte}>à chercher</Text>
          </View>
        )}
      </View>
      <Text style={s.quantite} numberOfLines={1}>{quantite}</Text>
      <Text style={s.nom} numberOfLines={2}>{nom}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  bloc: { width: TAILLE, alignItems: 'center', gap: 2 },
  cercle: {
    width: TAILLE, height: TAILLE, borderRadius: TAILLE / 2,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
    ...ombre,
    // La pastille « à chercher » déborde volontairement du cercle.
    overflow: 'visible',
  },
  image: {
    position: 'absolute', width: TAILLE * 0.66, height: TAILLE * 0.66,
    backgroundColor: colors.surface,
  },
  initiale: { fontSize: 30, fontWeight: '700', color: colors.textMuted },
  // Une réserve, pas une alerte : le badge informe sans crier.
  badge: {
    position: 'absolute', bottom: -4,
    backgroundColor: colors.bg, borderRadius: radius.pill,
    paddingVertical: 2, paddingHorizontal: spacing.sm,
  },
  badgeTexte: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  quantite: {
    fontSize: 14, fontWeight: '700', color: colors.text,
    marginTop: spacing.sm, textAlign: 'center',
  },
  nom: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 17 },
});
