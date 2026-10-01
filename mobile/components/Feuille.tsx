import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { nomDialogue } from './MaisonUI';

const natif = Platform.OS !== 'web';

/**
 * Feuille montant du bas. Le voile apparaît en fondu, tout de suite, et
 * seule la feuille glisse : avec `animationType="slide"`, le voile montait
 * avec elle et s'assombrissait en retard. À la fermeture, la feuille
 * redescend avant que la modale disparaisse.
 */
export function Feuille({ visible, onFermer, nom, children, clavier = false, fondCliquable = false }: {
  visible: boolean;
  onFermer: () => void;
  /** Nom annoncé de la boîte de dialogue (web). */
  nom?: string;
  children: ReactNode;
  /** La feuille contient un champ : elle remonte au-dessus du clavier. */
  clavier?: boolean;
  /** Le fond est annoncé comme un bouton « Fermer » (sinon, ignoré des lecteurs d'écran). */
  fondCliquable?: boolean;
}) {
  const { height } = useWindowDimensions();
  const [montee, setMontee] = useState(visible);
  const avance = useRef(new Animated.Value(0)).current;
  const reduit = useRef(false);
  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then((r) => { reduit.current = r; }); }, []);
  useEffect(() => {
    if (visible) {
      setMontee(true);
      Animated.timing(avance, { toValue: 1, duration: reduit.current ? 0 : 280, easing: Easing.out(Easing.cubic), useNativeDriver: natif }).start();
    } else if (montee) {
      Animated.timing(avance, { toValue: 0, duration: reduit.current ? 0 : 200, easing: Easing.in(Easing.cubic), useNativeDriver: natif })
        .start(() => setMontee(false));
    }
  }, [visible]);
  const Conteneur = clavier ? KeyboardAvoidingView : Animated.View;
  return <Modal {...(nom ? nomDialogue(nom) : {})} visible={montee} transparent animationType="none" onRequestClose={onFermer} statusBarTranslucent>
    <Conteneur behavior={clavier && Platform.OS === 'ios' ? 'padding' : undefined} style={s.fond}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.voile, { opacity: avance }]} />
      <Pressable style={StyleSheet.absoluteFill} onPress={onFermer}
        {...(fondCliquable ? { accessibilityRole: 'button' as const, accessibilityLabel: 'Fermer' } : { accessible: false, focusable: false, importantForAccessibility: 'no' as const })} />
      <Animated.View style={{ transform: [{ translateY: avance.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] }}>
        {children}
      </Animated.View>
    </Conteneur>
  </Modal>;
}

const s = StyleSheet.create({
  fond: { flex: 1, justifyContent: 'flex-end' },
  voile: { backgroundColor: 'rgba(20,28,16,0.32)' },
});
