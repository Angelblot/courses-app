import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

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
    const surLogin = segments[0] === 'login';
    if (!session && !surLogin) router.replace('/login');
    if (session && surLogin) router.replace('/');
  }, [pret, session, segments, router]);

  if (!pret) return null;

  return <Stack screenOptions={{ headerShown: false }} />;
}
