import { useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Feather } from '@expo/vector-icons';
import { colors } from '../lib/theme';

/**
 * Une ligne qu'on retire en la faisant glisser vers la gauche, comme dans
 * Mail ou Rappels : le glisser découvre « Retirer », un tap confirme. Le
 * retrait passe par l'appelant, qui propose « Annuler ». VoiceOver reçoit
 * la même action, sans geste.
 */
export function GlisserRetirer({ nom, onRetirer, children }: { nom: string; onRetirer: () => void; children: ReactNode }) {
  const ref = useRef<Swipeable>(null);
  const retirer = () => { ref.current?.close(); onRetirer(); };
  return <Swipeable ref={ref} friction={1.6} rightThreshold={48} overshootRight={false}
    renderRightActions={() => <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${nom}`} onPress={retirer} style={({ pressed }) => [s.action, pressed && { opacity: .85 }]}>
      <Feather name="trash-2" size={20} color="#FFFFFF" /><Text style={s.texte}>Retirer</Text>
    </Pressable>}>
    <View accessible={false} accessibilityActions={[{ name: 'retirer', label: 'Retirer' }]} onAccessibilityAction={e => { if (e.nativeEvent.actionName === 'retirer') onRetirer(); }}>
      {children}
    </View>
  </Swipeable>;
}

const s = StyleSheet.create({
  action: { width: 96, marginLeft: 8, borderRadius: 12, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', gap: 4 },
  texte: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
