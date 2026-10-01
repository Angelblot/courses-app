import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { enseigneDeduite, phraseSiri, retenirPhrase, type VenduChez } from '../lib/references';
import { enregistrerReglages, type Product } from '../stores/products';
import { Feuille } from './Feuille';
import { Action, ui } from './MaisonUI';
import { colors, radius } from '../lib/theme';

const DRIVES: { cle: VenduChez; titre: string; detail: string }[] = [
  { cle: 'partout', titre: 'Partout', detail: 'Carrefour et E.Leclerc' },
  { cle: 'carrefour', titre: 'Carrefour seulement', detail: 'Marque Carrefour, Reflets de France, Simpl…' },
  { cle: 'leclerc', titre: 'E.Leclerc seulement', detail: 'Marque Repère, Eco+, Bio Village…' },
];
const titreDrive = (c: VenduChez) => DRIVES.find(d => d.cle === c)!.titre;

/**
 * Deux réglages de la fiche (variante FS2) : les phrases qui appellent le
 * produit avec Siri, et le drive où il est vendu. Une ligne résume, un tap
 * ouvre une feuille du bas.
 */
export function ReglagesProduit({ produit, produits, onChange }: { produit: Product; produits: Product[]; onChange?: () => void }) {
  const [phrases, setPhrases] = useState(produit.phrases_siri ?? []);
  const [vendu, setVendu] = useState<VenduChez | null>(produit.vendu_chez ?? null);
  useEffect(() => { setPhrases(produit.phrases_siri ?? []); setVendu(produit.vendu_chez ?? null); }, [produit.id]);
  const [ouvert, setOuvert] = useState<'siri' | 'drive' | null>(null);
  const deduit: VenduChez = enseigneDeduite(produit) ?? 'partout';
  const auto = produit.product_type && !phrases.some(x => phraseSiri(x) === phraseSiri(produit.product_type!)) ? produit.product_type : null;
  const resume = [auto, ...phrases].filter(Boolean).join(', ');

  return <>
    <View style={s.carte}>
      <Ligne icone="mic" libelle="Siri" valeur={resume || 'Aucune phrase'} onPress={() => setOuvert('siri')} />
      <Ligne icone="shopping-cart" libelle="Vendu chez" valeur={titreDrive(vendu ?? deduit)} onPress={() => setOuvert('drive')} derniere />
    </View>
    <FeuilleSiri visible={ouvert === 'siri'} onFermer={() => setOuvert(null)} produit={produit} produits={produits} auto={auto}
      phrases={phrases} onPhrases={p => { setPhrases(p); onChange?.(); }} />
    <FeuilleDrive visible={ouvert === 'drive'} onFermer={() => setOuvert(null)} produit={produit} deduit={deduit} vendu={vendu}
      onVendu={v => { setVendu(v); onChange?.(); }} />
  </>;
}

function Ligne({ icone, libelle, valeur, onPress, derniere = false }: { icone: 'mic' | 'shopping-cart'; libelle: string; valeur: string; onPress: () => void; derniere?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${libelle} : ${valeur}. Modifier`} onPress={onPress}
    style={({ pressed }) => [s.ligne, !derniere && s.separee, pressed && { opacity: .85 }]}>
    <Feather name={icone} size={18} color={colors.accent} />
    <Text style={s.libelle}>{libelle}</Text>
    <Text style={s.valeur} numberOfLines={1}>{valeur}</Text>
    <Feather name="chevron-right" size={18} color={colors.textMuted} />
  </Pressable>;
}

function Panneau({ titre, onFermer, children }: { titre: string; onFermer: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={[s.panneau, { paddingBottom: 12 + insets.bottom }]} accessibilityViewIsModal onAccessibilityEscape={onFermer}>
    <View style={s.entete}>
      <Text style={s.titre} accessibilityRole="header">{titre}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={onFermer} hitSlop={6} style={s.fermer}><Feather name="x" size={22} color={colors.text} /></Pressable>
    </View>
    {children}
  </View>;
}

function FeuilleSiri({ visible, onFermer, produit, produits, auto, phrases, onPhrases }: {
  visible: boolean; onFermer: () => void; produit: Product; produits: Product[]; auto: string | null;
  phrases: string[]; onPhrases: (p: string[]) => void;
}) {
  const [texte, setTexte] = useState(''), [erreur, setErreur] = useState<string | null>(null), [note, setNote] = useState<string | null>(null);
  useEffect(() => { if (visible) { setTexte(''); setErreur(null); setNote(null); } }, [visible]);
  const ajouter = async () => {
    const phrase = texte.trim();
    if (!phrase) return;
    const ecritures = retenirPhrase(produit.id, phrase, produits.map(p => p.id === produit.id ? { ...p, phrases_siri: phrases } : p));
    const ailleurs = ecritures.filter(e => e.id !== produit.id).map(e => produits.find(p => p.id === e.id)?.name).filter(Boolean);
    const r = await enregistrerReglages(ecritures);
    if (!r.ok) { setErreur(r.erreur ?? null); return; }
    setErreur(null); setTexte('');
    setNote(ailleurs.length ? `« ${phrase.toLowerCase()} » désignait ${ailleurs[0]} ; il désigne maintenant ce produit.` : null);
    const pour = ecritures.find(e => e.id === produit.id);
    if (pour) onPhrases(pour.phrases_siri);
  };
  const retirer = async (phrase: string) => {
    const suite = phrases.filter(x => x !== phrase);
    const r = await enregistrerReglages([{ id: produit.id, phrases_siri: suite }]);
    if (!r.ok) { setErreur(r.erreur ?? null); return; }
    setErreur(null); setNote(null); onPhrases(suite);
  };
  return <Feuille visible={visible} onFermer={onFermer} nom="Quand tu dis à Siri" clavier>
    <Panneau titre="Quand tu dis à Siri" onFermer={onFermer}>
      <Text style={[ui.detail, s.marge]}>Siri ajoute ce produit à ta liste quand tu dis :</Text>
      <View style={s.liste}>
        {auto && <View style={[s.phrase, s.separee]}><Text style={s.phraseTexte}>{auto}</Text><Text style={ui.detail}>reconnu tout seul</Text></View>}
        {phrases.map((x, i) => <View key={x} style={[s.phrase, i < phrases.length - 1 && s.separee]}>
          <Text style={s.phraseTexte}>{x}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Retirer « ${x} »`} onPress={() => { void retirer(x); }} hitSlop={4} style={s.retirer}><Feather name="x" size={16} color={colors.textMuted} /></Pressable>
        </View>)}
        {!auto && !phrases.length && <View style={s.phrase}><Text style={ui.detail}>Aucune phrase pour l’instant.</Text></View>}
      </View>
      <TextInput style={ui.input} value={texte} onChangeText={setTexte} placeholder="Une autre phrase, par exemple « PQ »" accessibilityLabel="Nouvelle phrase pour Siri"
        returnKeyType="done" onSubmitEditing={() => { void ajouter(); }} autoCapitalize="none" />
      {!!note && <Text accessibilityLiveRegion="polite" style={[ui.detail, s.marge]}>{note}</Text>}
      {!!erreur && <Text accessibilityLiveRegion="polite" style={[ui.error, s.marge]}>{erreur}</Text>}
      <Action disabled={!texte.trim()} onPress={() => { void ajouter(); }}>Ajouter cette phrase</Action>
    </Panneau>
  </Feuille>;
}

