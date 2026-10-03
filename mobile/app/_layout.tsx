import { WizardProvider } from '../contexts/WizardContext';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { ErrorBoundaryProps } from 'expo-router';
import { Stack, useRouter, useSegments } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import { EcranErreur } from '../components/EcranErreur';

// Les onglets restent toujours au fond de la pile : un lien profond (Siri,
// widget, notification) qui ouvre directement /ajout garde un écran où revenir.
export const unstable_settings = { initialRouteName: '(tabs)' };

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
    if (session && route === 'login') router.dismissTo('/');
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

  // Racine des gestes : sans elle, le glisser pour retirer ne répond pas.
  // Une seule pile pour tout ce qui s'ouvre depuis un onglet (Mes produits,
  // une commande, l'assistant de courses…) : le retour, bouton ou glisser
  // depuis le bord, ramène toujours à l'écran d'où l'on vient. La fiche
  // produit, ouverte par un appui long n'importe où, monte en feuille.
  return <GestureHandlerRootView style={{ flex: 1 }}><WizardProvider key={session?.user.id ?? "anonyme"} userId={session?.user.id ?? null}>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="produit/[id]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="login" options={{ animation: 'fade', gestureEnabled: false }} />
    </Stack>
  </WizardProvider></GestureHandlerRootView>;
}

/**
 * Expo Router monte ce composant à la place de l'écran quand son rendu lève.
 * Sans lui, l'exception remonte jusqu'à Hermes, qui termine le processus :
 * l'application se ferme sans le moindre message.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <EcranErreur error={error} retry={retry} />;
}
