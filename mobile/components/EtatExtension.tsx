import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { texteExtension, type EtatExtension as Etat } from '../lib/extension-presence.ts';
import { colors } from '../lib/theme';

/**
 * L'extension vue depuis l'iPhone, en une ligne : l'ordinateur est-il là, et
 * qu'est-ce qui avance. Le même bandeau sert aux recherches et au panier ;
 * seul change le bouton à cliquer dans l'extension.
 */
export function EtatExtension({ etat, attendu, compact = false }: { etat: Etat | null; attendu: 'recherches' | 'remplissage'; compact?: boolean }) {
  if (!etat) return null;
  const { titre, consigne } = texteExtension(etat, attendu);
  const avance = etat.etat === 'recherches' || etat.etat === 'remplissage';
  const ton = etat.etat === 'pause' ? 'attention' : etat.etat === 'absente' || etat.etat === 'jamais' ? 'eteint' : 'actif';
  const part = avance && etat.total ? Math.min(1, etat.fait / etat.total) : 0;
  return <View style={[s.bandeau, ton === 'attention' && s.attention, compact && s.compact]} accessible accessibilityLiveRegion="polite" accessibilityLabel={`${titre}. ${consigne}`}>
    <View style={s.ligne}>
      <View style={[s.icone, ton === 'actif' && s.iconeActive, ton === 'attention' && s.iconeAttention]}>
        {avance ? <ActivityIndicator size="small" color={colors.accent} />
          : <Feather name={ton === 'attention' ? 'alert-circle' : 'monitor'} size={16} color={ton === 'attention' ? colors.attentionText : ton === 'actif' ? colors.accent : colors.textMuted} />}
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[s.titre, ton === 'attention' && { color: colors.attentionText }]} numberOfLines={1}>{titre}</Text>
        <Text style={s.consigne} numberOfLines={compact ? 2 : 3}>{consigne}</Text>
      </View>
    </View>
    {avance && <View style={s.piste}><View style={[s.barre, { width: `${Math.round(part * 100)}%` }]} /></View>}
  </View>;
}

const s = StyleSheet.create({
  bandeau: { backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  compact: { paddingVertical: 8 },
  attention: { backgroundColor: colors.attentionSoft, borderColor: colors.attentionSoft },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icone: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.off, alignItems: 'center', justifyContent: 'center' },
  iconeActive: { backgroundColor: colors.accentSoft },
  iconeAttention: { backgroundColor: '#F6E3A8' },
  titre: { fontSize: 14, fontWeight: '700', color: colors.text },
  consigne: { fontSize: 13, lineHeight: 17, color: colors.textMuted },
  piste: { height: 4, borderRadius: 2, backgroundColor: colors.accentSoft, overflow: 'hidden' },
  barre: { height: 4, borderRadius: 2, backgroundColor: colors.accent },
});
