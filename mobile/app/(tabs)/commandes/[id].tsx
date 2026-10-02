import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Action, Head, Photo, ui } from '../../../components/MaisonUI';
import { useCommandes } from '../../../stores/commandes';
import { useImagesCommande } from '../../../stores/images-commande';
import { comparerHistorique, ENSEIGNES, type Evolution } from '../../../lib/commandes.ts';
import { euros, jourLong, moisCourt, pourcent, BAISSE, HAUSSE } from '../../../lib/format-commande.ts';
import { colors } from '../../../lib/theme';

type Filtre = 'tous' | 'changes' | 'nouveaux';
const change = (e: Evolution) => e.ecart != null && Math.abs(e.ligne.prix! - e.avant!.prix) >= 0.01;

/**
 * Résumé d'une commande : la synthèse face aux achats précédents, puis
 * chaque produit avec son prix d'avant et l'écart. Un filtre isole les prix
 * qui ont changé, ou les produits achetés pour la première fois.
 */
export default function ResumeCommande() {
  const { id, drive: driveParam } = useLocalSearchParams<{ id: string; drive?: string }>();
  const { commandes, chargement, erreur, recharger } = useCommandes();
  const image = useImagesCommande();
  const commande = commandes.find(c => c.id === id);
  const [drive, setDrive] = useState<string | undefined>(driveParam);
  const choisi = commande && commande.drives.length > 1 ? (drive && commande.drives.includes(drive) ? drive : commande.drives[0]) : undefined;
  const c = useMemo(() => commande ? comparerHistorique(commande, commandes, choisi) : null, [commande, commandes, choisi]);
  const changes = c?.evolutions.filter(change) ?? [], nouveaux = c?.evolutions.filter(e => !e.avant) ?? [];
  const [filtre, setFiltre] = useState<Filtre | null>(null);
  const actif: Filtre = filtre ?? (changes.length ? 'changes' : 'tous');
  const lignes = actif === 'changes' ? changes : actif === 'nouveaux' ? nouveaux : c?.evolutions ?? [];
  const retour = () => { if (router.canGoBack()) router.back(); else router.replace('/commandes'); };

  return <SafeAreaView edges={['top']} style={ui.screen}>
    <ScrollView contentContainerStyle={[ui.content, { paddingBottom: 40 }]}>
      <Head title="Commande" back onBack={retour} avatar={false} />
      {chargement && !commande && <ActivityIndicator />}
      {!!erreur && <><Text style={ui.error}>{erreur}</Text><Action secondary onPress={recharger}>Réessayer</Action></>}
      {!chargement && !erreur && !commande && <View style={ui.notice}><Text style={ui.productName}>Commande introuvable.</Text><Text style={ui.subtitle}>Elle a peut-être été remplacée par sa facture.</Text></View>}
      {commande && c && <>
        <Text style={ui.subtitle}>{commande.lieu} · {jourLong(commande.jour)} · {c.evolutions.length} produit{c.evolutions.length > 1 ? 's' : ''}</Text>
        {commande.drives.length > 1 && <View style={s.filtres} accessibilityRole="tablist">
          {commande.drives.map(d => <Puce key={d} actif={d === choisi} onPress={() => setDrive(d)}>{ENSEIGNES[d] ?? d}</Puce>)}
        </View>}
        {c.communs > 0 ? <View style={s.bandeau} accessible accessibilityLabel={`Déjà achetés : ${c.communs} produits. ${Math.abs(c.ecart ?? 0) < 0.01 ? 'Stable' : pourcent(c.ecart!)}. ${euros(c.totalAvant)} la dernière fois, ${euros(c.totalMaintenant)} cette fois.`}>
          <Text style={s.bandeauTitre}>Déjà achetés : {c.communs} produit{c.communs > 1 ? 's' : ''}</Text>
          <Text style={s.bandeauEcart}>{Math.abs(c.ecart ?? 0) < 0.01 ? 'Stable' : pourcent(c.ecart!)}</Text>
          <Text style={s.bandeauTexte}>{euros(c.totalAvant)} la dernière fois, {euros(c.totalMaintenant)} cette fois</Text>
        </View> : <View style={ui.notice}><Text style={ui.subtitle}>Premiers achats : rien à comparer encore.</Text></View>}
        <View style={s.filtres} accessibilityRole="tablist">
          <Puce actif={actif === 'tous'} onPress={() => setFiltre('tous')}>{`Tous · ${c.evolutions.length}`}</Puce>
          {!!changes.length && <Puce actif={actif === 'changes'} onPress={() => setFiltre('changes')}>{`Prix changés · ${changes.length}`}</Puce>}
          {!!nouveaux.length && <Puce actif={actif === 'nouveaux'} onPress={() => setFiltre('nouveaux')}>{`Nouveaux · ${nouveaux.length}`}</Puce>}
        </View>
        <View style={s.liste}>
          {lignes.map((e, i) => <View key={`${e.ligne.drive}${e.ligne.libelle}${i}`} style={[s.ligne, i > 0 && s.separe]} accessible
            accessibilityLabel={`${e.ligne.libelle}${e.ligne.prix != null ? `, ${euros(e.ligne.prix)}` : ''}${e.avant ? `, avant ${euros(e.avant.prix)} en ${moisCourt(e.avant.jour)}${e.ecart != null && change(e) ? `, ${pourcent(e.ecart)}` : ', même prix'}` : ', nouveau'}`}>
            <Photo name={e.ligne.libelle} url={image(e.ligne)} style={s.photo} />
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={s.nom} numberOfLines={2}>{e.ligne.libelle}</Text>
              <Text style={s.detail}>{e.avant ? `avant ${euros(e.avant.prix)} · ${moisCourt(e.avant.jour)}` : 'nouveau'}{e.ligne.quantite > 1 ? ` · × ${e.ligne.quantite}` : ''}</Text>
            </View>
            <View style={s.prix}>
              {e.ligne.prix != null ? <Text style={s.prixTexte}>{euros(e.ligne.prix)}</Text> : <Text style={s.detail}>prix inconnu</Text>}
              {e.ecart != null && change(e) && <Text style={[s.ecart, { color: e.ecart > 0 ? HAUSSE : BAISSE }]}>{pourcent(e.ecart)}</Text>}
            </View>
          </View>)}
        </View>
      </>}
    </ScrollView>
  </SafeAreaView>;
}

