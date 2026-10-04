import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { classement, enseigneExclusive, referenceDe, reordonner } from '../lib/references';
import { enregistrerAlternatives, type Product } from '../stores/products';
import { SelecteurIngredient } from './SelecteurIngredient';
import { Photo, ui } from './MaisonUI';
import { appuiLongFiche } from './FicheAppuiLong';
import { colors } from '../lib/theme';

/** Hauteur fixe d'une ligne : le glisser se mesure en lignes. */
const HAUTEUR = 68;
const NOMS = { carrefour: 'Carrefour', leclerc: 'E.Leclerc' } as const;

/**
 * Référence et alternatives d'un produit (variante AL3) : une seule liste
 * classée. La première est la référence (fond vert) : Siri l'ajoute, le
 * panier l'essaie d'abord, puis les suivantes si elle manque au drive. On
 * réordonne en faisant glisser les poignées, les autres lignes s'écartant
 * en direct ; VoiceOver propose « monter » et « descendre ». Un appui long
 * sur une ligne ouvre l'aperçu du produit, avec son dernier prix.
 */
export function ClassementProduit({ produit, produits, onChange, onGlisse }: { produit: Product; produits: Product[]; onChange?: () => void;
  /** Un glisser commence ou finit : la fiche fige son défilement et sa fermeture. */
  onGlisse?: (enCours: boolean) => void }) {
  const reference = referenceDe(produit.id, produits) ?? produit;
  const depuisServeur = useMemo(() => classement(reference, produits).map(p => p.id), [reference, produits]);
  const [ordre, setOrdre] = useState(depuisServeur);
  useEffect(() => { setOrdre(depuisServeur); }, [depuisServeur.join(',')]);
  const [erreur, setErreur] = useState<string | null>(null), [ajout, setAjout] = useState(false);
  const [actif, setActif] = useState<number | null>(null), [cible, setCible] = useState<number | null>(null);
  const decalage = useRef(new Animated.Value(0)).current;
  const parId = new Map(produits.map(p => [p.id, p]));
  const lignes = ordre.map(id => parId.get(id)).filter((p): p is Product => !!p);

  const enregistrer = async (nouvel: string[]) => {
    const avant = ordre;
    setOrdre(nouvel); setErreur(null);
    const r = await enregistrerAlternatives(reordonner(reference.id, nouvel));
    if (!r.ok) { setOrdre(avant); setErreur(r.erreur ?? null); return; }
    onChange?.();
  };
  const deplacer = (de: number, vers: number) => {
    const cible = Math.max(0, Math.min(ordre.length - 1, vers));
    if (cible === de) return;
    const nouvel = [...ordre];
    const [id] = nouvel.splice(de, 1);
    nouvel.splice(cible, 0, id);
    void enregistrer(nouvel);
  };
  const retirer = (i: number) => { if (i > 0) void enregistrer(ordre.filter((_, k) => k !== i)); };

  // Le geste d'une poignée démarre au toucher : ni le défilement de la fiche
  // ni le glisser qui ferme la feuille ne peuvent le lui prendre. Un geste
  // par produit, et non par rang : après un déplacement, les lignes changent
  // de place, et une poignée qui recevrait le geste d'une autre resterait
  // inerte jusqu'au rendu suivant. Le rang se lit au moment du toucher.
  const deplacerRef = useRef(deplacer), cibleRef = useRef<number | null>(null), departRef = useRef(0), onGlisseRef = useRef(onGlisse), ordreRef = useRef(ordre);
  deplacerRef.current = deplacer; onGlisseRef.current = onGlisse; ordreRef.current = ordre;
  const cleIds = [...ordre].sort().join(',');
  const poignees = useMemo(() => new Map(cleIds.split(',').filter(Boolean).map(id => {
    const vers = (dy: number) => Math.max(0, Math.min(ordreRef.current.length - 1, departRef.current + Math.round(dy / HAUTEUR)));
    return [id, Gesture.Pan().minDistance(0).runOnJS(true)
      .onStart(() => {
        const i = Math.max(0, ordreRef.current.indexOf(id));
        departRef.current = i; cibleRef.current = i; setActif(i); setCible(i); decalage.setValue(0); onGlisseRef.current?.(true);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      })
      .onUpdate((e) => {
        decalage.setValue(e.translationY);
        const v = vers(e.translationY);
        if (v !== cibleRef.current) { cibleRef.current = v; setCible(v); void Haptics.selectionAsync().catch(() => {}); }
      })
      .onEnd((e) => { deplacerRef.current(departRef.current, vers(e.translationY)); })
      .onFinalize(() => { cibleRef.current = null; setActif(null); setCible(null); decalage.setValue(0); onGlisseRef.current?.(false); })] as const;
  })), [cleIds, decalage]);
  // Pendant un glisser, les lignes entre la place d'origine et la cible s'écartent d'un rang.
  const ecart = (k: number) => actif == null || cible == null || k === actif ? 0
    : actif < cible && k > actif && k <= cible ? -HAUTEUR : actif > cible && k >= cible && k < actif ? HAUTEUR : 0;
  const suggestions = produits.filter(p => p.product_type && p.product_type === reference.product_type);

  return <View style={s.zone}>
    <View style={s.entete}>
      <Text style={s.titre} accessibilityRole="header">Ordre d’essai</Text>
      {lignes.length > 1 && <Pressable accessibilityRole="button" accessibilityLabel={`Comparer les ${lignes.length} produits`} onPress={() => router.push({ pathname: '/comparer', params: { ids: ordre.join(','), reference: reference.id } })}
        style={({ pressed }) => [s.comparer, pressed && { opacity: .8 }]}>
        <Feather name="columns" size={15} color={colors.accent} /><Text style={s.comparerTexte}>Comparer</Text>
      </Pressable>}
    </View>
    <Text style={[ui.detail, { marginTop: 0 }]}>Siri et le panier prennent le premier, puis les suivants s’il manque au drive.</Text>
    <View style={s.liste}>
      {lignes.map((p, i) => {
        const enseigne = enseigneExclusive(p);
        return <Animated.View key={p.id} style={[s.ligne, i === 0 && s.ligneReference, i < lignes.length - 1 && s.separee, actif === i ? s.souleve : { transform: [{ translateY: ecart(i) }] }, actif === i && { transform: [{ translateY: decalage }, { scale: 1.02 }] }]}>
          <View style={[s.rang, i === 0 && s.rangReference]}><Text style={[s.rangTexte, i === 0 && { color: colors.accentContrast }]}>{i + 1}</Text></View>
          <Pressable {...(p.id === produit.id ? {} : appuiLongFiche(p))} accessibilityLabel={p.name} style={s.produit}>
            <Photo name={p.name} url={p.image_url} style={s.photo} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={ui.productName} numberOfLines={2}>{p.name}</Text>
              <View style={s.puces}>{(enseigne ? [enseigne] : (['carrefour', 'leclerc'] as const)).map(e => <Text key={e} style={s.puce}>{NOMS[e]}</Text>)}</View>
            </View>
          </Pressable>
          {i > 0 && <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${p.name} du classement`} onPress={() => retirer(i)} hitSlop={4} style={s.action}><Feather name="x" size={16} color={colors.textMuted} /></Pressable>}
          <GestureDetector gesture={poignees.get(p.id)!}><View accessible accessibilityRole="adjustable" accessibilityLabel={`${p.name}, rang ${i + 1} sur ${lignes.length}${i === 0 ? ', référence' : ''}. Fais glisser pour changer l’ordre`}
            accessibilityActions={[{ name: 'increment', label: 'Descendre' }, { name: 'decrement', label: 'Monter' }]}
            onAccessibilityAction={e => deplacer(i, e.nativeEvent.actionName === 'increment' ? i + 1 : i - 1)} style={s.action}>
            <Feather name="menu" size={18} color={actif === i ? colors.accent : colors.traitControle} />
          </View></GestureDetector>
        </Animated.View>;
      })}
    </View>
    {!!erreur && <Text accessibilityLiveRegion="polite" style={ui.error}>{erreur}</Text>}
    <Pressable accessibilityRole="button" onPress={() => setAjout(true)} style={({ pressed }) => [s.ajouter, pressed && { opacity: .85 }]}>
      <Feather name="plus" size={18} color={colors.accent} /><Text style={ui.link}>Ajouter un produit à cette liste</Text>
    </Pressable>
    <Modal visible={ajout} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAjout(false)}>
      <SelecteurIngredient titre={`Alternative à ${reference.name}`} sansProduit={false} suggestions={suggestions} exclure={ordre}
        onFermer={() => setAjout(false)} onChoisir={c => { setAjout(false); if (c.product_id && !ordre.includes(c.product_id)) void enregistrer([...ordre, c.product_id]); }} />
    </Modal>
  </View>;
}

const s = StyleSheet.create({
  zone: { alignSelf: 'stretch', gap: 8, marginTop: 20 },
  titre: { fontSize: 18, fontWeight: '700', color: colors.text },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  comparer: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.accentSoft },
  comparerTexte: { fontSize: 14, fontWeight: '600', color: colors.accent },
  liste: { backgroundColor: colors.surface, borderRadius: 14 },
  ligne: { height: HAUTEUR, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 10, paddingRight: 4, backgroundColor: colors.surface, borderRadius: 14 },
  ligneReference: { backgroundColor: colors.accentSoft },
  separee: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  rang: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  rangReference: { backgroundColor: colors.accent },
  rangTexte: { fontSize: 13, fontWeight: '700', color: colors.accent },
  photo: { width: 44, height: 44, borderRadius: 8 },
  produit: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  souleve: { zIndex: 2, elevation: 4, borderRadius: 14, shadowColor: '#141C10', shadowOpacity: .18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  puces: { flexDirection: 'row', gap: 4 },
  puce: { fontSize: 11, fontWeight: '600', color: '#3A5030', backgroundColor: colors.surface, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  action: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  ajouter: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, borderWidth: 1.5, borderColor: colors.accent },
});
