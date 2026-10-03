import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Action, Head, ui, EspaceBas } from '../../components/MaisonUI';
import { useCommandes } from '../../stores/commandes';
import { comparerDrives, comparerHistorique, ENSEIGNES, type Commande } from '../../lib/commandes.ts';
import { euros, jourLong, pourcent, teinteEcart } from '../../lib/format-commande.ts';
import { colors } from '../../lib/theme';

/**
 * Mes commandes (variante EP2c) : factures importées et paniers remplis, du
 * plus récent au plus ancien, avec le total et l'écart sur les produits déjà
 * achetés. Toucher une commande ouvre son résumé.
 */
export default function Commandes() {
  const { commandes, chargement, erreur, recharger } = useCommandes();
  useFocusEffect(useCallback(() => { void recharger(); }, [recharger]));
  const retour = () => { if (router.canGoBack()) router.back(); else router.dismissTo('/compte'); };
  return <SafeAreaView edges={['top']} style={ui.screen}>
    <ScrollView contentContainerStyle={[ui.content, { paddingBottom: 40 }]}>
      <Head title="Mes commandes" back onBack={retour} avatar={false} />
      {chargement && !commandes.length && <ActivityIndicator />}
      {!!erreur && <><Text style={ui.error}>{erreur}</Text><Action secondary onPress={recharger}>Réessayer</Action></>}
      {!chargement && !erreur && (commandes.length
        ? <Text style={ui.subtitle}>Tes factures et les paniers remplis par l’extension.</Text>
        : <View style={ui.notice}><Text style={ui.productName}>Pas encore de commande.</Text><Text style={ui.subtitle}>Elles apparaissent quand l’extension a rempli un panier, ou quand tes factures sont importées.</Text></View>)}
      {commandes.map(c => <Carte key={c.id} commande={c} toutes={commandes} />)}
    <EspaceBas /></ScrollView>
  </SafeAreaView>;
}

function Carte({ commande: c, toutes }: { commande: Commande; toutes: Commande[] }) {
  const comparaison = useMemo(() => comparerHistorique(c, toutes, c.drives.length > 1 ? c.drives[0] : undefined), [c, toutes]);
  // Sur plusieurs drives, la ligne donne le verdict entre eux (CM1).
  const duel = useMemo(() => c.drives.length > 1 ? comparerDrives(c) : null, [c]);
  const verdict = duel ? duel.moinsCher ? `${ENSEIGNES[duel.moinsCher] ?? duel.moinsCher} moins cher de ${euros(duel.economie)}` : duel.communs.length ? 'Même total sur les drives' : null : null;
  const n = new Set(c.lignes.map(l => l.article ?? l.product_id ?? l.ean13 ?? l.libelle)).size;
  const ecart = comparaison.communs ? comparaison.ecart : null;
  const ecartTexte = ecart == null ? null : Math.abs(ecart) < 0.01 ? 'Stable' : pourcent(ecart);
  const detail = `${c.source === 'panier' ? `Panier rempli · ${c.lieu}` : c.lieu} · ${n} produit${n > 1 ? 's' : ''}`;
  return <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/commandes/[id]', params: { id: c.id } })}
    accessibilityLabel={`${jourLong(c.jour)}, ${c.total != null ? euros(c.total) : ''}, ${detail}${verdict ? `, ${verdict} sur ${duel!.communs.length} produits communs` : ecartTexte ? `, ${ecartTexte} sur ${comparaison.communs} produits déjà achetés` : ', premiers achats'}`}
    style={({ pressed }) => [s.carte, pressed && { opacity: .85 }]}>
    <View style={s.tete}><Text style={s.jour}>{jourLong(c.jour)}</Text>{c.total != null && <Text style={s.total}>{euros(c.total)}</Text>}</View>
    <Text style={s.detail}>{detail}</Text>
    <View style={s.vs}>
      {verdict
        ? <Text style={s.vsTexte}><Text style={s.ecart}>{verdict}</Text> sur {duel!.communs.length} produit{duel!.communs.length > 1 ? 's' : ''} commun{duel!.communs.length > 1 ? 's' : ''}</Text>
        : ecartTexte
        ? <><Text style={[s.ecart, { color: teinteEcart(ecart, colors.textMuted) }]}>{ecartTexte}</Text><Text style={s.vsTexte}>sur {comparaison.communs} produit{comparaison.communs > 1 ? 's' : ''} déjà acheté{comparaison.communs > 1 ? 's' : ''}</Text></>
        : <Text style={s.vsTexte}>Premiers achats, rien à comparer</Text>}
      <Feather name="chevron-right" size={18} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
    </View>
  </Pressable>;
}

const s = StyleSheet.create({
  carte: { backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 14, paddingTop: 12, gap: 4 },
  tete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  jour: { fontSize: 17, fontWeight: '700', color: colors.text },
  total: { fontSize: 17, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  detail: { fontSize: 13, color: colors.textMuted },
  vs: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  ecart: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  vsTexte: { fontSize: 14, color: colors.text, flexShrink: 1 },
});
