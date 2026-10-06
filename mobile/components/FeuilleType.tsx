import { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feuille } from './Feuille';
import { requeteAffinee, type Suggestion } from '../lib/affinage.ts';
import { colors } from '../lib/theme';

/**
 * « Quel type ? » : un article noté largement se précise en un tap. Le chiffre
 * à côté d'un type dit combien de produits sont déjà trouvés ; toucher filtre
 * aussitôt, et la recherche approfondie complète si c'est peu. La liste garde
 * le nom de l'article.
 */
export function FeuilleType({ visible, onFermer, nom, types, marques, filtre, onFiltre }: {
  visible: boolean; onFermer: () => void; nom: string;
  types: Suggestion[]; marques: Suggestion[]; filtre: string | null; onFiltre: (f: string | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const [libre, setLibre] = useState('');
  useEffect(() => { if (!visible) setLibre(''); }, [visible]);
  const prefixe = requeteAffinee(nom, '').trim();
  const choisir = (f: string | null) => { Keyboard.dismiss(); onFiltre(f); onFermer(); };
  const puce = ({ nom: t, n }: Suggestion) => {
    const actif = filtre === t;
    return <Pressable key={t} accessibilityRole="button" accessibilityState={{ selected: actif }} accessibilityLabel={`${t}, ${n ? `${n} déjà trouvé${n > 1 ? 's' : ''}` : 'à chercher'}`}
      onPress={() => choisir(actif ? null : t)} style={({ pressed }) => [s.puce, actif && s.puceActive, pressed && { opacity: .8 }]}>
      <Text style={[s.puceTexte, actif && { color: colors.accentContrast }]}>{t}</Text>
      {n > 0 && <Text style={[s.puceNombre, actif && { color: colors.accentSoft }]}>{n}</Text>}
    </Pressable>;
  };
  return <Feuille visible={visible} onFermer={() => { Keyboard.dismiss(); onFermer(); }} nom={`Quel type de ${nom} ?`} clavier fondCliquable>
    {/* Toucher la feuille hors du champ ferme le clavier : iOS n'a pas de touche pour le faire. */}
    <Pressable accessible={false} onPress={Keyboard.dismiss} style={[s.feuille, { paddingBottom: 16 + insets.bottom }]}>
      <View style={s.poignee} />
      <View style={{ gap: 2 }}>
        <Text style={s.titre} accessibilityRole="header">Quel type de « {nom} » ?</Text>
        <Text style={s.aide}>Le chiffre : produits déjà trouvés. Ta liste garde « {nom} ».</Text>
      </View>
      {types.length > 0 && <View style={s.groupe}><Text style={s.section}>Type</Text><View style={s.puces}>{types.map(puce)}</View></View>}
      {marques.length > 0 && <View style={s.groupe}><Text style={s.section}>Marque</Text><View style={s.puces}>{marques.map(puce)}</View></View>}
      {/* Maquette validée : une section « Autre », un champ vide avec un exemple, et ce qui sera cherché, dit en clair. */}
      <View style={s.groupe}>
        <Text style={s.section}>Autre</Text>
        <View style={s.ligneLibre}>
          <TextInput value={libre} onChangeText={setLibre} placeholder="Ton mot…" placeholderTextColor={colors.textMuted} style={s.champ}
            accessibilityLabel={`Autre type de ${nom}`} accessibilityHint={`On cherchera « ${prefixe} » suivi de ton mot`} returnKeyType="search" onSubmitEditing={() => { if (libre.trim()) choisir(libre.trim()); }} autoCorrect={false} />
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !libre.trim() }} disabled={!libre.trim()} onPress={() => choisir(libre.trim())} style={({ pressed }) => [s.chercher, !libre.trim() && s.chercherInactif, pressed && { opacity: .85 }]}>
            <Text style={[s.chercherTexte, !libre.trim() && { color: colors.offText }]}>Chercher</Text>
          </Pressable>
        </View>
        <Text style={[s.apercu, !!libre.trim() && s.apercuActif]}>{libre.trim() ? `On cherchera « ${prefixe} ${libre.trim()} » sur les deux drives.` : `Écris ce qui manque : on cherchera « ${prefixe}… ».`}</Text>
      </View>
      {!!filtre && <Pressable accessibilityRole="button" onPress={() => choisir(null)} style={s.tout}><Text style={s.toutTexte}>Tous les produits « {nom} »</Text></Pressable>}
    </Pressable>
  </Feuille>;
}

const s = StyleSheet.create({
  feuille: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 10, gap: 16 },
  poignee: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: colors.border },
  titre: { fontSize: 18, fontWeight: '700', color: colors.text },
  aide: { fontSize: 13, color: colors.textMuted },
  groupe: { gap: 8 },
  section: { fontSize: 12, fontWeight: '700', letterSpacing: .5, color: colors.textMuted, textTransform: 'uppercase' },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  puce: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 6 },
  puceActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  puceTexte: { fontSize: 15, fontWeight: '600', color: colors.text },
  puceNombre: { fontSize: 13, fontWeight: '600', color: colors.textMuted, fontVariant: ['tabular-nums'] },
  ligneLibre: { flexDirection: 'row', gap: 8 },
  champ: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: colors.traitControle, borderRadius: 12, paddingHorizontal: 12, fontSize: 16, color: colors.text },
  apercu: { fontSize: 13, color: colors.textMuted },
  apercuActif: { color: colors.accent, fontWeight: '600' },
  chercher: { minHeight: 48, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  chercherInactif: { backgroundColor: colors.off },
  chercherTexte: { fontSize: 15, fontWeight: '600', color: colors.accentContrast },
  tout: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  toutTexte: { fontSize: 15, fontWeight: '600', color: colors.accent },
});
