import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { phaseReprise } from '../lib/reprise-photo';
import { demanderReprise, garderReprise, refuserReprise, remettreOriginale, useReprise } from '../stores/reprise-photo';
import { Action, ui } from './MaisonUI';
import { colors } from '../lib/theme';

/**
 * « Améliorer la photo » sous la photo d'un produit (variante AV1) : le
 * bouton, l'attente sans blocage, puis l'avant et l'après côte à côte. La
 * photo actuelle ne change que sur « Garder la nouvelle ».
 */
export function ReprisePhoto({ produitId, nom, onChange }: { produitId: string; nom: string; onChange?: () => void }) {
  const { etat, recharger } = useReprise(produitId);
  const [maintenant, setMaintenant] = useState(Date.now());
  const [occupe, setOccupe] = useState(false), [erreur, setErreur] = useState<string | null>(null), [agrandie, setAgrandie] = useState<string | null>(null);
  useEffect(() => { setMaintenant(Date.now()); }, [etat]);
  const phase = phaseReprise(etat, maintenant);

  const agir = async (action: () => Promise<boolean>, message: string) => {
    if (occupe) return;
    setOccupe(true); setErreur(null);
    const ok = await action();
    setOccupe(false);
    if (!ok) { setErreur(message); return; }
    await recharger(); onChange?.();
  };
  const lancer = async () => {
    if (occupe) return;
    setOccupe(true); setErreur(null);
    const r = await demanderReprise(produitId);
    setOccupe(false);
    if (!r.ok) setErreur(r.erreur ?? null);
    await recharger();
  };

  return <View style={s.zone}>
    {phase === 'proposer' && <Pressable accessibilityRole="button" accessibilityLabel="Améliorer la photo" accessibilityHint="Fond blanc, produit détouré ; tu choisis ensuite de la garder" disabled={occupe} onPress={lancer} style={({ pressed }) => [s.ameliorer, pressed && { opacity: .8 }]}>
      <Feather name="edit-2" size={16} color={colors.accent} /><Text style={ui.link}>Améliorer la photo</Text>
    </Pressable>}

    {phase === 'en_cours' && <View style={s.attente} accessible accessibilityLiveRegion="polite" accessibilityLabel="Photo en cours de reprise. Environ 30 secondes. Tu peux fermer la fiche.">
      <ActivityIndicator color={colors.accent} />
      <View style={{ flex: 1 }}><Text style={ui.productName}>Photo en cours de reprise</Text><Text style={[ui.detail, { marginTop: 2 }]}>Environ 30 secondes. Tu peux fermer la fiche : la nouvelle photo t’attendra ici.</Text></View>
    </View>}

    {phase === 'echec' && <View style={s.attente}>
      <Feather name="alert-circle" size={18} color={colors.danger} />
      <View style={{ flex: 1, gap: 6 }}><Text style={ui.productName}>La photo n’a pas pu être reprise.</Text>
        <Pressable accessibilityRole="button" onPress={lancer} disabled={occupe} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={ui.link}>Réessayer</Text></Pressable></View>
    </View>}

    {phase === 'choisir' && etat && <View style={s.choix}>
      <Text accessibilityRole="header" style={s.titre}>Garder la nouvelle photo ?</Text>
      <View style={s.duo}>
        {[{ url: etat.image_url, libelle: 'Avant', nouvelle: false }, { url: etat.image_reprise, libelle: 'Après', nouvelle: true }].map(c => <Pressable key={c.libelle} accessibilityRole="button" accessibilityLabel={`${c.libelle} : ${nom}. Voir en grand`} onPress={() => setAgrandie(c.url)} style={[s.cadre, c.nouvelle && s.cadreNouveau]}>
          <View style={s.image}>{!!c.url && <Image source={{ uri: c.url }} style={s.photo} resizeMode="contain" />}</View>
          <Text style={s.libelle}>{c.libelle}</Text>
        </Pressable>)}
      </View>
      <Text style={[ui.detail, { marginTop: 0 }]}>Touche une photo pour la voir en grand.</Text>
      <Action disabled={occupe} onPress={() => agir(() => garderReprise(produitId, etat), 'La nouvelle photo n’a pas pu être enregistrée.')}>Garder la nouvelle</Action>
      <Pressable accessibilityRole="button" disabled={occupe} onPress={() => agir(() => refuserReprise(produitId), 'Impossible d’annuler pour le moment.')} style={s.lien}><Text style={ui.link}>Revenir à l’originale</Text></Pressable>
    </View>}

    {phase !== 'choisir' && phase !== 'en_cours' && !!etat?.image_originale && <Pressable accessibilityRole="button" disabled={occupe} onPress={() => agir(() => remettreOriginale(produitId, etat), 'Impossible de remettre la photo d’origine.')} style={s.lien}>
      <Text style={[ui.link, { color: colors.textMuted }]}>Remettre la photo d’origine</Text>
    </Pressable>}

    {!!erreur && <Text accessibilityLiveRegion="polite" style={[ui.error, { textAlign: 'center' }]}>{erreur}</Text>}

    <Modal visible={!!agrandie} animationType="fade" onRequestClose={() => setAgrandie(null)}>
      <SafeAreaView style={s.plein}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={() => setAgrandie(null)} style={s.fermer}><Feather name="x" size={24} color={colors.text} /></Pressable>
        {!!agrandie && <Image source={{ uri: agrandie }} style={{ flex: 1 }} resizeMode="contain" accessibilityLabel={nom} />}
      </SafeAreaView>
    </Modal>
  </View>;
}

const s = StyleSheet.create({
  zone: { alignSelf: 'stretch', alignItems: 'center', gap: 10, marginBottom: 12 },
  ameliorer: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1.5, borderColor: colors.accent },
  attente: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 14, padding: 14 },
  choix: { alignSelf: 'stretch', gap: 10 },
  titre: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  duo: { flexDirection: 'row', gap: 10 },
  cadre: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.traitControle, overflow: 'hidden' },
  cadreNouveau: { borderWidth: 3, borderColor: colors.accent },
  image: { height: 150, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', height: '100%' },
  libelle: { fontSize: 13, fontWeight: '600', color: colors.text, textAlign: 'center', paddingVertical: 8 },
  lien: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  plein: { flex: 1, backgroundColor: 'white' },
  fermer: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end', margin: 8 },
});
