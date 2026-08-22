import { Stack } from 'expo-router';
import { WizardProvider } from '../../../contexts/WizardContext';

export default function WizardLayout() {
  return (
    <WizardProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </WizardProvider>
  );
}