function FeuilleDrive({ visible, onFermer, produit, deduit, vendu, onVendu }: {
  visible: boolean; onFermer: () => void; produit: Product; deduit: VenduChez; vendu: VenduChez | null; onVendu: (v: VenduChez | null) => void;
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const actuel = vendu ?? deduit;
  const marque = produit.brand || produit.name;
  const origine = vendu && vendu !== deduit ? 'Réglé par toi.' : deduit === 'partout'
    ? `Déduit de la marque : ${marque} se trouve partout.`
    : `Déduit de la marque : ${marque} n’est vendu que chez ${deduit === 'carrefour' ? 'Carrefour' : 'E.Leclerc'}.`;
  const choisir = async (cle: VenduChez) => {
    // Revenir à la valeur déduite efface le réglage : la marque reprend la main.
    const valeur = cle === deduit ? null : cle;
    const r = await enregistrerReglages([{ id: produit.id, vendu_chez: valeur }]);
    if (!r.ok) { setErreur(r.erreur ?? null); return; }
    setErreur(null); onVendu(valeur); onFermer();
  };
  return <Feuille visible={visible} onFermer={onFermer} nom="Vendu chez">
    <Panneau titre="Vendu chez" onFermer={onFermer}>
      <Text style={[ui.detail, s.marge]}>{origine}</Text>
      <View accessibilityRole="radiogroup">
        {DRIVES.map(d => {
          const coche = actuel === d.cle;
          return <Pressable key={d.cle} accessibilityRole="radio" accessibilityState={{ checked: coche }} aria-checked={coche} accessibilityLabel={d.titre}
            onPress={() => { void choisir(d.cle); }} style={({ pressed }) => [s.choix, pressed && { opacity: .85 }]}>
            <View style={{ flex: 1 }}><Text style={ui.productName}>{d.titre}</Text><Text style={ui.detail}>{d.detail}</Text></View>
            <View style={[s.radio, coche && s.radioCoche]} />
          </Pressable>;
        })}
      </View>
      <Text style={[ui.detail, s.marge]}>Un produit réservé à un drive n’est pas cherché sur l’autre : l’extension passe à l’alternative suivante.</Text>
      {!!erreur && <Text accessibilityLiveRegion="polite" style={[ui.error, s.marge]}>{erreur}</Text>}
    </Panneau>
  </Feuille>;
}

const s = StyleSheet.create({
  carte: { alignSelf: 'stretch', backgroundColor: colors.surface, borderRadius: radius.card, paddingHorizontal: 14, marginTop: 20 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 },
  separee: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  libelle: { fontSize: 15, color: colors.text },
  valeur: { flex: 1, fontSize: 14, color: colors.textMuted, textAlign: 'right' },
  panneau: { backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 10, gap: 10 },
  entete: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
  titre: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.4 },
  fermer: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  marge: { paddingHorizontal: 4, marginTop: 0 },
  liste: { backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 14 },
  phrase: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, gap: 8 },
  phraseTexte: { fontSize: 15, fontWeight: '600', color: colors.text, flexShrink: 1 },
  retirer: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  choix: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 4 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.traitControle },
  radioCoche: { borderWidth: 7, borderColor: colors.accent },
});
