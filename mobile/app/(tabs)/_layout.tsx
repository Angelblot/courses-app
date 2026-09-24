import { View } from 'react-native';
import { Tabs, usePathname } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { BandeauSuivi } from '../../components/BandeauSuivi';
import { colors } from '../../lib/theme';
export default function TabsLayout() {
  const path = usePathname();
  const courses = !path.startsWith('/recettes') && !path.startsWith('/compte');
  return <View style={{ flex: 1 }}><Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.textMuted, tabBarStyle: { display: path.endsWith('/modifier') ? 'none' : 'flex', backgroundColor: colors.surface, borderTopColor: colors.border } }}>
    <Tabs.Screen name="index" options={{ title: 'Courses', tabBarLabelStyle: { color: courses ? colors.accent : colors.textMuted }, tabBarIcon: ({color,size}) => <Feather name="shopping-cart" color={courses ? colors.accent : color} size={size}/> }}/>
    <Tabs.Screen name="recettes" options={{ title: 'Recettes', tabBarIcon: ({color,size}) => <Feather name="book-open" color={color} size={size}/> }}/>
    <Tabs.Screen name="compte" options={{ title: 'Réglages', tabBarIcon: ({color,size}) => <Feather name="settings" color={color} size={size}/> }}/>
    <Tabs.Screen name="manques" options={{ href: null }}/><Tabs.Screen name="ajout" options={{ href: null }}/><Tabs.Screen name="habitudes" options={{ href: null }}/><Tabs.Screen name="scan" options={{ href: null }}/><Tabs.Screen name="favoris" options={{ href: null }}/><Tabs.Screen name="liste" options={{ href: null }}/><Tabs.Screen name="wizard" options={{ href: null }}/><Tabs.Screen name="suivi" options={{ href: null }}/>
  </Tabs><BandeauSuivi/></View>;
}
