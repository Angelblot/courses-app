import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useProducts, type Product } from '../stores/products';
import { useLiens } from '../stores/liens';
import { categorieLiens, type CategorieLiens, type FaitsLiens } from '../lib/liens';
import { PastillesDrives, phraseLiens } from '../components/PastillesDrives';
import { RAYONS, rayonDepuisLibelle } from '../lib/rayons';
import { Action, Head, Photo, ui, EspaceBas } from '../components/MaisonUI';
import { appuiLongFiche, ouvrirFiche } from '../components/FicheAppuiLong';
import { colors } from '../lib/theme';

const FILTRES: { cle: Exclude<CategorieLiens, 'ailleurs'>; titre: string }[] = [
  { cle: 'aucun', titre: 'Aucun drive' },
  { cle: 'carrefour', titre: 'Carrefour seul' },
  { cle: 'leclerc', titre: 'E.Leclerc seul' },
  { cle: 'deux', titre: 'Les deux' },
];

/**
 * Liens aux drives (variante RL1) : combien de produits chaque drive
 * connaît, et, rayon par rayon, ceux qui restent à relier. Un tap ouvre la
 * fiche, où l'on marque un produit absent ou acheté ailleurs.
 */
export default function Liens() {
  const p = useProducts(), liens = useLiens();
  useFocusEffect(useCallback(() => { p.recharger(); void liens.recharger(); }, [p.recharger, liens.recharger]));
  const [filtre, setFiltre] = useState<CategorieLiens>('aucun');
  const retour = () => { if (router.canGoBack()) router.back(); else router.dismissTo('/compte'); };
  const classes = useMemo(() => p.produits.map(x => ({ produit: x, cat: categorieLiens(x, liens.faits.get(x.id)) })), [p.produits, liens.faits]);
  const comptes = useMemo(() => {
    const c: Record<CategorieLiens, number> = { aucun: 0, carrefour: 0, leclerc: 0, deux: 0, ailleurs: 0 };
    for (const x of classes) c[x.cat]++;
    return c;
  }, [classes]);
  const groupes = useMemo(() => {
    const parRayon = new Map<string, Product[]>();
    for (const x of classes) if (x.cat === filtre) {
      const r = rayonDepuisLibelle(x.produit.category);
      parRayon.set(r, [...(parRayon.get(r) ?? []), x.produit]);
    }
    return RAYONS.filter(r => parRayon.has(r.cle)).map(r => ({ ...r, produits: parRayon.get(r.cle)!.sort((a, b) => a.name.localeCompare(b.name, 'fr')) }));
  }, [classes, filtre]);
  const chargement = p.chargement || liens.chargement, erreur = p.erreur || liens.erreur;
  return <SafeAreaView edges={['top']} style={ui.screen}>
    <ScrollView contentContainerStyle={[ui.content, { paddingBottom: 40 }]}>
      <Head title="Liens aux drives" back onBack={retour} avatar={false} />
      {chargement && !classes.length && <ActivityIndicator />}
      {!!erreur && <><Text style={ui.error}>{erreur}</Text><Action secondary onPress={() => { p.recharger(); void liens.recharger(); }}>Réessayer</Action></>}
      {!erreur && !!classes.length && <>
        <Text style={ui.subtitle}>Un produit est relié quand le drive le connaît : déjà acheté, mis au panier ou fiche mémorisée.</Text>
        <View style={s.tuiles}>
          {FILTRES.map(f => { const on = filtre === f.cle;
            return <Pressable key={f.cle} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`${f.titre} : ${comptes[f.cle]} produits`}
              onPress={() => setFiltre(f.cle)} style={({ pressed }) => [s.tuile, on && s.tuileOn, pressed && { opacity: .85 }]}>
              <Text style={[s.nombre, f.cle === 'aucun' && comptes.aucun > 0 && !on && { color: colors.attentionText }, on && { color: colors.accentContrast }]}>{comptes[f.cle]}</Text>
              <Text style={[s.legende, on && { color: colors.accentContrast }]}>{f.titre}</Text>
            </Pressable>; })}
        </View>
        {comptes.ailleurs > 0 && <Pressable accessibilityRole="button" accessibilityLabel={`Voir les produits achetés hors drive : ${comptes.ailleurs}`} onPress={() => setFiltre('ailleurs')} style={s.ailleurs}>
          <Text style={[ui.detail, { marginTop: 0, flex: 1 }]}>{comptes.ailleurs} produit{comptes.ailleurs > 1 ? 's' : ''} acheté{comptes.ailleurs > 1 ? 's' : ''} hors drive</Text>
          <Text style={ui.link}>{filtre === 'ailleurs' ? 'Affichés' : 'Voir'}</Text>
        </Pressable>}
        {!groupes.length && <View style={ui.notice}><Text style={ui.productName}>{filtre === 'aucun' ? 'Tout est relié.' : 'Aucun produit ici.'}</Text></View>}
        {groupes.map(g => <View key={g.cle} style={{ gap: 6 }}>
          <Text style={s.rayon}>{g.label.toUpperCase()} · {g.produits.length}</Text>
          <View style={s.carte}>
            {g.produits.map((x, i) => <Ligne key={x.id} produit={x} faits={liens.faits.get(x.id)} derniere={i === g.produits.length - 1} />)}
          </View>
        </View>)}
      </>}
    <EspaceBas /></ScrollView>
  </SafeAreaView>;
}

function Ligne({ produit, faits, derniere }: { produit: Product; faits: FaitsLiens | undefined; derniere: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${produit.name}. ${phraseLiens(produit, faits)}. Ouvrir la fiche`}
    onPress={() => ouvrirFiche(produit)} {...appuiLongFiche(produit)} style={({ pressed }) => [s.ligne, !derniere && s.separee, pressed && { opacity: .85 }]}>
    <Photo name={produit.name} url={produit.image_url} style={s.photo} />
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={s.nom} numberOfLines={2}>{produit.name}</Text>
      <PastillesDrives produit={produit} faits={faits} />
    </View>
  </Pressable>;
}

const s = StyleSheet.create({
  tuiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tuile: { flexBasis: '47%', flexGrow: 1, minHeight: 72, borderRadius: 14, backgroundColor: colors.surface, padding: 12, justifyContent: 'center', gap: 2 },
  tuileOn: { backgroundColor: colors.text },
  nombre: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  legende: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  ailleurs: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 4 },
  rayon: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3, color: colors.textMuted, paddingHorizontal: 4, marginTop: 6 },
  carte: { backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 12, paddingVertical: 8 },
  separee: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  photo: { width: 44, height: 44, borderRadius: 8 },
  nom: { fontSize: 15, fontWeight: '600', color: colors.text, lineHeight: 19 },
});
