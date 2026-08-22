import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, StyleSheet, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { radius } from '../../lib/theme';

const SEUIL = 90;

type Props<T> = {
  items: T[];
  onAccepter: (item: T) => void;
  onRejeter: (item: T) => void;
  rendreCarte: (item: T) => ReactNode;
  etatVide: ReactNode;
  getId?: (item: T) => string;
};

/**
 * Pile de cartes à faire glisser. Droite pour retenir, gauche pour écarter.
 *
 * `PanResponder` du cœur de React Native plutôt que `react-native-reanimated` :
 * ajouter ce dernier imposerait un nouveau pod, donc un prebuild, alors que la
 * chaîne de compilation vient de se stabiliser. Animer une carte à la fois n'a
 * pas besoin du fil d'interface dédié qu'apporte Reanimated.
 */
export function PileSwipe<T>({
  items, onAccepter, onRejeter, rendreCarte, etatVide, getId,
}: Props<T>) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const position = useRef(new Animated.ValueXY()).current;

  // Refs doublant l'état : le PanResponder n'est créé qu'une fois et
  // capturerait sinon l'index du premier rendu pour toute la vie du composant.
  const indexRef = useRef(0);
  indexRef.current = index;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const rappelsRef = useRef({ onAccepter, onRejeter });
  rappelsRef.current = { onAccepter, onRejeter };

  const cle = items.map((it, n) => (getId ? getId(it) : String(n))).join('|');
  useEffect(() => {
    setIndex(0);
    position.setValue({ x: 0, y: 0 });
  }, [cle, position]);

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6,
      onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, g) => {
        const direction = g.dx > SEUIL ? 1 : g.dx < -SEUIL ? -1 : 0;
        if (direction === 0) {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 6,
          }).start();
          return;
        }
        const item = itemsRef.current[indexRef.current];
        if (item === undefined) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Animated.timing(position, {
          toValue: { x: direction * width * 1.2, y: 0 },
          duration: 220,
          useNativeDriver: false,
        }).start(() => {
          position.setValue({ x: 0, y: 0 });
          setIndex((n) => n + 1);
          if (direction === 1) rappelsRef.current.onAccepter(item);
          else rappelsRef.current.onRejeter(item);
        });
      },
    }),
  ).current;

  if (index >= items.length) return <>{etatVide}</>;

  const rotation = position.x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ['-12deg', '0deg', '12deg'],
  });

  return (
    <View style={s.zone}>
      {/* Les deux cartes suivantes, en retrait, donnent la profondeur de pile. */}
      {items.slice(index + 1, index + 3).reverse().map((item, n) => {
        const rang = 2 - n;
        return (
          <View
            key={getId ? getId(item) : `fond-${rang}`}
            style={[s.carte, { transform: [{ translateY: rang * 10 }, { scale: 1 - rang * 0.04 }] }]}
            pointerEvents="none"
          >
            {rendreCarte(item)}
          </View>
        );
      })}

      <Animated.View
        style={[
          s.carte,
          {
            transform: [
              { translateX: position.x },
              { translateY: Animated.multiply(position.y, 0.3) },
              { rotate: rotation },
            ],
          },
        ]}
        {...responder.panHandlers}
      >
        {rendreCarte(items[index])}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  // La pile occupe toute la hauteur offerte : une carte verticale a besoin de
  // place, et l'image se recadrait quand la zone était bornée.
  zone: { flex: 1, alignItems: 'stretch', justifyContent: 'center' },
  carte: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: radius.lg },
});
