import { View } from 'react-native';
import { Tabs, usePathname } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { BandeauSuivi } from '../../components/BandeauSuivi';
import { colors } from '../../lib/theme';

/**
 * Les trois onglets, et eux seuls. Tout écran ouvert depuis l'un d'eux (Mes
 * produits, une commande, l'assistant…) vit dans la pile racine, au-dessus :
 * revenir en arrière y ramène à l'écran précédent, pas au premier onglet.
 */
export default function TabsLayout() {
  const path = usePathname();
  return <View style={{ flex: 1 }}><Tabs backBehavior="history" screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.textMuted, tabBarStyle: { display: path.endsWith('/modifier') ? 'none' : 'flex', backgroundColor: colors.surface, borderTopColor: colors.border } }}>
    <Tabs.Screen name="index" options={{ title: 'Courses', tabBarAccessibilityLabel: 'Courses', tabBarIcon: ({ color, size }) => <Feather name="shopping-cart" color={color} size={size} /> }} />
    <Tabs.Screen name="recettes" options={{ title: 'Recettes', tabBarAccessibilityLabel: 'Recettes', tabBarIcon: ({ color, size }) => <Feather name="book-open" color={color} size={size} /> }} />
    <Tabs.Screen name="compte" options={{ title: 'Réglages', tabBarAccessibilityLabel: 'Réglages', tabBarIcon: ({ color, size }) => <Feather name="settings" color={color} size={size} /> }} />
  </Tabs><BandeauSuivi /></View>;
}
