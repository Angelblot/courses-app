import { useEffect, useState, type ReactNode } from 'react';
import { Feuille } from './Feuille';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWizard } from '../contexts/WizardContext';
import type { Product } from '../stores/products';
import type { LigneMaison } from '../lib/liste-maison';
import { produitsProches, type Manque } from '../lib/session-courses';
import { sources } from './Manques';
import { Action, Photo, ui, nomDialogue } from './MaisonUI';
import { Feather } from '@expo/vector-icons';
import { colors } from '../lib/theme';

type Doublon = { id: string; a: LigneMaison; b: LigneMaison };

/**
 * « Préciser … » : les manques notés à la main et les doublons
 * possibles, réglés sans quitter le bilan. Un manque s'ouvre sur les
 * produits qui lui ressemblent : un tap le précise ; sinon il part tel quel. Le bilan ferme la feuille
 * dès qu'il ne reste plus rien.
 */
export function ReglerSheet({ visible, onFermer, manques, doublons, products, onRetrait, toast }: { visible: boolean; onFermer: () => void; manques: [string, Manque][]; doublons: Doublon[]; products: Product[]; onRetrait: (texte: string, annuler: () => void) => void; toast?: ReactNode }) {
 const insets = useSafeAreaInsets(), { height } = useWindowDimensions(), w = useWizard();
 const nb = manques.length + doublons.length;
 const titreCourant = manques.length === 1 && !doublons.length ? `Préciser « ${manques[0][1].name} »` : doublons.length === 1 && !manques.length ? 'Lequel garder ?' : `Préciser ${nb} produit${nb > 1 ? 's' : ''}`;
 // Figé tant qu'il reste quelque chose : pendant la fermeture, la feuille
 // afficherait « Préciser 0 produit ».
 const [titre, setTitre] = useState(titreCourant);
 useEffect(() => { if (nb > 0) setTitre(titreCourant); }, [nb, titreCourant]);
 const retirer = (l: LigneMaison) => { const avant = w.ligneQuantites[l.key]; w.modifierLigne(l.key, 0); onRetrait(`${l.name} retiré de ta liste`, () => w.restaurerLigne(l.key, avant)); };
 return <Feuille visible={visible} onFermer={onFermer} nom={titre} clavier>
   <View style={[s.panneau, { paddingBottom: 12 + insets.bottom }]} accessibilityViewIsModal accessibilityLabel={titre} onAccessibilityEscape={onFermer}>
    <View style={s.entete}><Text style={[s.titre, { flex: 1, marginBottom: 0 }]} accessibilityRole="header">{titre}</Text><Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={onFermer} hitSlop={6} style={s.fermer}><Feather name="x" size={22} color={colors.text} /></Pressable></View>
    <ScrollView style={{ maxHeight: height * 0.72 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
     {manques.map(([key, m]) => <PreciserManque key={key} lineKey={key} manque={m} products={products} seul={manques.length === 1 && !doublons.length} />)}
     {/* Un doublon possible : on touche la photo du produit qu'on garde, l'autre est retiré (annulable). */}
     {doublons.map(d => <View key={d.id} style={s.doublon}>
      {(manques.length > 0 || doublons.length > 1) && <Text style={ui.productName}>Lequel garder ?</Text>}
      <Text style={[ui.detail, { marginTop: 0 }]}>Touche celui que tu gardes, l’autre est retiré.</Text>
      <View style={s.duo}>{[[d.a, d.b], [d.b, d.a]].map(([garde, autre]) => { const produit = products.find(p => p.id === garde.product_id); return <Pressable key={garde.key} accessibilityRole="button" accessibilityLabel={`Garder ${garde.name}, ${garde.totalQuantity} article${garde.totalQuantity > 1 ? 's' : ''}. Retire ${autre.name}`} onPress={() => retirer(autre)} style={({ pressed }) => [s.tuile, pressed && s.tuileAppuyee]}>
       <View style={s.image}><Photo name={garde.name} url={produit?.image_url} style={s.photo} /></View>
       <View style={s.texte}><Text style={ui.productName} numberOfLines={2}>{garde.name}</Text><Text style={[ui.detail, { marginTop: 2 }]} numberOfLines={1}>{[...new Set(garde.sources.map(x => x.label))].join(' · ')}</Text><Text style={s.qte}>× {garde.totalQuantity}</Text></View>
      </Pressable>; })}</View>
      <Action secondary onPress={() => w.accepterDoublon(d.id)}>Garder les deux</Action>
     </View>)}
    </ScrollView>
    <View>{toast}</View>
   </View>
 </Feuille>;
}

/** Un manque à préciser : ses produits proches d'abord, « Laisser tel quel » ensuite. */
function PreciserManque({ lineKey, manque, products, seul }: { lineKey: string; manque: Manque; products: Product[]; seul: boolean }) {
 const w = useWizard(), [search, setSearch] = useState('');
 const id = lineKey.startsWith('produit:') ? lineKey.slice(8) : undefined, extra = w.extras.find(x => `extra:${x.id}` === lineKey);
 const qty = id ? w.quotidienQty[id] ?? 1 : extra?.quantity ?? 1, nom = extra?.name ?? manque.name, q = search.trim().toLowerCase();
 const resultats = q.length >= 2 ? products.filter(p => p.name.toLowerCase().includes(q)).slice(0, 5) : produitsProches(nom, products);
 const detail = (p: Product) => [p.brand, p.volume_ml ? `${p.volume_ml} ml` : p.grammage_g ? `${p.grammage_g} g` : null].filter(Boolean).join(' · ');
 return <View style={[s.manque, !seul && s.carte]}>
  {!seul && <Text style={ui.productName}>« {nom} »</Text>}
  <Text style={[ui.detail, { marginTop: 0 }]}>{[sources[manque.source], `sans choix, l’extension cherchera « ${nom} »`].filter(Boolean).join(' · ')}</Text>
  <TextInput style={ui.input} value={search} onChangeText={setSearch} placeholder="Chercher un autre produit…" placeholderTextColor={colors.textMuted} accessibilityLabel={`Chercher le produit exact pour ${nom}`} />
  {resultats.length > 0 ? <View style={{ gap: 8 }}>
   <Text style={[ui.detail, { marginTop: 0 }]}>{q.length >= 2 ? 'Résultats' : 'Dans tes produits'}</Text>
   {resultats.map(p => <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Choisir : ${p.name}${detail(p) ? `, ${detail(p)}` : ''}`} onPress={() => { Keyboard.dismiss(); w.validerManque(lineKey, qty, p.id); }} style={({ pressed }) => [s.produit, pressed && { opacity: .85 }]}>
    <Photo name={p.name} url={p.image_url} />
    <View style={{ flex: 1 }}><Text style={ui.productName}>{p.name}</Text>{!!detail(p) && <Text style={[ui.detail, { marginTop: 1 }]}>{detail(p)}</Text>}</View>
    <Text style={ui.link}>Choisir</Text>
   </Pressable>)}
  </View> : <Text style={[ui.detail, { marginTop: 0 }]}>{q.length >= 2 ? 'Aucun produit trouvé. Essaie un autre nom.' : `Aucun de tes produits ne ressemble à « ${nom} ». Cherche-le par un autre nom.`}</Text>}
  <Action secondary onPress={() => { Keyboard.dismiss(); w.validerManque(lineKey, qty); }}>{`Laisser « ${nom} » tel quel`}</Action>
 </View>;
}

const s = StyleSheet.create({
 manque: { gap: 10 },
 carte: { backgroundColor: colors.surface, borderRadius: 12, padding: 12 },
 produit: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, padding: 10, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.traitControle },
 fond: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,28,16,0.32)' },
 panneau: { backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 10 },
 entete: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingLeft: 4 },
 fermer: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
 titre: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.4, paddingHorizontal: 4, marginBottom: 12 },
 doublon: { gap: 10 },
 duo: { flexDirection: 'row', gap: 10 },
 tuile: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.traitControle, overflow: 'hidden' },
 tuileAppuyee: { borderWidth: 3, borderColor: colors.accent },
 image: { height: 112, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' },
 photo: { width: 92, height: 92, borderRadius: 8 },
 texte: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10 },
 qte: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 4, fontVariant: ['tabular-nums'] },
});
