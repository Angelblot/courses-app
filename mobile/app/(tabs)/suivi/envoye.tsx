import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Action, ui } from '../../../components/MaisonUI';
import { useSuiviTravail } from '../../../stores/suivi';
import { etapesEnvoi, resume, type EtapeEnvoi } from '../../../lib/suivi-libelles.ts';
import { CONSIGNES_EXTENSION } from '../../../lib/extension-consignes';
import { colors } from '../../../lib/theme';

const NOMS: Record<string, string> = { carrefour: 'Carrefour', leclerc: 'E.Leclerc' };

/**
 * Clôture de la session : trois étapes qui se cochent en direct, lues sur le
 * travail dans `cart_jobs`. L'envoi n'est jamais bloqué en amont : c'est ici
 * qu'on voit si l'ordinateur a pris la liste, et qu'on aide sinon.
 */
export default function Envoye() {
 const { id, n, drives } = useLocalSearchParams<{ id: string; n?: string; drives?: string }>();
 const { travail } = useSuiviTravail(id ?? null);
 const total = Number(n) || 0, noms = (drives ?? '').split(',').filter(Boolean).map(d => NOMS[d] ?? d);
 const panier = noms.length > 1 ? `les paniers ${noms.join(' et ')}` : `le panier ${noms[0] ?? 'du drive'}`;
 const [envoyee, prise, remplie] = etapesEnvoi(travail?.status);
 const etapes: { etat: EtapeEnvoi; titre: string; detail: string; aide?: boolean }[] = [
  { etat: envoyee, titre: 'Liste envoyée', detail: `${total} article${total > 1 ? 's' : ''} pour ${panier}.` },
  { etat: prise, titre: prise === 'fait' ? 'Ton ordinateur a pris la liste' : 'Ton ordinateur prend la liste', detail: prise === 'fait' ? 'L’extension Chrome l’a relevée.' : 'Ouvre Chrome : l’extension la relève seule.', aide: prise === 'encours' },
  { etat: remplie, titre: remplie === 'fait' ? 'Panier rempli' : 'Remplir le panier', detail: remplie === 'avenir' ? 'Tu vérifies puis paies sur le site du drive.' : travail ? resume(travail) : '' },
 ];
 return <SafeAreaView style={ui.screen}>
  <View style={e.corps}>
   <Text accessibilityRole="header" style={ui.heading}>{remplie === 'fait' ? 'Panier rempli.' : 'C’est envoyé.'}</Text>
   <View style={e.frise} accessibilityLiveRegion="polite">
    {etapes.map((t, i) => <View key={i} style={e.etape} accessible accessibilityLabel={`${t.titre}, ${LIBELLES[t.etat]}. ${t.detail}`}>
     <Pastille etat={t.etat} />
     <View style={{ flex: 1, gap: 2 }}>
      <Text style={[ui.productName, t.etat === 'avenir' && { color: colors.textMuted }]}>{t.titre}</Text>
      {!!t.detail && <Text style={[ui.detail, { marginTop: 0 }, t.etat === 'erreur' && { color: colors.danger }]}>{t.detail}</Text>}
      {t.aide && <Pressable accessibilityRole="button" onPress={() => { void Share.share({ message: CONSIGNES_EXTENSION }); }} hitSlop={8} style={{ minHeight: 32, justifyContent: 'center' }}><Text style={ui.link}>Elle n’est pas installée ?</Text></Pressable>}
     </View>
    </View>)}
   </View>
  </View>
  <View style={ui.footer}>
   <Action onPress={() => router.replace('/')}>Terminer</Action>
   {!!id && <Pressable accessibilityRole="button" onPress={() => router.replace(`/suivi/${id}`)} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={ui.link}>Voir le détail du remplissage</Text></Pressable>}
  </View>
 </SafeAreaView>;
}

const LIBELLES: Record<EtapeEnvoi, string> = { fait: 'fait', encours: 'en cours', attention: 'une action t’attend sur l’ordinateur', erreur: 'n’a pas abouti', avenir: 'à venir' };

function Pastille({ etat }: { etat: EtapeEnvoi }) {
 if (etat === 'fait') return <View style={[e.pastille, e.fait]}><Feather name="check" size={16} color={colors.accentContrast} /></View>;
 if (etat === 'encours') return <View style={[e.pastille, e.encours]}><ActivityIndicator size="small" color={colors.accent} /></View>;
 if (etat === 'attention') return <View style={[e.pastille, { borderColor: colors.attention }]}><Feather name="alert-circle" size={16} color={colors.attentionText} /></View>;
 if (etat === 'erreur') return <View style={[e.pastille, { borderColor: colors.danger }]}><Feather name="x" size={16} color={colors.danger} /></View>;
 return <View style={e.pastille} />;
}

const e = StyleSheet.create({
 corps: { flex: 1, justifyContent: 'center', padding: 24, gap: 18 },
 frise: { backgroundColor: colors.surface, borderRadius: 16, padding: 18, gap: 18 },
 etape: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
 pastille: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: colors.traitControle, alignItems: 'center', justifyContent: 'center' },
 fait: { backgroundColor: colors.accent, borderColor: colors.accent },
 encours: { borderColor: colors.accent },
});
