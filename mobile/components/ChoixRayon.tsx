import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Host, Menu, Picker, RNHostView, Text as TexteNatif } from '@expo/ui/swift-ui';
import { tag, tint } from '@expo/ui/swift-ui/modifiers';
import { SelecteurRayon } from './SelecteurRayon';
import { RAYONS, libelleRayon, type CleRayon } from '../lib/rayons.ts';
import { colors, radius, spacing } from '../lib/theme';

/**
 * La ligne « Rayon » d'une fiche. Sur iOS, un toucher ouvre le menu
 * déroulant natif, le rayon actuel coché : rien ne se déplie dans la fiche.
 * Ailleurs, la liste groupée de `SelecteurRayon` se déplie sous la ligne.
 */
export function ChoixRayon({ valeur, onChoisir }: { valeur: CleRayon; onChoisir: (cle: CleRayon) => void }) {
  const [ouvert, setOuvert] = useState(false), [largeur, setLargeur] = useState(0);
  const ligne = (
    <View style={[s.ligne, Platform.OS === 'ios' && { width: largeur }]} accessible accessibilityRole="button" accessibilityLabel={`Rayon : ${libelleRayon(valeur)}`} accessibilityHint="Ouvre la liste des rayons">
      <Text style={s.libelle}>Rayon</Text>
      <View style={s.valeur}>
        <Text style={s.valeurTexte} numberOfLines={2}>{libelleRayon(valeur)}</Text>
        <Feather name="chevron-down" size={17} color={colors.accent} />
      </View>
    </View>
  );

  if (Platform.OS === 'ios') {
    // Le libellé d'un Menu SwiftUI prend la largeur de son contenu : la
    // ligne reçoit donc en points la largeur mesurée de son emplacement.
    return (
      <View style={s.hote} onLayout={(e) => setLargeur(Math.round(e.nativeEvent.layout.width))}>
        {largeur > 0 && <Host matchContents={{ vertical: true }} style={{ width: largeur }}>
          <Menu label={<RNHostView matchContents>{ligne}</RNHostView>} modifiers={[tint(colors.accent)]}>
            <Picker<string> selection={valeur} onSelectionChange={(cle) => onChoisir(cle as CleRayon)}>
              {RAYONS.map((r) => <TexteNatif key={r.cle} modifiers={[tag(r.cle)]}>{r.label}</TexteNatif>)}
            </Picker>
          </Menu>
        </Host>}
      </View>
    );
  }
  return ouvert
    ? <SelecteurRayon valeur={valeur} onChoisir={(cle) => { onChoisir(cle); setOuvert(false); }} onFermer={() => setOuvert(false)} />
    : <Pressable onPress={() => setOuvert(true)} style={({ pressed }) => pressed && { opacity: .85 }}>{ligne}</Pressable>;
}

const s = StyleSheet.create({
  hote: { alignSelf: 'stretch' },
  ligne: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg,
    minHeight: 52, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.card,
  },
  libelle: { fontSize: 15, color: colors.textMuted },
  valeur: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  valeurTexte: { flexShrink: 1, fontSize: 15, fontWeight: '600', color: colors.accent, textAlign: 'right' },
});
