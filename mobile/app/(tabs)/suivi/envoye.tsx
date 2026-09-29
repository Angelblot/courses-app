import { useState } from 'react';
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
 * Clôture de la session : « Liste prête », puis trois étapes qui se cochent en direct, lues sur le
 * travail dans `cart_jobs`. L'envoi n'est jamais bloqué en amont : c'est ici
 * qu'on voit si l'ordinateur a pris la liste, et qu'on aide sinon.
 */
export default function Envoye() {
 const { id, n, drives, heure: heureEnvoi } = useLocalSearchParams<{ id: string; n?: string; drives?: string; heure?: string }>();
 const { travail } = useSuiviTravail(id ?? null);
 const total = Number(n) || 0, noms = (drives ?? '').split(',').filter(Boolean).map(d => NOMS[d] ?? d);
 const [envoyee, prise, remplie] = etapesEnvoi(travail?.status);
 // L'heure d'envoi vient de la feuille d'envoi ; à défaut, l'heure d'arrivée ici.
 const [heure] = useState(() => heureEnvoi || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
 const drivesTexte = noms.length ? noms.join(' et ') : 'le drive';
 const etapes: { etat: EtapeEnvoi; titre: string; detail: string; aide?: boolean; attente?: boolean }[] = [
  { etat: envoyee, titre: 'Liste envoyée', detail: `${total} produit${total > 1 ? 's' : ''}, à ${heure}` },
  // Tant que l'ordinateur n'a rien relevé, on attend calmement : il est peut-être éteint.
  { etat: prise, titre: prise === 'fait' ? 'Ton ordinateur a pris la liste' : 'En attente de ton ordinateur', detail: prise === 'fait' ? 'L’extension Chrome l’a relevée.' : 'Ouvre Chrome quand tu veux : l’extension la relèvera.', aide: prise === 'encours', attente: prise === 'encours' },
  { etat: remplie, titre: remplie === 'fait' ? 'Panier rempli' : 'Remplir le panier', detail: remplie === 'avenir' ? 'Tu vérifies puis paies sur le site du drive.' : travail ? resume(travail) : '' },
 ];
 return <SafeAreaView style={ui.screen}>
  <View style={e.corps}>
   <Text accessibilityRole="header" style={ui.heading}>{remplie === 'fait' ? 'Panier rempli.' : `Liste prête pour ${drivesTexte}.`}</Text>
   {prise !== 'fait' && <Text style={ui.subtitle}>Elle t’attend dans Chrome, sur ton ordinateur. Rien ne presse.</Text>}
   <View style={e.frise} accessibilityLiveRegion="polite">
    {etapes.map((t, i) => <View key={i}>
     {/* L'étape se lit d'un bloc ; le lien d'aide reste un bouton à part, atteignable par VoiceOver. */}
     <View style={e.etape} accessible accessibilityLabel={`${t.titre}, ${t.attente ? 'en attente' : LIBELLES[t.etat]}. ${t.detail}`}>
      <Pastille etat={t.etat} attente={t.attente} />
      <View style={{ flex: 1, gap: 2 }}>
       <Text style={[ui.productName, t.etat === 'avenir' && { color: colors.textMuted }]}>{t.titre}</Text>
       {!!t.detail && <Text style={[ui.detail, { marginTop: 0 }, t.etat === 'erreur' && { color: colors.danger }]}>{t.detail}</Text>}
      </View>
     </View>
     {t.aide && <Pressable accessibilityRole="button" onPress={() => { void Share.share({ message: CONSIGNES_EXTENSION }); }} style={e.aide}><Text style={ui.link}>Elle n’est pas installée ?</Text></Pressable>}
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

function Pastille({ etat, attente }: { etat: EtapeEnvoi; attente?: boolean }) {
 // L'attente de l'ordinateur n'a pas d'indicateur qui tourne : rien n'avance tant qu'il est éteint.
 if (attente) return <View style={e.pastille}><Feather name="monitor" size={15} color={colors.textMuted} /></View>;
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
 aide: { minHeight: 44, justifyContent: 'center', marginLeft: 44 },
 encours: { borderColor: colors.accent },
});
