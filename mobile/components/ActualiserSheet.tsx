import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Feuille } from './Feuille';
import { Action, ui } from './MaisonUI';
import { lookupEan, type FicheProduit } from '../lib/openfoodfacts.ts';
import { differencesOff, patchDepuisOff, type ChampFiche, type Difference } from '../lib/fiche-produit.ts';
import { lireProtections, modifierProduit, type Product } from '../stores/products';
import { colors } from '../lib/theme';

type Etat =
  | { etape: 'chargement' }
  | { etape: 'hors_ligne' }
  | { etape: 'inconnu' }
  | { etape: 'erreur' }
  | { etape: 'pret'; off: FicheProduit; diffs: Difference[] };

/**
 * « Actualiser les infos » depuis Open Food Facts : l'avant et l'après,
 * champ par champ. Rien n'est écrasé sans être montré, et ce que le foyer a
 * corrigé à la main (ou la photo améliorée) est décoché d'office.
 */
export function ActualiserSheet({ produit, visible, onFermer, onApplique }: {
  produit: Product;
  visible: boolean;
  onFermer: () => void;
  /** Appelé après l'enregistrement, avec le nombre de champs changés. */
  onApplique: (n: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const [etat, setEtat] = useState<Etat>({ etape: 'chargement' });
  const [retenus, setRetenus] = useState<Set<ChampFiche>>(new Set());
  const [envoi, setEnvoi] = useState(false), [erreur, setErreur] = useState<string | null>(null);

  const charger = async () => {
    setEtat({ etape: 'chargement' }); setErreur(null);
    if (!produit.ean13) return;
    const [r, protections] = await Promise.all([lookupEan(produit.ean13), lireProtections(produit.id)]);
    if (r.etat === 'hors_ligne') return setEtat({ etape: 'hors_ligne' });
    if (r.etat === 'inconnu') return setEtat({ etape: 'inconnu' });
    if (!protections) return setEtat({ etape: 'erreur' });
    const diffs = differencesOff({ ...produit, ...protections }, r.fiche);
    setRetenus(new Set(diffs.filter((d) => !d.protege).map((d) => d.champ)));
    setEtat({ etape: 'pret', off: r.fiche, diffs });
  };
  useEffect(() => { if (visible) void charger(); }, [visible, produit.id]);

  const basculer = (c: ChampFiche) => setRetenus((s) => { const n = new Set(s); if (n.has(c)) n.delete(c); else n.add(c); return n; });
  const appliquer = async () => {
    if (etat.etape !== 'pret' || envoi) return;
    setEnvoi(true); setErreur(null);
    const r = await modifierProduit(produit.id, patchDepuisOff(etat.off, [...retenus]), []);
    setEnvoi(false);
    if (!r.ok) return setErreur(r.erreur ?? 'Impossible d’enregistrer la fiche pour le moment.');
    onApplique(retenus.size);
  };

  const titre = etat.etape === 'pret'
    ? etat.diffs.length ? `${etat.diffs.length} changement${etat.diffs.length > 1 ? 's' : ''} trouvé${etat.diffs.length > 1 ? 's' : ''}` : 'Tout est à jour'
    : 'Actualiser les infos';

  return <Feuille visible={visible} onFermer={onFermer} nom={titre}>
    <View style={[s.panneau, { paddingBottom: 12 + insets.bottom }]} accessibilityViewIsModal onAccessibilityEscape={onFermer}>
      <View style={s.poignee} />
      <View style={s.entete}>
        <View style={{ flex: 1 }}>
          <Text style={s.titre} accessibilityRole="header">{titre}</Text>
          <Text style={ui.detail}>Open Food Facts · code-barres {produit.ean13}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={onFermer} style={s.fermer}><Feather name="x" size={22} color={colors.text} /></Pressable>
      </View>

      {etat.etape === 'chargement' && <View style={s.attente}><ActivityIndicator color={colors.accent} /><Text style={ui.detail}>On interroge Open Food Facts…</Text></View>}
      {etat.etape === 'hors_ligne' && <><Text style={ui.subtitle}>Open Food Facts ne répond pas. Vérifie ta connexion, puis réessaie.</Text><Action secondary onPress={charger}>Réessayer</Action></>}
      {etat.etape === 'erreur' && <><Text style={ui.subtitle}>Impossible de lire la fiche pour le moment.</Text><Action secondary onPress={charger}>Réessayer</Action></>}
      {etat.etape === 'inconnu' && <Text style={ui.subtitle}>Open Food Facts ne connaît pas ce code-barres. Tu peux corriger la fiche à la main avec « Modifier ».</Text>}
      {etat.etape === 'pret' && !etat.diffs.length && <><Text style={ui.subtitle}>La fiche correspond déjà à Open Food Facts.</Text><Action onPress={onFermer}>OK</Action></>}
      {etat.etape === 'pret' && !!etat.diffs.length && <>
        <ScrollView style={s.liste} contentContainerStyle={s.listeContenu}>
          {etat.diffs.map((d, i) => {
            const coche = retenus.has(d.champ);
            return <Pressable key={d.champ} accessibilityRole="checkbox" accessibilityState={{ checked: coche }}
              accessibilityLabel={`${d.libelle} : ${d.avant ?? 'vide'}, devient ${d.apres}${d.raison ? `. ${d.raison}` : ''}`}
              onPress={() => basculer(d.champ)} style={[s.ligne, i > 0 && s.separe]}>
              <View style={[s.case, coche && s.caseCochee]}>{coche && <Feather name="check" size={14} color={colors.accentContrast} />}</View>
              <View style={{ flex: 1 }}>
                <Text style={s.cle}>{d.libelle}</Text>
                {d.champ === 'image_url'
                  ? <Text style={s.apres}>Nouvelle photo de l’emballage</Text>
                  : <>{!!d.avant && <Text style={s.avant} numberOfLines={2}>{d.avant}</Text>}<Text style={s.apres} numberOfLines={2}>{d.apres}</Text></>}
                {!!d.raison && <Text style={s.raison}>{d.raison}</Text>}
              </View>
            </Pressable>;
          })}
        </ScrollView>
        {!!erreur && <Text accessibilityLiveRegion="polite" style={ui.error}>{erreur}</Text>}
        <Action disabled={!retenus.size || envoi} onPress={appliquer}>
          {envoi ? 'Enregistrement…' : retenus.size ? `Appliquer ${retenus.size} changement${retenus.size > 1 ? 's' : ''}` : 'Rien de coché'}
        </Action>
      </>}
    </View>
  </Feuille>;
}

const s = StyleSheet.create({
  panneau: { backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 8, gap: 12, maxHeight: '88%' },
  poignee: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: colors.border },
  entete: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingLeft: 4 },
  titre: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.4 },
  fermer: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginTop: -6 },
  attente: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  liste: { flexGrow: 0 },
  listeContenu: { backgroundColor: colors.surface, borderRadius: 14 },
  ligne: { flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56 },
  separe: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  case: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.traitControle, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  caseCochee: { backgroundColor: colors.accent, borderColor: colors.accent },
  cle: { fontSize: 13, color: colors.textMuted },
  avant: { fontSize: 14, color: colors.textMuted, textDecorationLine: 'line-through', marginTop: 2 },
  apres: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 2 },
  raison: { alignSelf: 'flex-start', fontSize: 12, color: colors.textMuted, backgroundColor: colors.accentSoft, borderRadius: 6, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 2, marginTop: 6 },
});
