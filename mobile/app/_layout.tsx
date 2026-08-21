import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  // 'inconnue' tant que la session stockée n'est pas relue : sans cet état on
  // afficherait brièvement l'écran de connexion à quelqu'un de déjà connecté.
  const [pret, setPret] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setPret(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!pret) return;
    // Deux routes sont accessibles sans session. `reinitialisation` doit en
    // outre rester atteignable AVEC une session : l'échange du code de
    // récupération en crée une, et une redirection vers l'accueil à ce
    // moment-là escamoterait l'écran de saisie du nouveau mot de passe.
    const route = segments[0] ?? '';
    const publique = route === 'login' || route === 'reinitialisation';
    if (!session && !publique) router.replace('/login');
    if (session && route === 'login') router.replace('/');
  }, [pret, session, segments, router]);

  // Jamais d'écran muet : tant que la session stockée n'a pas été relue,
  // on affiche un indicateur plutôt qu'un écran blanc sans explication.
  if (!pret) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
