import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useFoyer, renommerFoyer, reglerPersonnes } from '../../stores/foyer';
import { useProducts } from '../../stores/products';
import { useWizard } from '../../contexts/WizardContext';
import { usePistes } from '../../stores/pistes';
import { usePrenom } from '../../stores/profil';
import { Groupe, Ligne } from '../../components/GroupeReglages';
import { ui } from '../../components/MaisonUI';
import { references } from '../../lib/references';
import { colors } from '../../lib/theme';

const NOMS_DRIVES: Record<string, string> = { carrefour: 'Carrefour', leclerc: 'E.Leclerc' };

/**
 * Réglages, rangés en groupes façon iPhone (variante R1) : le foyer, les
 * courses, le compte. Ce qui demande plus d'une ligne (membres et
 * invitations, mode d'emploi de Siri et du widget) a son propre écran.
 */
export default function Compte() {
  const { foyer, membres, chargement, erreur, recharger } = useFoyer();
  const { produits } = useProducts(), w = useWizard();
  const nbPistes = usePistes(w.compte).pistes.length;
  const [nom, setNom] = useState<string | null>(null);
  const [erreurReglage, setErreurReglage] = useState<string | null>(null);
  const [adresse, setAdresse] = useState<string | null>(null);
  const profil = usePrenom(), [prenom, setPrenom] = useState<string | null>(null);
  useFocusEffect(useCallback(() => { recharger(); }, [recharger]));
  useEffect(() => { void supabase.auth.getUser().then(({ data }) => setAdresse(data.user?.email ?? null)); }, []);

  const enregistrerNom = async () => {
    if (!foyer || nom === null || nom.trim() === foyer.name) { setNom(null); return; }
    const r = await renommerFoyer(foyer.id, nom);
    setErreurReglage(r.ok ? null : r.erreur ?? null);
    if (r.ok) { setNom(null); recharger(); }
  };
  const enregistrerPrenom = async () => {
    if (prenom === null || prenom.trim() === (profil.prenom ?? '')) { setPrenom(null); return; }
    const r = await profil.enregistrer(prenom);
    setErreurReglage(r.ok ? null : r.erreur ?? null);
    if (r.ok) setPrenom(null);
  };
  // Enregistré à chaque pas : les repas choisis ensuite partent pour ce nombre.
  const changerPersonnes = async (n: number) => {
    if (!foyer || n < 1 || n > 20) return;
    const r = await reglerPersonnes(foyer.id, n);
    setErreurReglage(r.ok ? null : r.erreur ?? null);
    if (r.ok) recharger();
  };
  const personnes = foyer?.personnes ?? 2;
  const drives = w.drives.map(d => NOMS_DRIVES[d] ?? d).join(', ');

  if (chargement && !foyer) return <SafeAreaView style={s.centre}><ActivityIndicator color={colors.accent} /></SafeAreaView>;

  return <SafeAreaView edges={['top']} style={ui.screen}>
    <ScrollView contentContainerStyle={s.corps} keyboardShouldPersistTaps="handled">
      <Text style={s.titre} accessibilityRole="header">Réglages</Text>

      {erreur && <View style={s.alerte}><Text style={ui.error}>{erreur}</Text><Pressable accessibilityRole="button" onPress={recharger} style={s.lien}><Text style={ui.link}>Réessayer</Text></Pressable></View>}

      {foyer && <Groupe titre="Foyer">
        <Ligne icone="home" teinte={colors.accent} libelle="Nom">
          <TextInput value={nom ?? foyer.name} onChangeText={setNom} onBlur={enregistrerNom} onSubmitEditing={enregistrerNom} returnKeyType="done"
            accessibilityLabel="Nom du foyer" style={s.champ} placeholder="Nom du foyer" placeholderTextColor={colors.textMuted} />
        </Ligne>
        <Ligne icone="users" teinte="#9A5A1E" libelle="À table">
          <View style={s.compteur}>
            <Pressable accessibilityRole="button" accessibilityLabel="Une personne de moins à table" disabled={personnes <= 1} onPress={() => changerPersonnes(personnes - 1)} style={s.pas}><Text style={s.signe}>−</Text></Pressable>
            <Text style={s.nombre} accessibilityLabel={`${personnes} personnes à table`}>{personnes}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Une personne de plus à table" disabled={personnes >= 20} onPress={() => changerPersonnes(personnes + 1)} style={s.pas}><Text style={s.signe}>+</Text></Pressable>
          </View>
        </Ligne>
        <Ligne icone="mail" teinte="#3E6E8E" libelle="Membres et invitations" valeur={membres.length} onPress={() => router.push('/membres')} derniere />
      </Groupe>}
      {foyer && <Text style={s.aide}>{foyer.personnes ? `Les repas choisis sont prévus pour ${foyer.personnes} personne${foyer.personnes > 1 ? 's' : ''}.` : 'Indique combien vous êtes à table : les quantités des repas suivront.'}</Text>}
      {!!erreurReglage && <Text accessibilityLiveRegion="polite" style={ui.error}>{erreurReglage}</Text>}

      <Groupe titre="Courses">
        <Ligne icone="star" teinte="#9C7A12" libelle="Mes produits" valeur={references(produits).length || undefined} onPress={() => router.push('/favoris')} />
        <Ligne icone="file-text" teinte="#2E5683" libelle="Mes commandes" onPress={() => router.push('/commandes')} />
        <Ligne icone="link" teinte="#8A5A12" libelle="Liens aux drives" onPress={() => router.push('/liens')} />
        <Ligne icone="trending-down" teinte="#2F6B2F" libelle="Pistes" valeur={nbPistes || undefined} onPress={() => router.push('/pistes')} />
        <Ligne icone="shopping-cart" teinte={colors.accent} libelle="Drives et Chrome" valeur={drives} onPress={() => router.push('/wizard/generation')} />
        <Ligne icone="mic" teinte="#6E4F9A" libelle="Siri et widget" onPress={() => router.push('/siri')} derniere />
      </Groupe>

      <Groupe titre="Compte">
        <Ligne icone="smile" teinte="#9A5A1E" libelle="Prénom">
          <TextInput value={prenom ?? profil.prenom ?? ''} onChangeText={setPrenom} onBlur={enregistrerPrenom} onSubmitEditing={enregistrerPrenom} returnKeyType="done"
            autoCapitalize="words" autoComplete="given-name" textContentType="givenName" maxLength={40}
            accessibilityLabel="Ton prénom, affiché sur l’accueil" style={s.champ} placeholder="Pour l’accueil" placeholderTextColor={colors.textMuted} />
        </Ligne>
        {!!adresse && <Ligne icone="user" teinte="#6B7266" libelle={adresse} />}
        <Ligne icone="log-out" teinte={colors.danger} libelle="Se déconnecter" danger onPress={() => { void supabase.auth.signOut(); }} derniere />
      </Groupe>
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  corps: { padding: 16, paddingBottom: 40, gap: 18 },
  titre: { fontSize: 30, fontWeight: '700', color: colors.text, letterSpacing: -0.6, marginTop: 4 },
  aide: { fontSize: 13, color: colors.textMuted, marginTop: -10, paddingHorizontal: 4 },
  alerte: { backgroundColor: colors.dangerSoft, borderRadius: 12, padding: 12, gap: 4 },
  lien: { minHeight: 44, justifyContent: 'center' },
  champ: { flex: 1.4, minHeight: 44, fontSize: 15, color: colors.textMuted, textAlign: 'right' },
  compteur: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: 10 },
  pas: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  signe: { fontSize: 20, color: colors.text },
  nombre: { minWidth: 22, textAlign: 'center', fontSize: 16, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
});
