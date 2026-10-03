import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useWizard } from '../contexts/WizardContext';
import { rythme, type Ligne, type Piste } from '../lib/comparateur';
import { annulerEssai, essayer, usePistes } from '../stores/pistes';
import { Action, Head, Photo, ui, useAnnulation, EspaceBas } from '../components/MaisonUI';
import { PastilleNutri } from '../components/PastilleNutri';
import { appuiLongFiche, type CibleFiche } from '../components/FicheAppuiLong';
import { colors } from '../lib/theme';

const VERT = '#2F6B2F', BLEU = '#2E5683';
const DRIVES = { carrefour: 'Carrefour', leclerc: 'E.Leclerc' } as const;
const euros = (v: number) => `${v.toFixed(2).replace('.', ',')} €`;
const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

/** Ce que la piste rapporte, en grand : l'économie sur un an, ou la meilleure note. */
function gain(p: Piste): { titre: string; valeur: string; suite: string; teinte: string } {
  if (p.type === 'nutrition') return {
    titre: p.ecart != null && p.ecart < 0 ? 'Mieux noté, moins cher' : 'Mieux noté, même prix',
    valeur: (p.alternative.nutriscore ?? '').toUpperCase(), suite: `au lieu de ${(p.reference.nutriscore ?? '').toUpperCase()}`, teinte: BLEU };
  const titre = p.type === 'format' ? 'Plus grand, moins cher' : 'Moins cher au kilo';
  if (p.economieAn && p.economieAn >= 1) return { titre, valeur: `${p.economieAn} €`, suite: 'par an', teinte: VERT };
  return { titre, valeur: `−${Math.round(-(p.ecart ?? 0) * 100)} %`, suite: p.reference.unite_prix === 'l' ? 'au litre' : 'au kilo', teinte: VERT };
}

/**
 * Pistes tirées des achats (variante PP1) : une carte chiffrée par piste, le
 * gain en grand, « Aujourd'hui » et « À la place » alignés, la raison en une
 * phrase, et une seule action principale.
 */
export default function Pistes() {
  const w = useWizard(), { pistes, produits, chargement, erreur, ecarter, retablir, recharger } = usePistes(w.compte);
  const annulation = useAnnulation();
  const retour = () => { if (router.canGoBack()) router.back(); else router.dismissTo('/compte'); };
  const vuLe = pistes.reduce<string | null>((m, p) => (!m || p.alternative.vu_le > m ? p.alternative.vu_le : m), null);
  return <SafeAreaView edges={['top']} style={ui.screen}>
    <ScrollView contentContainerStyle={[ui.content, { paddingBottom: 40 }]}>
      <Head title="Pistes" back onBack={retour} avatar={false} />
      {chargement && <ActivityIndicator />}
      {!!erreur && <><Text style={ui.error}>{erreur}</Text><Action secondary onPress={recharger}>Réessayer</Action></>}
      {!chargement && !erreur && (pistes.length
        ? <Text style={ui.subtitle}>{pistes.length} piste{pistes.length > 1 ? 's' : ''} d’après tes achats et les prix vus{vuLe ? ` le ${date(vuLe).replace(/\.$/, '')}` : ''}.</Text>
        : <View style={ui.notice}><Text style={ui.productName}>Pas encore de piste.</Text><Text style={ui.subtitle}>Les pistes arrivent quand un produit a été commandé deux fois avec l’extension : elle relève alors les prix des alternatives sur tes drives.</Text></View>)}
      {pistes.map(p => <Carte key={`${p.produit.id}:${p.alternative.cle}`} piste={p} onEcarter={() => { ecarter(p); annulation.proposer('Piste écartée', () => retablir(p)); }}
        onEssayer={async () => {
          const r = await essayer(p, produits);
          if (!r.ok) return r.erreur ?? 'Impossible d’enregistrer. Réessaie.';
          recharger();
          annulation.proposer(`${p.alternative.libelle} sera essayé à la prochaine commande`, () => { if (r.avant) void annulerEssai(r.avant).then(recharger); });
          return null;
        }} />)}
    <EspaceBas /></ScrollView>
    <View style={{ marginBottom: 8 }}>{annulation.toast}</View>
  </SafeAreaView>;
}

