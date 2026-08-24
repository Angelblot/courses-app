import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { BandeauSuivi } from '../../components/BandeauSuivi';
import { colors } from '../../lib/theme';

/**
 * Pastille du wizard, au centre de la barre.
 *
 * Le wizard est la raison d'être du produit : il ne peut pas avoir le même
 * poids visuel que « Scan » ou « Compte ».
 */
function PastilleWizard({ focused }: { focused: boolean }) {
  return (
    <View style={[s.pastille, focused && s.pastilleActive]}>
      <Feather name="list" color={colors.accentContrast} size={22} />
    </View>
  );
}

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
          name="index"
          options={{
            title: 'Produits',
            tabBarIcon: ({ color, size }) => <Feather name="shopping-bag" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="wizard"
          options={{
            title: 'Ma liste',
            tabBarIcon: ({ focused }) => <PastilleWizard focused={focused} />,
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

        {/*
          Le suivi reste une route, jamais un onglet. `href: null` le retire de
          la barre : sans cette ligne, expo-router ajoute d'office un onglet
          pour tout dossier non déclaré, et celui-ci ne contient qu'une route
          dynamique `[id]`. Le taper menait donc vers une route sans paramètre.
          On y entre par le bandeau, qui connaît l'identifiant du travail.
        */}
        <Tabs.Screen name="suivi" options={{ href: null }} />
      </Tabs>
      <BandeauSuivi />
    </View>
  );
}

const s = StyleSheet.create({
  pastille: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.textMuted,
    // Remonte la pastille pour qu'elle déborde de la barre, sans quoi elle
    // paraîtrait simplement grosse plutôt que mise en avant.
    marginTop: -18,
  },
  pastilleActive: { backgroundColor: colors.accent },
});
