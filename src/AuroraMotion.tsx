import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

type IconName = keyof typeof Feather.glyphMap;

export function DayBackdrop() {
  const drift = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const d = Animated.loop(Animated.timing(drift, { toValue: 1, duration: 16000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }));
    const p = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    d.start(); p.start();
    return () => { d.stop(); p.stop(); };
  }, [drift, pulse]);

  const x = drift.interpolate({ inputRange:[0,1], outputRange:[-28,28] });
  const y = drift.interpolate({ inputRange:[0,1], outputRange:[18,-18] });
  const dots = useMemo(() => [
    ['9%','18%'],['17%','72%'],['32%','30%'],['46%','12%'],['58%','82%'],
    ['72%','22%'],['86%','66%'],['94%','38%'],['64%','54%'],['27%','88%']
  ], []);

  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <View style={m.mesh} />
    <Animated.View style={[m.blobMint,{ transform:[{translateX:x},{translateY:y}], opacity:pulse.interpolate({inputRange:[0,1],outputRange:[.46,.7]}) }]} />
    <Animated.View style={[m.blobLilac,{ transform:[{translateX:Animated.multiply(x,-1)},{translateY:Animated.multiply(y,-1)}] }]} />
    <Animated.View style={[m.blobSky,{ transform:[{translateY:y}] }]} />
    {dots.map(([left,top],i)=><Animated.View key={i} style={[m.spark,{left:left as any,top:top as any,opacity:pulse.interpolate({inputRange:[0,1],outputRange:[.15,.55]}),transform:[{translateY:i%2?y:Animated.multiply(y,-1)}]}]} />)}
  </View>;
}

export function PageTransition({ pageKey, children }: { pageKey:string; children:React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(12);
    Animated.parallel([
      Animated.timing(opacity,{toValue:1,duration:260,easing:Easing.out(Easing.cubic),useNativeDriver:true}),
      Animated.spring(translateY,{toValue:0,tension:90,friction:11,useNativeDriver:true}),
    ]).start();
  }, [pageKey, opacity, translateY]);

  return <Animated.View style={{opacity,transform:[{translateY}]}}>{children}</Animated.View>;
}

export function Reveal({ children, delay = 0, style }: { children:React.ReactNode; delay?:number; style?:any }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(10)).current;
  const scale = useRef(new Animated.Value(.985)).current;

  useEffect(() => {
    const timer = setTimeout(() => Animated.parallel([
      Animated.timing(opacity,{toValue:1,duration:300,easing:Easing.out(Easing.cubic),useNativeDriver:true}),
      Animated.spring(y,{toValue:0,tension:90,friction:12,useNativeDriver:true}),
      Animated.spring(scale,{toValue:1,tension:90,friction:12,useNativeDriver:true}),
    ]).start(), delay);
    return () => clearTimeout(timer);
  }, [delay, opacity, y, scale]);

  return <Animated.View style={[style,{opacity,transform:[{translateY:y},{scale}]}]}>{children}</Animated.View>;
}

export function LiftPressable({ children, onPress, style, activeStyle }: { children:React.ReactNode; onPress?:()=>void; style?:any; activeStyle?:any }) {
  const scale = useRef(new Animated.Value(1)).current;
  const y = useRef(new Animated.Value(0)).current;

  const down = () => Animated.parallel([
    Animated.spring(scale,{toValue:.985,useNativeDriver:true}),
    Animated.spring(y,{toValue:1,useNativeDriver:true}),
  ]).start();
  const up = () => Animated.parallel([
    Animated.spring(scale,{toValue:1,useNativeDriver:true}),
    Animated.spring(y,{toValue:0,useNativeDriver:true}),
  ]).start();

  return <Pressable onPress={onPress} onPressIn={down} onPressOut={up}>
    <Animated.View style={[style,activeStyle,{transform:[{translateY:y},{scale}]}]}>{children}</Animated.View>
  </Pressable>;
}

export function AnimatedTabs({
  items,
  activeId,
  onSelect,
  width = 114,
}: {
  items:{id:string;label:string;icon:IconName}[];
  activeId:string;
  onSelect:(id:string)=>void;
  width?:number;
}) {
  const activeIndex = Math.max(0, items.findIndex(x => x.id === activeId));
  const translateX = useRef(new Animated.Value(activeIndex * width)).current;

  useEffect(() => {
    Animated.spring(translateX,{toValue:activeIndex * width,tension:95,friction:12,useNativeDriver:true}).start();
  }, [activeIndex, translateX, width]);

  return <View style={m.tabs}>
    <Animated.View style={[m.indicator,{width,transform:[{translateX}]}]} />
    {items.map(item => {
      const active = item.id === activeId;
      return <Pressable key={item.id} onPress={() => onSelect(item.id)} style={[m.tab,{width}]}>
        <Feather name={item.icon as any} size={15} color={active ? '#ffffff' : '#5E6B80'} />
        <Text style={[m.tabText,active&&m.tabTextActive]}>{item.label}</Text>
      </Pressable>;
    })}
  </View>;
}

export function PulseHalo({ color = '#64DFC2' }: { color?:string }) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(p,{toValue:1,duration:1900,easing:Easing.out(Easing.quad),useNativeDriver:true}));
    loop.start(); return () => loop.stop();
  }, [p]);
  return <View style={m.haloWrap}>
    <Animated.View style={[m.halo,{borderColor:color,opacity:p.interpolate({inputRange:[0,1],outputRange:[.55,0]}),transform:[{scale:p.interpolate({inputRange:[0,1],outputRange:[.75,1.5]})}]}]} />
    <View style={[m.haloCore,{backgroundColor:color}]} />
  </View>;
}

const m = StyleSheet.create({
  mesh:{position:'absolute',top:0,right:0,bottom:0,left:0,backgroundColor:'#F4F7FB'},
  blobMint:{position:'absolute',width:560,height:560,borderRadius:320,backgroundColor:'#DDF9F1',right:-180,top:-220},
  blobLilac:{position:'absolute',width:430,height:430,borderRadius:260,backgroundColor:'#EEE8FF',left:-170,bottom:-180,opacity:.72},
  blobSky:{position:'absolute',width:300,height:300,borderRadius:200,backgroundColor:'#E5F2FF',left:'42%' as any,top:'34%' as any,opacity:.55},
  spark:{position:'absolute',width:4,height:4,borderRadius:4,backgroundColor:'#9AA7BA'},
  tabs:{height:48,flexDirection:'row',alignItems:'center',padding:4,backgroundColor:'rgba(255,255,255,.78)',borderWidth:1,borderColor:'#DDE4EE',borderRadius:16,overflow:'hidden',shadowColor:'#65748A',shadowOpacity:.08,shadowRadius:18,shadowOffset:{width:0,height:8}},
  indicator:{position:'absolute',left:4,top:4,bottom:4,borderRadius:12,backgroundColor:'#172033',shadowColor:'#172033',shadowOpacity:.16,shadowRadius:10},
  tab:{height:40,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,zIndex:2},
  tabText:{fontSize:9.5,fontWeight:'800',color:'#5E6B80'},tabTextActive:{color:'#FFFFFF'},
  haloWrap:{width:28,height:28,alignItems:'center',justifyContent:'center'},halo:{position:'absolute',width:28,height:28,borderWidth:1.5,borderRadius:20},haloCore:{width:7,height:7,borderRadius:7},
});
