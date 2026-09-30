import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export function Orb({ size = 220, active = false }: { size?: number; active?: boolean }) {
  const breath = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: active ? 1400 : 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breath, { toValue: 0, duration: active ? 1400 : 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const b = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver: true }));
    a.start(); b.start(); return () => { a.stop(); b.stop(); };
  }, [active]);
  const rotation = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const counterRotation = spin.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, active ? 1.14 : 1.07] });
  return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="NEXUS animated intelligence core">
    <Animated.View style={[o.halo, { width: size * .88, height: size * .88, borderRadius: size, transform: [{ scale }], opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [.32, .65] }) }]} />
    <Animated.View style={[o.ring, { width: size * .78, height: size * .78, borderRadius: size, transform: [{ rotate: rotation }] }]}><View style={o.spark} /><View style={[o.spark, { right: 18, top: '70%', backgroundColor: '#F04F6D' }]} /></Animated.View>
    <Animated.View style={[o.ringInner, { width: size * .60, height: size * .60, borderRadius: size, transform: [{ rotate: counterRotation }] }]} />
    <Animated.View style={{ width: size * .49, height: size * .49, borderRadius: size, overflow: 'hidden', transform: [{ scale }] }}>
      <LinearGradient colors={['#43D4B0', '#4F8CF7', '#665BFF']} start={{ x: .1, y: .1 }} end={{ x: .9, y: .9 }} style={o.core}><View style={o.glint} /><Text style={[o.mark, { fontSize: size * .22 }]}>N</Text></LinearGradient>
    </Animated.View>
    <View style={[o.dot, { top: size * .10, left: size * .17 }]} /><View style={[o.dot, { bottom: size * .19, right: size * .10, width: 3, height: 3 }]} />
  </View>;
}
const o = StyleSheet.create({
  halo: { position: 'absolute', backgroundColor: '#DCE8F5', shadowColor: '#635BFF', shadowOpacity: .28, shadowRadius: 36, elevation: 15 },
  ring: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(22,184,143,.42)', borderStyle: 'dashed' },
  ringInner: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(99,91,255,.34)' },
  spark: { position: 'absolute', top: 14, left: 23, width: 7, height: 7, borderRadius: 5, backgroundColor: '#16B88F', shadowColor: '#16B88F', shadowOpacity: 1, shadowRadius: 12 },
  core: { flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  glint: { position: 'absolute', top: '-20%', left: '-20%', width: '90%', height: '65%', backgroundColor: 'rgba(255,255,255,.16)', transform: [{ rotate: '-30deg' }], borderRadius: 100 },
  mark: { color: '#F9FCFF', fontWeight: '900', letterSpacing: -9, textShadowColor: 'rgba(255,255,255,.7)', textShadowRadius: 8 },
  dot: { position: 'absolute', width: 4, height: 4, borderRadius: 4, backgroundColor: '#635BFF' },
});
