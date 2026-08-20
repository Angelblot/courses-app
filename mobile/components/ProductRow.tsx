import { Image, StyleSheet, Text, View } from 'react-native';
import type { Product } from '../stores/products';
import { colors, radius, spacing } from '../lib/theme';

/** Contenance lisible : « 200 g », « 1,5 L », ou rien. */
function contenance(p: Product): string | null {
  if (p.grammage_g) return `${p.grammage_g} g`;
  if (p.volume_ml) {
    return p.volume_ml >= 1000
      ? `${String(p.volume_ml / 1000).replace('.', ',')} L`
      : `${p.volume_ml} ml`;
  }
  return null;
}

export function ProductRow({ produit }: { produit: Product }) {
  const detail = [produit.brand, contenance(produit)].filter(Boolean).join(' · ');
  return (
    <View style={s.ligne}>
      {produit.image_url
        ? <Image source={{ uri: produit.image_url }} style={s.image} />
        : <View style={[s.image, s.imageVide]} />}
      <View style={s.texte}>
        <Text style={s.nom} numberOfLines={2}>{produit.name}</Text>
        {detail.length > 0 && <Text style={s.detail}>{detail}</Text>}
      </View>
      {produit.favorite && <View style={s.pastille} />}
    </View>
  );
}

const s = StyleSheet.create({
  ligne: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  image: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.bg },
  imageVide: { borderWidth: 1, borderColor: colors.border },
  texte: { flex: 1, gap: 2 },
  nom: { fontSize: 15, fontWeight: '600', color: colors.text },
  detail: { fontSize: 13, color: colors.textMuted },
  pastille: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.accent },
});
