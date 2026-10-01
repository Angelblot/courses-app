import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feuille } from './Feuille';
import { ui } from './MaisonUI';
import { pertesSuppression, type Dependances } from '../lib/fiche-produit.ts';
import { compterDependances, supprimerProduit, type Product } from '../stores/products';
import { referenceDe } from '../lib/references.ts';
import { colors } from '../lib/theme';

/**
 * Confirmation de suppression, chiffrée : en base, correspondances drive et
 * historique d'achat partent avec le produit. On dit exactement quoi, avec
 * les vrais nombres, avant de le faire.
 */
export function SupprimerSheet({ produit, produits, visible, onFermer, onSupprime }: {
  produit: Product;
  /** Le catalogue, pour savoir de quelle référence ce produit est l'alternative. */
  produits: Product[];
  visible: boolean;
  onFermer: () => void;
  onSupprime: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [deps, setDeps] = useState<Dependances | null | 'chargement'>('chargement');
  const [envoi, setEnvoi] = useState(false), [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    if (!visible) return;
    setDeps('chargement'); setErreur(null);
    const reference = referenceDe(produit.id, produits);
    void compterDependances(produit.id, reference && reference.id !== produit.id ? reference.name : null).then(setDeps);
  }, [visible, produit.id]);

  const supprimer = async () => {
    if (envoi) return;
    setEnvoi(true); setErreur(null);
    const r = await supprimerProduit(produit.id);
    setEnvoi(false);
    if (!r.ok) return setErreur(r.erreur ?? 'Impossible de supprimer ce produit pour le moment.');
    onSupprime();
  };

  const bilan = deps && deps !== 'chargement' ? pertesSuppression(deps) : null;
  const titre = `Supprimer « ${produit.name} » ?`;

  return <Feuille visible={visible} onFermer={onFermer} nom={titre}>
    <View style={[s.panneau, { paddingBottom: 12 + insets.bottom }]} accessibilityViewIsModal onAccessibilityEscape={onFermer}>
      <View style={s.poignee} />
      <Text style={s.titre} accessibilityRole="header" numberOfLines={3}>{titre}</Text>
      {deps === 'chargement' && <View style={s.attente}><ActivityIndicator color={colors.accent} /></View>}
      {deps === null && <Text style={ui.subtitle}>Ses correspondances drive et son historique d’achat partiront avec lui.</Text>}
      {bilan && (bilan.pertes.length
        ? <View style={s.alerte}>
            <Text style={s.alerteTexte}>Ce qui part avec lui :</Text>
            {bilan.pertes.map((p) => <Text key={p} style={s.alerteTexte}>{'•'}  {p}</Text>)}
            {!!bilan.garde && <Text style={[ui.detail, { marginTop: 6 }]}>{bilan.garde}</Text>}
          </View>
        : <Text style={ui.subtitle}>{bilan.garde ?? 'Ce produit n’est utilisé nulle part ailleurs.'}</Text>)}
      {!!erreur && <Text accessibilityLiveRegion="polite" style={ui.error}>{erreur}</Text>}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: envoi }} disabled={envoi} onPress={supprimer}
        style={({ pressed }) => [s.supprimer, pressed && { opacity: .85 }]}>
        {envoi ? <ActivityIndicator color={colors.accentContrast} /> : <Text style={s.supprimerTexte}>Supprimer</Text>}
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onFermer} style={s.garder}><Text style={s.garderTexte}>Garder le produit</Text></Pressable>
    </View>
  </Feuille>;
}

const s = StyleSheet.create({
  panneau: { backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  poignee: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: colors.border },
  titre: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.4, paddingHorizontal: 4 },
  attente: { paddingVertical: 20 },
  alerte: { backgroundColor: colors.dangerSoft, borderRadius: 14, padding: 14, gap: 3 },
  alerteTexte: { fontSize: 15, lineHeight: 21, color: colors.text },
  supprimer: { minHeight: 48, borderRadius: 12, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  supprimerTexte: { fontSize: 15, fontWeight: '600', color: colors.accentContrast },
  garder: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  garderTexte: { fontSize: 15, fontWeight: '600', color: colors.accent },
});
