import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { TableauComparatif, type LigneComparatif } from '../components/FicheOffre';
import { ui } from '../components/MaisonUI';
import { enregistrerAlternatives, useProducts, type Product } from '../stores/products';
import { chargerHistorique } from '../stores/historique';
import { lookupEan, type FicheProduit, type NoteNutri } from '../lib/openfoodfacts.ts';
import { moinsChers, prixAuKilo, type Achat } from '../lib/historique-prix.ts';
import { reordonner } from '../lib/references';
import { euros, moisCourt } from '../lib/format-commande.ts';
import { colors, spacing } from '../lib/theme';

/** La colonne d'un produit du catalogue, avant que les repères d'Open Food Facts n'arrivent. */
const colonne = (p: Product): FicheProduit => ({
  ean13: p.ean13 ?? p.id, name: p.name, brand: p.brand, imageUrl: p.image_url, grammageG: p.grammage_g, volumeMl: p.volume_ml,
  productType: p.product_type, categoryKey: null, nutriscore: (p.nutriscore as NoteNutri | null) ?? null,
});

/**
 * Comparer les produits d'un ordre d'essai, côte à côte : le dernier prix
 * payé et le prix au kilo, puis les scores et les repères pour 100 g d'Open
 * Food Facts, le meilleur de chaque ligne en vert. « Mettre en 1er » fait
 * d'une alternative le produit que Siri et le panier prennent d'abord.
 * `ids` : les produits dans l'ordre d'essai ; `reference` : la référence.
 */
export default function Comparer() {
  const { ids = '', reference = '' } = useLocalSearchParams<{ ids: string; reference: string }>();
  const p = useProducts();
  const ordre = useMemo(() => ids.split(',').filter(Boolean), [ids]);
  const produits = ordre.map(id => p.produits.find(x => x.id === id)).filter((x): x is Product => !!x);
  const [details, setDetails] = useState<Record<string, FicheProduit | null>>({});
  const [prix, setPrix] = useState<Record<string, Achat | null>>({});
  const [envoi, setEnvoi] = useState<string | null>(null), [erreur, setErreur] = useState<string | null>(null);
  const charges = produits.map(x => x.id).join(',');

  useEffect(() => {
    let actif = true;
    for (const x of produits) {
      if (x.ean13 && !(x.id in details)) void lookupEan(x.ean13).then(r => { if (actif) setDetails(d => ({ ...d, [x.id]: r.etat === 'trouve' ? r.fiche : null })); });
      if (!(x.id in prix)) void chargerHistorique(x.id, x.ean13).then(r => { if (actif) setPrix(d => ({ ...d, [x.id]: 'historique' in r ? r.historique.dernier : null })); });
    }
    return () => { actif = false; };
  }, [charges]);

  // Le catalogue d'abord ; Open Food Facts complète les repères, et le Nutri-Score quand le catalogue ne l'a pas.
  const colonnes = produits.map(x => { const c = colonne(x), off = details[x.id];
    return off ? { ...c, nutriscore: c.nutriscore ?? off.nutriscore, ...(off.details ? { details: off.details } : {}) } : c; });
  const kilos = produits.map(x => prixAuKilo(prix[x.id]?.paye, x.grammage_g, x.volume_ml));
  const attente = produits.some(x => !(x.id in prix) || (x.ean13 && !(x.id in details)));
  const avant: LigneComparatif[] = [
    ['prix', 'Dernier prix', (_, i) => { const a = prix[produits[i].id]; return a ? <><Text style={s.prix}>{euros(a.paye)}</Text><Text style={s.date}>{moisCourt(a.jour)}</Text></> : <Text style={s.cellule}>{produits[i].id in prix ? 'jamais acheté' : '…'}</Text>; }],
    ['kilo', 'Au kilo', (_, i) => <Text style={s.cellule}>{kilos[i] ? `${euros(kilos[i]!.valeur)}/${kilos[i]!.unite}` : '—'}</Text>],
  ];

  const mettreEnPremier = async (id: string) => {
    if (envoi) return;
    setEnvoi(id); setErreur(null);
    const r = await enregistrerAlternatives(reordonner(reference, [id, ...ordre.filter(x => x !== id)]));
    setEnvoi(null);
    if (!r.ok) { setErreur(r.erreur ?? 'Impossible de changer l’ordre pour le moment.'); return; }
    void p.recharger();
    router.back();
  };
  const fermer = () => { if (router.canGoBack()) router.back(); else router.dismissTo('/'); };

  return <SafeAreaView edges={['bottom']} style={s.ecran}>
    <View style={s.barre}>
      <Pressable accessibilityRole="button" onPress={fermer} style={s.bouton}><Text style={s.boutonTexte}>Fermer</Text></Pressable>
      <Text style={s.titre} accessibilityRole="header">Comparer</Text>
      <View style={s.bouton}>{attente && <ActivityIndicator color={colors.accent} />}</View>
    </View>
    <ScrollView contentContainerStyle={s.corps}>
      {produits.length < 2 ? <Text style={[ui.subtitle, { paddingHorizontal: spacing.lg }]}>{p.chargement ? 'Chargement…' : 'Il faut au moins deux produits pour comparer.'}</Text> : <>
        <TableauComparatif colonnes={colonnes} avant={avant} meilleursAvant={{ kilo: moinsChers(kilos) }}
          pied={(c, i) => i === 0 ? <Text style={s.premier}>1er essayé</Text>
            : <Pressable accessibilityRole="button" accessibilityLabel={`Mettre ${c.name} en premier`} disabled={!!envoi} onPress={() => void mettreEnPremier(produits[i].id)} style={({ pressed }) => [s.action, pressed && { opacity: .8 }]}>
              {envoi === produits[i].id ? <ActivityIndicator color={colors.accent} /> : <Text style={s.actionTexte} numberOfLines={1} adjustsFontSizeToFit>Mettre en 1er</Text>}
            </Pressable>} />
        {!!erreur && <Text accessibilityLiveRegion="polite" style={[ui.error, { paddingHorizontal: spacing.lg }]}>{erreur}</Text>}
        <Text style={[ui.detail, { textAlign: 'center', paddingHorizontal: spacing.lg }]}>Prix du dernier achat · repères pour 100 g · le meilleur de chaque ligne en vert</Text>
      </>}
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.bg },
  barre: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, minHeight: 52 },
  bouton: { minWidth: 72, minHeight: 44, justifyContent: 'center' },
  boutonTexte: { fontSize: 17, color: colors.accent },
  titre: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: colors.text },
  corps: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: 14 },
  prix: { fontSize: 14, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  date: { fontSize: 11, color: colors.textMuted },
  cellule: { fontSize: 12, color: colors.text, textAlign: 'center', fontVariant: ['tabular-nums'] },
  premier: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textAlign: 'center' },
  action: { alignSelf: 'stretch', minHeight: 40, paddingHorizontal: 6, borderRadius: 10, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  actionTexte: { fontSize: 13, fontWeight: '700', color: colors.accent, textAlign: 'center' },
});
