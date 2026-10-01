import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { produitsProbables, retenirPhrase } from '../lib/references';
import { libelleRayon, rayonDepuisLibelle } from '../lib/rayons';
import { enregistrerReglages, type Product } from '../stores/products';
import { Feuille } from './Feuille';
import { SelecteurIngredient } from './SelecteurIngredient';
import { Action, Photo, ui } from './MaisonUI';
import { colors } from '../lib/theme';

/**
 * Un besoin dicté à Siri que l'app n'a pas reconnu (variante RS1) : on
 * choisit le produit, et la phrase est retenue pour la fois suivante. Les
 * produits les plus probables viennent en tête, le premier déjà coché.
 */
export function AssocierSiri({ visible, nom, produits, onFermer, onAssocie, onNote }: {
  visible: boolean;
  /** La phrase dite à Siri, telle qu'elle est arrivée. */
  nom: string;
  produits: Product[];
  onFermer: () => void;
  /** Le produit choisi ; la phrase est déjà enregistrée. */
  onAssocie: (id: string) => void;
  /** Garder la ligne comme une note libre. */
  onNote: () => void;
}) {
  const insets = useSafeAreaInsets();
  const probables = produitsProbables(nom, produits);
  const [trouves, setTrouves] = useState<{ id: string; name: string }[]>([]);
  const [choisi, setChoisi] = useState<string | undefined>(probables[0]?.id);
  const [recherche, setRecherche] = useState(false), [envoi, setEnvoi] = useState(false), [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => { if (visible) { setChoisi(c => c ?? probables[0]?.id); setErreur(null); } }, [visible]);

  const lignes = [...trouves.filter(t => !probables.some(p => p.id === t.id)).map(t => produits.find(p => p.id === t.id) ?? t), ...probables];
  const associer = async () => {
    if (!choisi) return;
    setEnvoi(true); setErreur(null);
    const ecritures = produits.some(p => p.id === choisi)
      ? retenirPhrase(choisi, nom, produits)
      : [{ id: choisi, phrases_siri: [nom.trim().toLowerCase()] }];
    const r = await enregistrerReglages(ecritures);
    setEnvoi(false);
    if (!r.ok) { setErreur(r.erreur ?? null); return; }
    onAssocie(choisi);
  };

  return <Feuille visible={visible} onFermer={onFermer} nom={`« ${nom} », c’est lequel ?`}>
    <View style={[s.panneau, { paddingBottom: 12 + insets.bottom }]} accessibilityViewIsModal onAccessibilityEscape={onFermer}>
      <View style={s.entete}>
        <Text style={s.titre} accessibilityRole="header">« {nom} », c’est lequel ?</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={onFermer} hitSlop={6} style={s.fermer}><Feather name="x" size={22} color={colors.text} /></Pressable>
      </View>
      <Text style={[ui.detail, s.marge]}>Siri s’en souviendra la prochaine fois.</Text>
      {lignes.length > 0 && <Text style={[s.etiquette, s.marge]}>Tes produits</Text>}
      <View accessibilityRole="radiogroup">
        {lignes.map(p => {
          const produit = p as Partial<Product> & { id: string; name: string };
          const detail = [produit.category ? libelleRayon(rayonDepuisLibelle(produit.category)) : null,
            produit.grammage_g ? `${produit.grammage_g} g` : produit.volume_ml ? `${produit.volume_ml} ml` : null].filter(Boolean).join(' · ');
          const coche = choisi === p.id;
          return <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{ checked: coche }} aria-checked={coche} accessibilityLabel={p.name}
            onPress={() => setChoisi(p.id)} style={({ pressed }) => [s.ligne, pressed && { opacity: .85 }]}>
            <Photo name={p.name} url={produit.image_url} style={s.photo} />
            <View style={{ flex: 1 }}><Text style={ui.productName} numberOfLines={2}>{p.name}</Text>{!!detail && <Text style={ui.detail}>{detail}</Text>}</View>
            <View style={[s.radio, coche && s.radioCoche]} />
          </Pressable>;
        })}
      </View>
      <Pressable accessibilityRole="button" onPress={() => setRecherche(true)} style={({ pressed }) => [s.ligne, s.chercher, pressed && { opacity: .85 }]}>
        <Feather name="search" size={18} color={colors.accent} /><Text style={ui.link}>{lignes.length ? 'Chercher un autre produit' : 'Chercher le produit'}</Text>
      </Pressable>
      {!!erreur && <Text accessibilityLiveRegion="polite" style={[ui.error, s.marge]}>{erreur}</Text>}
      <View style={{ gap: 4 }}>
        <Action disabled={!choisi || envoi} onPress={() => { void associer(); }}>{envoi ? 'Enregistrement…' : `Associer « ${nom} »`}</Action>
        <Pressable accessibilityRole="button" onPress={onNote} style={s.secondaire}><Text style={ui.link}>Laisser comme note</Text></Pressable>
      </View>
    </View>
    <Modal visible={recherche} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setRecherche(false)}>
      <SelecteurIngredient titre={`« ${nom} », c’est lequel ?`} sansProduit={false} onFermer={() => setRecherche(false)}
        onChoisir={c => { setRecherche(false); if (c.product_id) { const id = c.product_id; setTrouves(t => [{ id, name: c.name }, ...t.filter(x => x.id !== id)]); setChoisi(id); } }} />
    </Modal>
  </Feuille>;
}

const s = StyleSheet.create({
  panneau: { backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  entete: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
  titre: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.4 },
  fermer: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  marge: { paddingHorizontal: 4, marginTop: 0 },
  etiquette: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 6 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 4 },
  photo: { width: 44, height: 44, borderRadius: 8 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.traitControle },
  radioCoche: { borderWidth: 7, borderColor: colors.accent },
  chercher: { minHeight: 48 },
  secondaire: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
