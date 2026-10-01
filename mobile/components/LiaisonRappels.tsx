import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useWizard } from '../contexts/WizardContext';
import { nativeRappels, type ListeRappels } from '../lib/native-inbox';
import { enregistrerLiaison, lireLiaison, type Liaison } from '../stores/rappels';
import { Feuille } from './Feuille';
import { Action, ui } from './MaisonUI';
import { colors } from '../lib/theme';

/** « aujourd'hui », « hier », sinon la date courte. */
function quand(iso: string) {
  const d = new Date(iso), jour = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const ecart = Math.round((jour(new Date()) - jour(d)) / 86400000);
  return ecart <= 0 ? 'aujourd’hui' : ecart === 1 ? 'hier' : `le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
}
const pourCourses = (titre: string) => /course|achat|[ée]picerie|march[ée]|supermarch/i.test(titre);

/**
 * Carte « Depuis Rappels » (variante RL1) : relier la liste où Siri range
 * « ajoute … à ma liste de courses ». L'app en reprend les articles à chaque
 * ouverture, puis les coche dans Rappels.
 */
export function LiaisonRappels() {
  const w = useWizard(), compte = w.compte;
  const [liaison, setLiaison] = useState<Liaison | null>(null);
  const [listes, setListes] = useState<ListeRappels[] | null>(null);
  const [ouvert, setOuvert] = useState(false), [charge, setCharge] = useState(false);
  const [refus, setRefus] = useState(false), [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => { if (compte) void lireLiaison(compte).then(setLiaison); }, [compte]);

  const ouvrir = async () => {
    if (!nativeRappels) return;
    setErreur(null); setCharge(true);
    try {
      let statut = await nativeRappels.statut();
      if (statut === 'indetermine') statut = await nativeRappels.demander() ? 'autorise' : 'refuse';
      if (statut !== 'autorise') { setRefus(true); return; }
      setRefus(false);
      setListes(await nativeRappels.listes());
      setOuvert(true);
    } catch { setErreur('Impossible de lire tes listes Rappels. Réessaie.'); }
    finally { setCharge(false); }
  };
  const choisir = async (l: ListeRappels | null) => {
    if (!compte) return;
    const suivante = l ? { id: l.id, titre: l.titre, couleur: l.couleur } : null;
    try { await enregistrerLiaison(compte, suivante); } catch { setErreur('Impossible d’enregistrer ce choix. Réessaie.'); return; }
    setLiaison(suivante); setOuvert(false);
    if (suivante) w.actualiserAjouts();
  };
  const choisie = liaison?.id ?? listes?.find(l => pourCourses(l.titre))?.id;

  return <View style={s.carte}>
    <View style={s.tete}><View style={[s.pastille, { backgroundColor: '#C86A26' }]}><Feather name="check-circle" size={17} color="#FFFFFF" /></View><Text style={ui.productName}>Depuis Rappels</Text></View>
    <Text style={s.texte}>{nativeRappels
      ? 'Si tu dis « ajoute … à ma liste de courses », Siri le note dans Rappels. Relie cette liste : l’app reprend ses articles à chaque ouverture et les coche dans Rappels.'
      : 'La reprise d’une liste Rappels est disponible dans la version iPhone.'}</Text>
    {!!nativeRappels && (liaison
      ? <Pressable accessibilityRole="button" accessibilityLabel={`Liste reliée : ${liaison.titre}. Changer`} onPress={() => { void ouvrir(); }} style={({ pressed }) => [s.relie, pressed && { opacity: .85 }]}>
          <View style={[s.point, { backgroundColor: liaison.couleur ?? colors.textMuted }]} />
          <View style={{ flex: 1 }}><Text style={ui.productName}>{liaison.titre}</Text>
            <Text style={ui.detail}>{liaison.derniere ? `Relié · ${liaison.derniere.n} article${liaison.derniere.n > 1 ? 's' : ''} repris ${quand(liaison.derniere.le)}` : 'Relié · rien repris pour l’instant'}</Text></View>
          {charge ? <ActivityIndicator color={colors.accent} /> : <Text style={ui.link}>Changer</Text>}
        </Pressable>
      : <Action secondary disabled={charge} onPress={() => { void ouvrir(); }}>{charge ? 'Ouverture…' : 'Relier une liste Rappels'}</Action>)}
    {refus && <View style={{ gap: 6 }}>
      <Text style={ui.error}>L’accès aux Rappels est refusé. Autorise-le dans Réglages, Courses, Rappels.</Text>
      <Pressable accessibilityRole="button" onPress={() => { void Linking.openSettings(); }} style={s.lien}><Text style={ui.link}>Ouvrir les Réglages</Text></Pressable>
    </View>}
    {!!erreur && <Text accessibilityLiveRegion="polite" style={ui.error}>{erreur}</Text>}
    <ChoixListe visible={ouvert} listes={listes ?? []} choisie={choisie} relie={!!liaison} onFermer={() => setOuvert(false)} onChoisir={l => { void choisir(l); }} />
  </View>;
}

function ChoixListe({ visible, listes, choisie, relie, onFermer, onChoisir }: {
  visible: boolean; listes: ListeRappels[]; choisie?: string; relie: boolean; onFermer: () => void; onChoisir: (l: ListeRappels | null) => void;
}) {
  const insets = useSafeAreaInsets();
  return <Feuille visible={visible} onFermer={onFermer} nom="Quelle liste Rappels ?">
    <View style={[s.panneau, { paddingBottom: 12 + insets.bottom }]} accessibilityViewIsModal onAccessibilityEscape={onFermer}>
      <View style={s.entete}>
        <Text style={s.titre} accessibilityRole="header">Quelle liste Rappels ?</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={onFermer} hitSlop={6} style={s.fermer}><Feather name="x" size={22} color={colors.text} /></Pressable>
      </View>
      <Text style={[ui.detail, s.marge]}>Celle où Siri range tes courses.</Text>
      <View accessibilityRole="radiogroup">
        {listes.map(l => {
          const coche = l.id === choisie;
          return <Pressable key={l.id} accessibilityRole="radio" accessibilityState={{ checked: coche }} aria-checked={coche} accessibilityLabel={`${l.titre}, ${l.nombre} article${l.nombre > 1 ? 's' : ''}`}
            onPress={() => onChoisir(l)} style={({ pressed }) => [s.choix, pressed && { opacity: .85 }]}>
            <View style={[s.point, { backgroundColor: l.couleur }]} />
            <View style={{ flex: 1 }}><Text style={ui.productName}>{l.titre}</Text><Text style={ui.detail}>{l.nombre ? `${l.nombre} article${l.nombre > 1 ? 's' : ''}` : 'Vide'}</Text></View>
            <View style={[s.radio, coche && s.radioCoche]} />
          </Pressable>;
        })}
        {!listes.length && <Text style={[ui.detail, s.marge]}>Aucune liste dans Rappels pour l’instant.</Text>}
        {relie && <Pressable accessibilityRole="radio" accessibilityState={{ checked: false }} aria-checked={false} accessibilityLabel="Aucune, ne plus reprendre de Rappels"
          onPress={() => onChoisir(null)} style={({ pressed }) => [s.choix, pressed && { opacity: .85 }]}>
          <View style={[s.point, { backgroundColor: colors.traitControle }]} />
          <View style={{ flex: 1 }}><Text style={ui.productName}>Aucune</Text><Text style={ui.detail}>Ne plus reprendre de Rappels</Text></View>
          <View style={s.radio} />
        </Pressable>}
      </View>
    </View>
  </Feuille>;
}

const s = StyleSheet.create({
  carte: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, gap: 8 },
  tete: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pastille: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  texte: { fontSize: 15, lineHeight: 22, color: colors.text },
  relie: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 6 },
  point: { width: 12, height: 12, borderRadius: 6 },
  lien: { minHeight: 44, justifyContent: 'center' },
  panneau: { backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  entete: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
  titre: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.4 },
  fermer: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  marge: { paddingHorizontal: 4, marginTop: 0 },
  choix: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 4 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.traitControle },
  radioCoche: { borderWidth: 7, borderColor: colors.accent },
});
