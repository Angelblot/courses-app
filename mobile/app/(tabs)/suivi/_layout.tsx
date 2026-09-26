import type { ErrorBoundaryProps } from 'expo-router';
import { Stack } from 'expo-router';
import { EcranErreur } from '../../../components/EcranErreur';

export default function SuiviLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

/**
 * Expo Router monte ce composant à la place de l'écran quand son rendu lève.
 * Sans lui, l'exception remonte jusqu'à Hermes, qui termine le processus :
 * l'application se ferme sans le moindre message.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <EcranErreur error={error} retry={retry} />;
}
