import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { BandeauSuivi } from '../../components/BandeauSuivi';
import { colors } from '../../lib/theme';

export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        }}
      >
        <Tabs.Screen
          name="recettes"
          options={{
            title: 'Recettes',
            tabBarIcon: ({ color, size }) => <Feather name="book-open" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="wizard"
          options={{
            title: 'Wizard',
            tabBarIcon: ({ color, size }) => <Feather name="list" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="index"
          options={{
            title: 'Produits',
            tabBarIcon: ({ color, size }) => <Feather name="shopping-bag" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="scan"
          options={{
            title: 'Scan',
            tabBarIcon: ({ color, size }) => <Feather name="camera" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="compte"
          options={{
            title: 'Compte',
            tabBarIcon: ({ color, size }) => <Feather name="user" color={color} size={size} />,
          }}
        />
      </Tabs>
      <BandeauSuivi />
    </View>
  );
}
