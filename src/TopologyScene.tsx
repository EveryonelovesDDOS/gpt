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
  bg: '#111117',
  panel: '#17161F',
  line: '#3A3448',
  mint: '#6EF2C6',
  lilac: '#A78BFA',
  coral: '#FF6B8A',
  amber: '#FFCB7D',
  text: '#F6F3FB',
  muted: '#9B95A8',
};

const iconFor = (node: TopologyNode) =>
  node.role === 'edge-router' ? 'radio' :
  node.role === 'core-switch' ? 'cpu' :
  node.role === 'attacker' ? 'alert-triangle' : 'monitor';

export function TopologyScene({ topology, incidentMode = false, onSelect }: Props) {
  const [selected, setSelected] = useState<TopologyNode | null>(null);
  const flow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(flow, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [flow]);

  const nodes = topology?.nodes || [];
  const edge = nodes.find(n => n.role === 'edge-router');
  const core = nodes.find(n => n.role === 'core-switch');
  const hosts = nodes.filter(n => n.kind === 'host');

  const zones = useMemo(() => {
    const trusted = hosts.filter(n => ['ADMIN', 'FINANCE', 'STAFF'].includes(n.zone));
    const untrusted = hosts.filter(n => n.zone === 'GUEST' || n.role === 'attacker');
    const protectedHosts = hosts.filter(n => ['SERVER', 'PUBLIC', 'MANAGEMENT'].includes(n.zone));
    const assigned = new Set([...trusted, ...untrusted, ...protectedHosts].map(n => n.id));
    const other = hosts.filter(n => !assigned.has(n.id));
    return [
      { key: 'trusted', label: 'TRUSTED USERS', tone: C.mint, nodes: trusted },
      { key: 'untrusted', label: 'UNTRUSTED / GUEST', tone: C.coral, nodes: untrusted },
      { key: 'protected', label: 'PROTECTED SERVICES', tone: C.lilac, nodes: protectedHosts },
      ...(other.length ? [{ key: 'other', label: 'OTHER', tone: C.amber, nodes: other }] : []),
    ];
  }, [hosts]);

  const choose = (node: TopologyNode) => {
    setSelected(node);
    onSelect?.(node);
  };

  return <View style={[s.shell, incidentMode && s.shellIncident]}>
    <View style={s.header}>
      <View>
        <Text style={s.kicker}>{incidentMode ? 'INCIDENT TRACE' : 'LIVE FABRIC'}</Text>
        <Text style={s.title}>{incidentMode ? 'Guest-zone path under review' : 'Trust-zone topology'}</Text>
      </View>
      <View style={[s.liveChip, incidentMode && s.liveChipDanger]}>
        <View style={[s.liveDot, incidentMode && s.liveDotDanger]} />
        <Text style={[s.liveText, incidentMode && s.liveTextDanger]}>{incidentMode ? 'FOCUS' : 'STREAMING'}</Text>
      </View>
    </View>

    <View style={s.backboneCard}>
      <View style={s.backboneRow}>
        {edge && <Node node={edge} selected={selected?.id === edge.id} onPress={() => choose(edge)} />}
        <View style={s.flowRail}>
          <View style={s.flowBase} />
          {[0, .34, .68].map((offset, i) => <Animated.View key={i} style={[s.flowPulse, incidentMode && s.flowPulseDanger, {
            opacity: flow.interpolate({ inputRange:[0,.08,.9,1], outputRange:[0,1,1,0] }),
            transform:[{ translateX: flow.interpolate({ inputRange:[0,1], outputRange:[-72 + offset * 140, 72 + offset * 140] }) }],
          }]} />)}
          <Text style={s.flowLabel}>10.0.0.0/30</Text>
        </View>
        {core && <Node node={core} selected={selected?.id === core.id} onPress={() => choose(core)} />}
      </View>
    </View>

    <View style={s.zoneGrid}>
      {zones.map(zone => <View key={zone.key} style={[s.zoneCard, zone.key === 'untrusted' && incidentMode && s.zoneCardDanger]}>
        <View style={s.zoneHeader}>
          <View style={[s.zoneMark,{ backgroundColor: zone.tone }]} />
          <Text style={s.zoneLabel}>{zone.label}</Text>
          <Text style={s.zoneCount}>{zone.nodes.length}</Text>
        </View>
        <View style={s.zoneNodes}>
          {zone.nodes.length ? zone.nodes.map(node => <Pressable key={node.id} onPress={() => choose(node)} style={[
            s.host,
            selected?.id === node.id && s.hostSelected,
            node.role === 'attacker' && s.hostDanger,
            incidentMode && node.role === 'attacker' && s.hostDangerActive,
          ]}>
            <View style={s.hostTop}>
              <View style={[s.hostIcon,{ backgroundColor: node.role === 'attacker' ? '#3B1722' : '#20252B' }]}>
                <Feather name={iconFor(node) as any} size={15} color={node.role === 'attacker' ? C.coral : zone.tone} />
              </View>
              {incidentMode && node.role === 'attacker' && <Text style={s.focusTag}>SOURCE</Text>}
            </View>
            <Text style={s.hostName}>{node.label}</Text>
            <Text style={s.hostMeta}>{node.ip || 'No IP'}</Text>
            <View style={s.hostFooter}>
              <Text style={s.hostZone}>{node.zone}</Text>
              {!!node.vlan && <Text style={s.hostVlan}>VLAN {node.vlan}</Text>}
            </View>
          </Pressable>) : <Text style={s.empty}>No discovered hosts</Text>}
        </View>
      </View>)}
    </View>

    {incidentMode && <View style={s.incidentStrip}>
      <Feather name="zap" size={16} color={C.coral} />
      <View style={{flex:1}}>
        <Text style={s.incidentTitle}>Simulation trace enabled</Text>
        <Text style={s.incidentText}>ATTACKER-PC is a lab marker. NEXUS highlights the guest-zone path for investigation without treating the label as proof of compromise.</Text>
      </View>
    </View>}

    {selected && <View style={s.inspector}>
      <View style={[s.inspectorIcon,{ backgroundColor:selected.role === 'attacker' ? '#3B1722' : '#20272D' }]}>
        <Feather name={iconFor(selected) as any} size={17} color={selected.role === 'attacker' ? C.coral : C.mint} />
      </View>
      <View style={{flex:1}}>
        <Text style={s.inspectorName}>{selected.label}</Text>
        <Text style={s.inspectorMeta}>{selected.ip || 'No IP'} · {selected.zone}{selected.vlan ? ` · VLAN ${selected.vlan}` : ''}</Text>
      </View>
      <Text style={s.inspectorRole}>{selected.role.toUpperCase()}</Text>
    </View>}
  </View>;
}

