import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Action, ui } from '../../components/MaisonUI';
import { useSuiviTravail } from '../../stores/suivi';
import { useCommandes } from '../../stores/commandes';
import { useImagesCommande } from '../../stores/images-commande';
import { comparerDrives, comparerHistorique } from '../../lib/commandes.ts';
import { ComparaisonCommande } from '../../components/ComparaisonCommande';
import { VerdictDrives } from '../../components/VerdictDrives';
import { etapesEnvoi, resume, type EtapeEnvoi } from '../../lib/suivi-libelles.ts';
import { CONSIGNES_EXTENSION } from '../../lib/extension-consignes';
import { EtatExtension } from '../../components/EtatExtension';
import { useExtension } from '../../stores/extension';
import { colors } from '../../lib/theme';

const NOMS: Record<string, string> = { carrefour: 'Carrefour', leclerc: 'E.Leclerc' };

/**
 * Clôture de la session : « Liste prête », puis trois étapes qui se cochent en direct, lues sur le
 * travail dans `cart_jobs`. L'envoi n'est jamais bloqué en amont : c'est ici
 * qu'on voit si l'ordinateur a pris la liste, et qu'on aide sinon.
 */
export default function Envoye() {
 const { id, n, drives, heure: heureEnvoi } = useLocalSearchParams<{ id: string; n?: string; drives?: string; heure?: string }>();
 const { travail } = useSuiviTravail(id ?? null);
 // L'ordinateur vu d'ici : est-il là, et que fait l'extension ? (synchronisation dans les deux sens)
 const extension = useExtension();
 const total = Number(n) || 0, noms = (drives ?? '').split(',').filter(Boolean).map(d => NOMS[d] ?? d);
 const [envoyee, prise, remplie] = etapesEnvoi(travail?.status);
 // L'heure d'envoi vient de la feuille d'envoi ; à défaut, l'heure d'arrivée ici.
 const [heure] = useState(() => heureEnvoi || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
 // iOS n'a pas de région live : VoiceOver annonce chaque étape franchie.
 const annonce = remplie === 'fait' ? 'Panier rempli.' : remplie === 'erreur' ? 'Le remplissage n’a pas abouti.' : remplie === 'attention' ? 'Une action t’attend sur l’ordinateur.' : prise === 'fait' ? 'Ton ordinateur a pris la liste.' : null, derniere = useRef<string | null>(null);
 useEffect(() => { if (Platform.OS === 'ios' && annonce && annonce !== derniere.current) AccessibilityInfo.announceForAccessibility(annonce); derniere.current = annonce; }, [annonce]);
 // Dès que le panier est rempli, il se compare aux achats précédents (EP2a).
 const { commandes } = useCommandes(remplie === 'fait' ? travail?.status : null);
 const image = useImagesCommande();
 const commande = remplie === 'fait' && id ? commandes.find(c => c.id === `panier:${id}`) : undefined;
 // Plusieurs drives remplis : le verdict entre eux prend la place des étapes (CM1).
 const plusieurs = !!commande && commande.drives.length > 1;
 const introuvables = Object.fromEntries(Object.entries(travail?.results ?? {}).map(([d, r]) => [d, (r ?? []).filter(x => !x.ok).length]));
 const drivesTexte = noms.length ? noms.join(' et ') : 'le drive';
 const etapes: { etat: EtapeEnvoi; titre: string; detail: string; aide?: boolean; attente?: boolean }[] = [
  { etat: envoyee, titre: 'Liste envoyée', detail: `${total} produit${total > 1 ? 's' : ''}, à ${heure}` },
  // Tant que l'ordinateur n'a rien relevé, on attend calmement : il est peut-être éteint.
  { etat: prise, titre: prise === 'fait' ? 'Ton ordinateur a pris la liste' : 'En attente de ton ordinateur', detail: prise === 'fait' ? 'L’extension Chrome l’a relevée.' : 'Ouvre Chrome quand tu veux : l’extension la relèvera.', aide: prise === 'encours', attente: prise === 'encours' },
  { etat: remplie, titre: remplie === 'fait' ? 'Panier rempli' : 'Remplir le panier', detail: remplie === 'avenir' ? 'Tu vérifies puis paies sur le site du drive.' : travail ? resume(travail) : '' },
 ];
 return <SafeAreaView style={ui.screen}>
  <ScrollView contentContainerStyle={e.corps}>
   <Text accessibilityRole="header" style={ui.heading}>{remplie === 'fait' ? (plusieurs ? 'Paniers remplis.' : 'Panier rempli.') : `Liste prête pour ${drivesTexte}.`}</Text>
   {plusieurs && <Text style={[ui.subtitle, { marginTop: -10 }]}>Sur {commande!.lieu}.</Text>}
   {prise !== 'fait' && <Text style={ui.subtitle}>Elle t’attend dans Chrome, sur ton ordinateur. Rien ne presse.</Text>}
   {!plusieurs && <View style={e.frise} accessibilityLiveRegion="polite">
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
   </View>}
   {!plusieurs && remplie !== 'fait' && remplie !== 'erreur' && <EtatExtension etat={extension} attendu="remplissage" />}
   {plusieurs && <VerdictDrives comparaison={comparerDrives(commande!)} introuvables={introuvables}
    historique={commande!.drives.map(d => { const h = comparerHistorique(commande!, commandes, d); return { drive: d, ecart: h.ecart, communs: h.communs }; })}
    onDrive={d => router.push({ pathname: '/commandes/[id]', params: { id: commande!.id, drive: d } })} />}
   {commande && !plusieurs && commande.drives.map(d => <ComparaisonCommande key={d} comparaison={comparerHistorique(commande, commandes, d)} drive={commande.drives.length > 1 ? d : undefined}
    image={ev => image(ev.ligne)} onVoir={() => router.push({ pathname: '/commandes/[id]', params: { id: commande.id, drive: d } })} />)}
  </ScrollView>
  <View style={ui.footer}>
   <Action onPress={() => router.dismissTo('/')}>Terminer</Action>
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
 corps: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 18 },
 frise: { backgroundColor: colors.surface, borderRadius: 16, padding: 18, gap: 18 },
 etape: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
 pastille: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: colors.traitControle, alignItems: 'center', justifyContent: 'center' },
 fait: { backgroundColor: colors.accent, borderColor: colors.accent },
 aide: { minHeight: 44, justifyContent: 'center', marginLeft: 44 },
 encours: { borderColor: colors.accent },
});
