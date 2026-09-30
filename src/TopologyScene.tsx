import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { NetworkTopology, TopologyNode } from './types';

type Props = {
  topology: NetworkTopology | null;
  incidentMode?: boolean;
  onSelect?: (node: TopologyNode | null) => void;
};

const C = {
  panel:'#FFFFFF',
  line:'#DCE4EE',
  mint:'#43CDAA',
  mintSoft:'#E3F8F1',
  violet:'#776BFF',
  violetSoft:'#EFEDFF',
  coral:'#FF657C',
  coralSoft:'#FFF0F3',
  amber:'#F0A94B',
  text:'#172033',
  muted:'#68768B',
  soft:'#95A1B3',
};

const iconFor = (node: TopologyNode) =>
  node.role === 'edge-router' ? 'radio' :
  node.role === 'core-switch' ? 'cpu' :
  node.role === 'attacker' ? 'alert-triangle' : 'monitor';

export function TopologyScene({ topology, incidentMode = false, onSelect }: Props) {
  const [selected, setSelected] = useState<TopologyNode | null>(null);
  const flow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(flow,{toValue:1,duration:2100,easing:Easing.linear,useNativeDriver:true}));
    loop.start();
    return () => loop.stop();
  }, [flow]);

  const nodes = topology?.nodes || [];
  const edge = nodes.find(n => n.role === 'edge-router');
  const core = nodes.find(n => n.role === 'core-switch');
  const hosts = nodes.filter(n => n.kind === 'host');

  const zones = useMemo(() => {
    const trusted = hosts.filter(n => ['ADMIN','FINANCE','STAFF'].includes(n.zone));
    const untrusted = hosts.filter(n => n.zone === 'GUEST' || n.role === 'attacker');
    const protectedHosts = hosts.filter(n => ['SERVER','PUBLIC','MANAGEMENT'].includes(n.zone));
    const used = new Set([...trusted,...untrusted,...protectedHosts].map(n => n.id));
    const other = hosts.filter(n => !used.has(n.id));
    return [
      { key:'trusted', label:'Trusted users', tone:C.mint, soft:C.mintSoft, nodes:trusted },
      { key:'untrusted', label:'Untrusted / guest', tone:C.coral, soft:C.coralSoft, nodes:untrusted },
      { key:'protected', label:'Protected services', tone:C.violet, soft:C.violetSoft, nodes:protectedHosts },
      ...(other.length ? [{ key:'other', label:'Other', tone:C.amber, soft:'#FFF8EB', nodes:other }] : []),
    ];
  }, [hosts]);

  const choose = (node: TopologyNode) => {
    setSelected(node);
    onSelect?.(node);
  };

  return <View style={[s.shell,incidentMode&&s.shellIncident]}>
    <View style={s.header}>
      <View>
        <Text style={s.kicker}>{incidentMode?'INCIDENT TRACE':'LIVE FABRIC'}</Text>
        <Text style={s.title}>{incidentMode?'Guest-zone path under review':'Trust-zone topology'}</Text>
      </View>
      <View style={[s.liveChip,incidentMode&&s.liveChipDanger]}>
        <View style={[s.liveDot,incidentMode&&s.liveDotDanger]} />
        <Text style={[s.liveText,incidentMode&&s.liveTextDanger]}>{incidentMode?'FOCUS':'STREAMING'}</Text>
      </View>
    </View>

    <View style={s.backboneCard}>
      <View style={s.backboneRow}>
        {edge && <DeviceNode node={edge} selected={selected?.id===edge.id} onPress={()=>choose(edge)} />}
        <View style={s.flowRail}>
          <View style={s.flowBase} />
          {[0,.33,.66].map((offset,i)=><Animated.View key={i} style={[s.flowPulse,incidentMode&&s.flowPulseDanger,{
            opacity:flow.interpolate({inputRange:[0,.08,.9,1],outputRange:[0,1,1,0]}),
            transform:[{translateX:flow.interpolate({inputRange:[0,1],outputRange:[-74+offset*145,74+offset*145]})}],
          }]} />)}
          <Text style={s.flowLabel}>10.0.0.0/30</Text>
        </View>
        {core && <DeviceNode node={core} selected={selected?.id===core.id} onPress={()=>choose(core)} />}
      </View>
    </View>

    <View style={s.zoneGrid}>
      {zones.map(zone=><View key={zone.key} style={[s.zoneCard,{backgroundColor:zone.soft},zone.key==='untrusted'&&incidentMode&&s.zoneCardDanger]}>
        <View style={s.zoneHeader}>
          <View style={[s.zoneMark,{backgroundColor:zone.tone}]} />
          <Text style={s.zoneLabel}>{zone.label}</Text>
          <Text style={s.zoneCount}>{zone.nodes.length}</Text>
        </View>
        <View style={s.zoneNodes}>
          {zone.nodes.length ? zone.nodes.map(node=><Pressable key={node.id} onPress={()=>choose(node)} style={[
            s.host,
            selected?.id===node.id&&s.hostSelected,
            node.role==='attacker'&&s.hostDanger,
            incidentMode&&node.role==='attacker'&&s.hostDangerActive,
          ]}>
            <View style={s.hostTop}>
              <View style={[s.hostIcon,{backgroundColor:node.role==='attacker'?C.coralSoft:'#FFFFFF'}]}>
                <Feather name={iconFor(node) as any} size={15} color={node.role==='attacker'?C.coral:zone.tone} />
              </View>
              {incidentMode&&node.role==='attacker'&&<Text style={s.focusTag}>SOURCE</Text>}
            </View>
            <Text style={s.hostName}>{node.label}</Text>
            <Text style={s.hostMeta}>{node.ip||'No IP'}</Text>
            <View style={s.hostFooter}>
              <Text style={s.hostZone}>{node.zone}</Text>
              {!!node.vlan&&<Text style={[s.hostVlan,{color:zone.tone}]}>VLAN {node.vlan}</Text>}
            </View>
          </Pressable>) : <Text style={s.empty}>No discovered hosts</Text>}
        </View>
      </View>)}
    </View>

    {incidentMode&&<View style={s.incidentStrip}>
      <View style={s.incidentIcon}><Feather name="zap" size={15} color={C.coral}/></View>
      <View style={{flex:1}}>
        <Text style={s.incidentTitle}>Simulation trace enabled</Text>
        <Text style={s.incidentText}>ATTACKER-PC is a lab marker. NEXUS highlights the guest-zone context for investigation without treating the label as proof of compromise.</Text>
      </View>
    </View>}

    {selected&&<View style={s.inspector}>
      <View style={[s.inspectorIcon,{backgroundColor:selected.role==='attacker'?C.coralSoft:C.mintSoft}]}>
        <Feather name={iconFor(selected) as any} size={17} color={selected.role==='attacker'?C.coral:C.mint}/>
      </View>
      <View style={{flex:1}}>
        <Text style={s.inspectorName}>{selected.label}</Text>
        <Text style={s.inspectorMeta}>{selected.ip||'No IP'} · {selected.zone}{selected.vlan ? ' · VLAN ' + selected.vlan : ''}</Text>
      </View>
      <Text style={s.inspectorRole}>{selected.role.toUpperCase()}</Text>
    </View>}
  </View>;
}