function Node({ node, selected, onPress }: { node: TopologyNode; selected:boolean; onPress:()=>void }) {
  const scale = useRef(new Animated.Value(1)).current;
  return <Pressable onPress={onPress}
    onPressIn={() => Animated.spring(scale,{toValue:1.04,useNativeDriver:true}).start()}
    onPressOut={() => Animated.spring(scale,{toValue:1,useNativeDriver:true}).start()}>
    <Animated.View style={[s.device, selected && s.deviceSelected,{transform:[{scale}]}]}>
      <View style={s.deviceIcon}><Feather name={iconFor(node) as any} size={19} color={node.role === 'edge-router' ? C.lilac : C.mint} /></View>
      <View>
        <Text style={s.deviceName}>{node.label}</Text>
        <Text style={s.deviceIp}>{node.ip || node.zone}</Text>
      </View>
    </Animated.View>
  </Pressable>;
}

const s = StyleSheet.create({
  shell:{ backgroundColor:C.panel,borderWidth:1,borderColor:'#2E2937',borderRadius:26,padding:18,overflow:'hidden' },
  shellIncident:{ borderColor:'#5E2D3C',backgroundColor:'#19131A' },
  header:{ flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:14,marginBottom:16 },
  kicker:{ color:C.mint,fontSize:8,fontWeight:'900',letterSpacing:1.7 },
  title:{ color:C.text,fontSize:20,fontWeight:'900',marginTop:5 },
  liveChip:{ flexDirection:'row',alignItems:'center',gap:7,borderWidth:1,borderColor:'#2D6656',borderRadius:20,paddingHorizontal:10,paddingVertical:6 },
  liveChipDanger:{ borderColor:'#6B3444' }, liveDot:{width:6,height:6,borderRadius:6,backgroundColor:C.mint},liveDotDanger:{backgroundColor:C.coral},
  liveText:{color:'#A6F6DC',fontSize:8,fontWeight:'900',letterSpacing:.8},liveTextDanger:{color:'#FFA2B5'},
  backboneCard:{ backgroundColor:'#0F0F14',borderRadius:20,borderWidth:1,borderColor:'#2D2836',padding:16 },
  backboneRow:{ flexDirection:'row',justifyContent:'center',alignItems:'center',gap:12 },
  device:{ minWidth:180,flexDirection:'row',alignItems:'center',gap:11,borderWidth:1,borderColor:'#393244',backgroundColor:'#191820',borderRadius:16,padding:14 },
  deviceSelected:{ borderColor:C.lilac },
  deviceIcon:{ width:38,height:38,borderRadius:12,backgroundColor:'#22212B',alignItems:'center',justifyContent:'center' },
  deviceName:{ color:C.text,fontSize:11,fontWeight:'900' },deviceIp:{color:C.muted,fontSize:8.5,marginTop:3},
  flowRail:{ width:210,height:52,alignItems:'center',justifyContent:'center',overflow:'hidden' },flowBase:{position:'absolute',height:2,width:'100%',backgroundColor:'#484150'},
  flowPulse:{position:'absolute',width:12,height:12,borderRadius:12,backgroundColor:C.mint,shadowColor:C.mint,shadowOpacity:1,shadowRadius:10},
  flowPulseDanger:{backgroundColor:C.coral,shadowColor:C.coral},flowLabel:{color:'#716B78',fontSize:8,marginTop:24},
  zoneGrid:{ flexDirection:'row',flexWrap:'wrap',gap:12,marginTop:12 },
  zoneCard:{ flexGrow:1,flexBasis:240,minWidth:220,backgroundColor:'#111116',borderWidth:1,borderColor:'#2C2733',borderRadius:18,padding:14 },
  zoneCardDanger:{ borderColor:'#6A3444',backgroundColor:'#1D1318' },
  zoneHeader:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:12},zoneMark:{width:8,height:8,borderRadius:8},zoneLabel:{flex:1,color:'#BDB6C8',fontSize:8,fontWeight:'900',letterSpacing:1.2},zoneCount:{color:'#6E6877',fontSize:8,fontWeight:'900'},
  zoneNodes:{gap:8},host:{borderWidth:1,borderColor:'#2E2A35',backgroundColor:'#18171D',borderRadius:14,padding:11},hostSelected:{borderColor:C.lilac},
  hostDanger:{borderColor:'#603041',backgroundColor:'#21151B'},hostDangerActive:{shadowColor:C.coral,shadowOpacity:.28,shadowRadius:16},
  hostTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},hostIcon:{width:28,height:28,borderRadius:9,alignItems:'center',justifyContent:'center'},
  focusTag:{color:'#FF9BAE',fontSize:6.5,fontWeight:'900',letterSpacing:.8},hostName:{color:C.text,fontSize:10.5,fontWeight:'900',marginTop:9},hostMeta:{color:C.muted,fontSize:8.5,marginTop:3},
  hostFooter:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:9},hostZone:{color:'#827B8C',fontSize:7.5,fontWeight:'800'},hostVlan:{color:C.mint,fontSize:7.5,fontWeight:'900'},
  empty:{color:'#665F6F',fontSize:9,paddingVertical:12},
  incidentStrip:{marginTop:12,flexDirection:'row',gap:10,alignItems:'flex-start',borderWidth:1,borderColor:'#603140',backgroundColor:'#24151B',borderRadius:14,padding:12},
  incidentTitle:{color:'#FFD7DF',fontSize:10.5,fontWeight:'900'},incidentText:{color:'#B88E98',fontSize:8.8,lineHeight:14,marginTop:3},
  inspector:{marginTop:12,flexDirection:'row',alignItems:'center',gap:10,borderWidth:1,borderColor:'#35303E',backgroundColor:'#121217',borderRadius:14,padding:12},
  inspectorIcon:{width:32,height:32,borderRadius:10,alignItems:'center',justifyContent:'center'},inspectorName:{color:C.text,fontSize:10.5,fontWeight:'900'},inspectorMeta:{color:C.muted,fontSize:8.5,marginTop:3},inspectorRole:{color:'#777080',fontSize:7.5,fontWeight:'900'},
});
