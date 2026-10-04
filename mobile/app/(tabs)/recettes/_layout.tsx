import { Stack } from 'expo-router';

// Une recette ouverte d'ailleurs (l'accueil) garde la liste en dessous : le
// retour et l'onglet ne restent jamais bloqués sur elle.
export const unstable_settings = { initialRouteName: 'index' };

export default function RecettesLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
