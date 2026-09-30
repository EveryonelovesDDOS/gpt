import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

export function AnimatedBackdrop() {
  const drift = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(drift, { toValue: 1, duration: 18000, easing: Easing.linear, useNativeDriver: true }));
    const b = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    a.start(); b.start(); return () => { a.stop(); b.stop(); };
  }, []);
  const particles = useMemo(() => [
    { x: '8%', y: '18%', s: 3 }, { x: '18%', y: '72%', s: 2 }, { x: '31%', y: '36%', s: 3 },
    { x: '44%', y: '12%', s: 2 }, { x: '58%', y: '66%', s: 3 }, { x: '70%', y: '28%', s: 2 },
    { x: '82%', y: '76%', s: 3 }, { x: '92%', y: '38%', s: 2 }, { x: '64%', y: '90%', s: 2 },
  ], []);
  const translateX = drift.interpolate({ inputRange: [0,1], outputRange: [-24,24] });
  const translateY = drift.interpolate({ inputRange: [0,1], outputRange: [12,-12] });
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <View style={v.grid} />
    <Animated.View style={[v.orbA, { transform: [{ translateX }, { translateY }], opacity: pulse.interpolate({ inputRange:[0,1], outputRange:[.28,.48] }) }]} />
    <Animated.View style={[v.orbB, { transform: [{ translateX: Animated.multiply(translateX, -1) }], opacity: .28 }]} />
    {particles.map((p, i) => <Animated.View key={i} style={[v.particle, { left: p.x as any, top: p.y as any, width: p.s, height: p.s, borderRadius: p.s, opacity: pulse.interpolate({ inputRange:[0,1], outputRange:[.2,.9] }), transform: [{ translateY: i % 2 ? translateY : Animated.multiply(translateY, -1) }] }]} />)}
  </View>;
}

export function PulseRail({ vertical = false }: { vertical?: boolean }) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(p, { toValue: 1, duration: 1800, easing: Easing.linear, useNativeDriver: true }));
    a.start(); return () => a.stop();
  }, []);
  const translate = p.interpolate({ inputRange:[0,1], outputRange:[-26, 120] });
  return <View style={[v.rail, vertical ? v.railVertical : v.railHorizontal]}>
    <Animated.View style={[v.railPulse, vertical ? { transform:[{ translateY: translate }] } : { transform:[{ translateX: translate }] }]} />
  </View>;
}

export function ThinkingDots() {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a,{toValue:1,duration:650,useNativeDriver:true}),
      Animated.timing(a,{toValue:0,duration:650,useNativeDriver:true}),
    ]));
    loop.start(); return () => loop.stop();
  },[]);
  return <View style={v.dots}>
    {[0,.22,.44].map((delay,i)=><Animated.View key={i} style={[v.thinkDot,{ opacity:a.interpolate({inputRange:[0,1],outputRange:[.25 + delay,.95]}), transform:[{scale:a.interpolate({inputRange:[0,1],outputRange:[.8,1.15]})}] }]} />)}
  </View>;
}

export function ScanRing({ danger = false }: { danger?: boolean }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(()=>{ const loop=Animated.loop(Animated.timing(a,{toValue:1,duration:2200,easing:Easing.out(Easing.quad),useNativeDriver:true})); loop.start(); return()=>loop.stop(); },[]);
  return <View style={v.scanWrap}>
    <Animated.View style={[v.scanRing,{ borderColor: danger ? '#FF6B8A' : '#61F4C3', opacity:a.interpolate({inputRange:[0,1],outputRange:[.8,0]}), transform:[{scale:a.interpolate({inputRange:[0,1],outputRange:[.65,1.45]})}] }]} />
    <View style={[v.scanCore,{ backgroundColor:danger?'#FF6B8A':'#61F4C3' }]} />
  </View>;
}

const v = StyleSheet.create({
  grid: { position:'absolute', top:0, right:0, bottom:0, left:0, opacity:.16, backgroundColor:'transparent', borderWidth:1, borderColor:'rgba(132,94,194,.10)' },
  orbA:{ position:'absolute', width:520, height:520, borderRadius:300, backgroundColor:'#243B31', right:-220, top:-190 },
  orbB:{ position:'absolute', width:380, height:380, borderRadius:240, backgroundColor:'#3B2154', left:'28%' as any, bottom:-250 },
  particle:{ position:'absolute', backgroundColor:'#61F4C3', shadowColor:'#61F4C3', shadowOpacity:1, shadowRadius:8 },
  rail:{ overflow:'hidden', backgroundColor:'#3A3344' }, railHorizontal:{ height:2, flex:1 }, railVertical:{ width:2, height:120, alignSelf:'center' },
  railPulse:{ width:34, height:3, borderRadius:3, backgroundColor:'#A78BFA', shadowColor:'#A78BFA', shadowOpacity:1, shadowRadius:10 },
  dots:{ flexDirection:'row', gap:5, alignItems:'center' }, thinkDot:{ width:6, height:6, borderRadius:6, backgroundColor:'#61F4C3' },
  scanWrap:{ width:28,height:28,alignItems:'center',justifyContent:'center' }, scanRing:{ position:'absolute', width:28,height:28,borderRadius:20,borderWidth:1 }, scanCore:{ width:6,height:6,borderRadius:6 },
});
