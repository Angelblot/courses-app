import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../lib/theme';

type Icone = ComponentProps<typeof Feather>['name'];

/** Un groupe de lignes façon Réglages d'iPhone : intitulé, puis une carte blanche. */
export function Groupe({ titre, children }: { titre: string; children: ReactNode }) {
  return <View style={s.groupe}>
    <Text style={s.titre} accessibilityRole="header">{titre}</Text>
    <View style={s.carte}>{children}</View>
  </View>;
}

/**
 * Une ligne de réglage : pastille d'icône colorée, libellé, valeur ou
 * contrôle à droite. Avec `onPress`, toute la ligne se touche et porte un
 * chevron, sauf une action (« Se déconnecter »), qui n'ouvre pas d'écran.
 */
export function Ligne({ icone, teinte, libelle, valeur, onPress, danger, derniere, children }: {
  icone: Icone; teinte: string; libelle: string; valeur?: string | number; onPress?: () => void;
  danger?: boolean; derniere?: boolean; children?: ReactNode;
}) {
  const contenu = <>
    <View style={[s.pastille, { backgroundColor: teinte }]}><Feather name={icone} size={17} color="#FFFFFF" /></View>
    <Text style={[s.libelle, danger && { color: colors.danger }]} numberOfLines={1}>{libelle}</Text>
    {children}
    {valeur != null && valeur !== '' && <Text style={s.valeur} numberOfLines={1}>{valeur}</Text>}
    {onPress && !danger && <Feather name="chevron-right" size={18} color={colors.traitControle} />}
  </>;
  const style = [s.ligne, !derniere && s.separee];
  return onPress
    ? <Pressable accessibilityRole="button" accessibilityLabel={valeur != null && valeur !== '' ? `${libelle}, ${valeur}` : libelle} onPress={onPress} style={({ pressed }) => [...style, pressed && { backgroundColor: colors.bg }]}>{contenu}</Pressable>
    : <View style={style}>{contenu}</View>;
}

const s = StyleSheet.create({
  groupe: { gap: 6 },
  titre: { fontSize: 13, fontWeight: '600', color: colors.textMuted, paddingHorizontal: 4 },
  carte: { backgroundColor: colors.surface, borderRadius: 14, overflow: 'hidden' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 14, paddingVertical: 6 },
  separee: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  pastille: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  libelle: { flex: 1, fontSize: 16, color: colors.text },
  valeur: { fontSize: 15, color: colors.textMuted, maxWidth: '45%' },
});
