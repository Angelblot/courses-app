import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Action, ui } from '../../../components/MaisonUI';
import { colors } from '../../../lib/theme';

const NOMS: Record<string, string> = { carrefour: 'Carrefour', leclerc: 'E.Leclerc' };

/**
 * Clôture de la session : ce qui est fait, et les trois gestes qui restent
 * sur l'ordinateur. Le suivi technique est à un tap.
 */
export default function Envoye() {
 const { id, n, drives } = useLocalSearchParams<{ id: string; n?: string; drives?: string }>();
 const total = Number(n) || 0, noms = (drives ?? '').split(',').filter(Boolean).map(d => NOMS[d] ?? d);
 const panier = noms.length > 1 ? `les paniers ${noms.join(' et ')}` : `le panier ${noms[0] ?? 'du drive'}`;
 return <SafeAreaView style={ui.screen}>
  <View style={e.corps}>
   <View style={e.ok}><Feather name="check" size={40} color={colors.accentContrast} /></View>
   <Text accessibilityRole="header" style={[ui.heading, { textAlign: 'center' }]}>C’est envoyé.</Text>
   <Text style={[ui.subtitle, { textAlign: 'center', maxWidth: 320 }]}>{total} article{total > 1 ? 's' : ''} attend{total > 1 ? 'ent' : ''} ton ordinateur pour remplir {panier}.</Text>
   <View style={e.etapes}>
    {['Ouvre Chrome sur ton ordinateur.', 'Clique « Remplir le panier » dans l’extension.', 'Vérifie et paie sur le site du drive.'].map((t, i) => <View key={t} style={ui.row}><View style={e.num}><Text style={e.numTexte}>{i + 1}</Text></View><Text style={[ui.productName, { flex: 1, fontWeight: '400' }]}>{t}</Text></View>)}
   </View>
  </View>
  <View style={ui.footer}>
   {!!id && <Action onPress={() => router.replace(`/suivi/${id}`)}>Suivre le remplissage</Action>}
   <Action secondary onPress={() => router.replace('/')}>Terminer</Action>
  </View>
 </SafeAreaView>;
}

const e = StyleSheet.create({
 corps: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
 ok: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
 etapes: { alignSelf: 'stretch', backgroundColor: colors.surface, borderRadius: 14, padding: 16, gap: 12, marginTop: 6 },
 num: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
 numTexte: { color: colors.accent, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