function Puce({ actif, onPress, children }: { actif: boolean; onPress: () => void; children: string }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected: actif }} onPress={onPress} style={[s.puce, actif && s.puceActive]}>
    <Text style={[s.puceTexte, actif && s.puceTexteActif]}>{children}</Text>
  </Pressable>;
}

const s = StyleSheet.create({
  bandeau: { backgroundColor: colors.text, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, gap: 2 },
  bandeauTitre: { fontSize: 12, fontWeight: '600', color: '#CFE0BF' },
  bandeauEcart: { fontSize: 26, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  bandeauTexte: { fontSize: 13, color: '#DDE6D4', fontVariant: ['tabular-nums'] },
  filtres: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  puce: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center', backgroundColor: colors.off },
  puceActive: { backgroundColor: colors.text },
  puceTexte: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  puceTexteActif: { color: '#FFFFFF' },
  liste: { backgroundColor: colors.surface, borderRadius: 14, overflow: 'hidden' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 60, paddingHorizontal: 12, paddingVertical: 6 },
  separe: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  photo: { width: 40, height: 40, borderRadius: 6 },
  nom: { fontSize: 14, fontWeight: '600', color: colors.text },
  detail: { fontSize: 12, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  prix: { alignItems: 'flex-end', gap: 1 },
  prixTexte: { fontSize: 15, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  ecart: { fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