function DeviceNode({ node, selected, onPress }: { node:TopologyNode; selected:boolean; onPress:()=>void }) {
  const scale = useRef(new Animated.Value(1)).current;
  return <Pressable onPress={onPress}
    onPressIn={()=>Animated.spring(scale,{toValue:.985,useNativeDriver:true}).start()}
    onPressOut={()=>Animated.spring(scale,{toValue:1,useNativeDriver:true}).start()}>
    <Animated.View style={[s.device,selected&&s.deviceSelected,{transform:[{scale}]}]}>
      <View style={[s.deviceIcon,{backgroundColor:node.role==='edge-router'?C.violetSoft:C.mintSoft}]}>
        <Feather name={iconFor(node) as any} size={19} color={node.role==='edge-router'?C.violet:C.mint}/>
      </View>
      <View><Text style={s.deviceName}>{node.label}</Text><Text style={s.deviceIp}>{node.ip||node.zone}</Text></View>
    </Animated.View>
  </Pressable>;
}

const s = StyleSheet.create({
  shell:{backgroundColor:'rgba(255,255,255,.86)',borderWidth:1,borderColor:'#E0E6EF',borderRadius:26,padding:18,shadowColor:'#6F7D92',shadowOpacity:.08,shadowRadius:22,shadowOffset:{width:0,height:10}},
  shellIncident:{borderColor:'#F5C6D0',backgroundColor:'rgba(255,250,251,.94)'},
  header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:14,marginBottom:16},
  kicker:{color:C.mint,fontSize:8,fontWeight:'900',letterSpacing:1.7},title:{color:C.text,fontSize:20,fontWeight:'900',marginTop:5},
  liveChip:{flexDirection:'row',alignItems:'center',gap:7,borderWidth:1,borderColor:'#AEE5D6',backgroundColor:'#F1FBF8',borderRadius:20,paddingHorizontal:10,paddingVertical:6},
  liveChipDanger:{borderColor:'#F4C1CD',backgroundColor:'#FFF5F7'},liveDot:{width:6,height:6,borderRadius:6,backgroundColor:C.mint},liveDotDanger:{backgroundColor:C.coral},
  liveText:{color:'#269878',fontSize:8,fontWeight:'900',letterSpacing:.8},liveTextDanger:{color:'#D64E68'},
  backboneCard:{backgroundColor:'#FAFBFD',borderRadius:20,borderWidth:1,borderColor:C.line,padding:16},
  backboneRow:{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:12},
  device:{minWidth:180,flexDirection:'row',alignItems:'center',gap:11,borderWidth:1,borderColor:'#DCE4EE',backgroundColor:'#FFFFFF',borderRadius:16,padding:14,shadowColor:'#748196',shadowOpacity:.06,shadowRadius:10,shadowOffset:{width:0,height:5}},
  deviceSelected:{borderColor:C.violet},deviceIcon:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center'},
  deviceName:{color:C.text,fontSize:11,fontWeight:'900'},deviceIp:{color:C.muted,fontSize:8.5,marginTop:3},
  flowRail:{width:210,height:52,alignItems:'center',justifyContent:'center',overflow:'hidden'},flowBase:{position:'absolute',height:2,width:'100%',backgroundColor:'#D3DBE6'},
  flowPulse:{position:'absolute',width:12,height:12,borderRadius:12,backgroundColor:C.mint,shadowColor:C.mint,shadowOpacity:.35,shadowRadius:9},
  flowPulseDanger:{backgroundColor:C.coral,shadowColor:C.coral},flowLabel:{color:C.soft,fontSize:8,marginTop:24},
  zoneGrid:{flexDirection:'row',flexWrap:'wrap',gap:12,marginTop:12},
  zoneCard:{flexGrow:1,flexBasis:240,minWidth:220,borderWidth:1,borderColor:'#E2E7EF',borderRadius:18,padding:14},
  zoneCardDanger:{borderColor:'#F3B9C7',shadowColor:C.coral,shadowOpacity:.08,shadowRadius:18},
  zoneHeader:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:12},zoneMark:{width:8,height:8,borderRadius:8},zoneLabel:{flex:1,color:C.text,fontSize:8,fontWeight:'900',letterSpacing:1.2},zoneCount:{color:C.soft,fontSize:8,fontWeight:'900'},
  zoneNodes:{gap:8},host:{borderWidth:1,borderColor:'#E1E7EF',backgroundColor:'rgba(255,255,255,.92)',borderRadius:14,padding:11},hostSelected:{borderColor:C.violet},
  hostDanger:{borderColor:'#F2C2CD',backgroundColor:'#FFF9FA'},hostDangerActive:{shadowColor:C.coral,shadowOpacity:.16,shadowRadius:14},
  hostTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},hostIcon:{width:28,height:28,borderRadius:9,alignItems:'center',justifyContent:'center'},
  focusTag:{color:'#D64E68',fontSize:6.5,fontWeight:'900',letterSpacing:.8},hostName:{color:C.text,fontSize:10.5,fontWeight:'900',marginTop:9},hostMeta:{color:C.muted,fontSize:8.5,marginTop:3},
  hostFooter:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:9},hostZone:{color:C.soft,fontSize:7.5,fontWeight:'800'},hostVlan:{fontSize:7.5,fontWeight:'900'},
  empty:{color:C.soft,fontSize:9,paddingVertical:12},
  incidentStrip:{marginTop:12,flexDirection:'row',gap:10,alignItems:'flex-start',borderWidth:1,borderColor:'#F2C4CE',backgroundColor:'#FFF5F7',borderRadius:14,padding:12},
  incidentIcon:{width:30,height:30,borderRadius:10,backgroundColor:C.coralSoft,alignItems:'center',justifyContent:'center'},incidentTitle:{color:'#B93853',fontSize:10.5,fontWeight:'900'},incidentText:{color:'#8B6871',fontSize:8.8,lineHeight:14,marginTop:3},
  inspector:{marginTop:12,flexDirection:'row',alignItems:'center',gap:10,borderWidth:1,borderColor:'#DFE5ED',backgroundColor:'#FFFFFF',borderRadius:14,padding:12},
  inspectorIcon:{width:32,height:32,borderRadius:10,alignItems:'center',justifyContent:'center'},inspectorName:{color:C.text,fontSize:10.5,fontWeight:'900'},inspectorMeta:{color:C.muted,fontSize:8.5,marginTop:3},inspectorRole:{color:C.soft,fontSize:7.5,fontWeight:'900'},
});
