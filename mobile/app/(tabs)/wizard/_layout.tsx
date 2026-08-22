import { Stack } from 'expo-router';
import { WizardProvider } from '../../../contexts/WizardContext';

export default function WizardLayout() {
  return (
    <WizardProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          // Le geste de retour iOS est désactivé sur tout le wizard : il est
          // reconnu nativement par react-native-screens, qui l'emporte sur le
          // PanResponder de la pile de cartes. Glisser une carte vers la droite
          // dépilait l'étape au lieu de retenir le produit. La croix en haut
          // reste le seul moyen de sortir, et le bouton Continuer d'avancer.
          gestureEnabled: false,
        }}
      />
    </WizardProvider>
  );
}