function Carte({ piste, onEcarter, onEssayer }: { piste: Piste; onEcarter: () => void; onEssayer: () => Promise<string | null> }) {
  const [envoi, setEnvoi] = useState(false), [erreur, setErreur] = useState<string | null>(null);
  const g = gain(piste);
  return <View style={s.carte} accessibilityLabel={`${g.titre}, ${g.valeur} ${g.suite}`}>
    <View style={s.tete}><Text style={[s.sorte, { color: g.teinte }]}>{g.titre.toUpperCase()}</Text><Text style={[s.valeur, { color: g.teinte }]}>{g.valeur} <Text style={s.suite}>{g.suite}</Text></Text></View>
    <Rang etiquette="Aujourd’hui" ligne={piste.reference} cible={{ id: piste.produit.id }} />
    <Rang etiquette="À la place" ligne={piste.alternative} cible={piste.alternative.product_id ? { id: piste.alternative.product_id } : null} apres moinsCher={piste.ecart != null && piste.ecart < 0} />
    <Text style={s.pourquoi}>Tu en prends {rythme(piste.parAn)}.{piste.type === 'nutrition' ? '' : piste.alternative.nutriscore && piste.alternative.nutriscore === piste.reference.nutriscore ? ' Même Nutri-Score.' : ''}</Text>
    {!!erreur && <Text accessibilityLiveRegion="polite" style={[ui.error, { paddingHorizontal: 14, marginTop: 0 }]}>{erreur}</Text>}
    <View style={s.actions}>
      <Pressable accessibilityRole="button" disabled={envoi} onPress={async () => { setEnvoi(true); setErreur(null); const e = await onEssayer(); setEnvoi(false); if (e) setErreur(e); }}
        style={({ pressed }) => [s.essayer, pressed && { opacity: .85 }]}>
        {envoi ? <ActivityIndicator color={colors.accentContrast} /> : <Text style={s.essayerTexte}>Essayer à la prochaine commande</Text>}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Pas pour moi : ${piste.alternative.libelle}`} onPress={onEcarter} style={s.ecarter}><Text style={s.ecarterTexte}>Pas pour moi</Text></Pressable>
    </View>
  </View>;
}

function Rang({ etiquette, ligne, cible, apres = false, moinsCher = false }: { etiquette: string; ligne: Ligne; cible: CibleFiche; apres?: boolean; moinsCher?: boolean }) {
  const parUnite = ligne.unite_prix === 'l' ? '/L' : ligne.unite_prix === 'kg' ? '/kg' : '/pièce';
  return <Pressable {...appuiLongFiche(cible)} style={[s.rang, apres && s.rangApres]}>
    <Photo name={ligne.libelle} url={ligne.image_url} style={s.photo} />
    <View style={{ flex: 1, gap: 3 }}>
      <Text style={[s.etiquette, apres && { color: VERT }]}>{etiquette.toUpperCase()}</Text>
      <Text style={s.nom} numberOfLines={2}>{ligne.libelle}</Text>
      <View style={s.puces}><Text style={s.drive}>{DRIVES[ligne.drive]}</Text><PastilleNutri note={ligne.nutriscore} /></View>
    </View>
    <View style={s.prix}>
      {ligne.prix != null && <Text style={s.prixTexte}>{euros(ligne.prix)}</Text>}
      {ligne.prix_unitaire != null && <Text style={[s.unitaire, moinsCher && { color: VERT, fontWeight: '700' }]}>{euros(ligne.prix_unitaire)}{parUnite}</Text>}
    </View>
  </Pressable>;
}

const s = StyleSheet.create({
  carte: { backgroundColor: colors.surface, borderRadius: 18, overflow: 'hidden' },
  tete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, gap: 8 },
  sorte: { flex: 1, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  valeur: { fontSize: 26, fontWeight: '800', letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  suite: { fontSize: 13, fontWeight: '600', color: colors.textMuted, letterSpacing: 0 },
  rang: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rangApres: { backgroundColor: '#F3F7EE' },
  etiquette: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3, color: colors.textMuted },
  photo: { width: 56, height: 56, borderRadius: 10 },
  nom: { fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 18 },
  puces: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  drive: { fontSize: 11, fontWeight: '700', color: '#4E564A', backgroundColor: colors.bg, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1, overflow: 'hidden' },
  prix: { alignItems: 'flex-end', gap: 2 },
  prixTexte: { fontSize: 15, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  unitaire: { fontSize: 12, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  pourquoi: { fontSize: 13, color: colors.textMuted, lineHeight: 18, paddingHorizontal: 14, paddingTop: 10 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, paddingTop: 10 },
  essayer: { flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  essayerTexte: { fontSize: 15, fontWeight: '600', color: colors.accentContrast, textAlign: 'center' },
  ecarter: { minHeight: 48, paddingHorizontal: 10, justifyContent: 'center' },
  ecarterTexte: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
});
