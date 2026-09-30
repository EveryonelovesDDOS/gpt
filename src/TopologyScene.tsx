import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { NetworkTopology, TopologyNode } from './types';

type Props = {
  topology: NetworkTopology | null;
  incidentMode?: boolean;
  onSelect?: (node: TopologyNode | null) => void;
};

const iconFor = (node: TopologyNode) => node.role === 'edge-router' ? 'share-2' : node.kind === 'device' ? 'layers' : node.role === 'attacker' ? 'alert-triangle' : 'monitor';

export function TopologyScene({ topology, incidentMode = false, onSelect }: Props) {
  const [selected, setSelected] = useState<TopologyNode | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);

  const nodes = topology?.nodes || [];
  const devices = nodes.filter(n => n.kind === 'device');
  const hosts = nodes.filter(n => n.kind === 'host');
  const attacker = hosts.find(n => n.role === 'attacker');
  const core = devices.find(n => n.role === 'core-switch');
  const edge = devices.find(n => n.role === 'edge-router');
  const dataPackets = useMemo(() => [0, .33, .66], []);

  function choose(node: TopologyNode) {
    setSelected(node);
    onSelect?.(node);
  }

  return <View style={[s.wrap, incidentMode && s.wrapIncident]}>
    <View style={s.mapHeader}>
      <View>
        <Text style={s.kicker}>{incidentMode ? 'INCIDENT PATH MODE' : 'LIVE FABRIC MAP'}</Text>
        <Text style={s.title}>{incidentMode ? 'Threat path highlighted' : 'Interactive topology'}</Text>
      </View>
      <View style={[s.modePill, incidentMode && s.modePillDanger]}><View style={[s.modeDot, incidentMode && s.modeDotDanger]} /><Text style={[s.modeText, incidentMode && s.modeTextDanger]}>{incidentMode ? 'INCIDENT' : 'LIVE'}</Text></View>
    </View>

    <View style={s.canvas}>
      <View style={s.deviceRow}>
        {edge && <Node node={edge} active={selected?.id === edge.id} danger={false} onPress={() => choose(edge)} />}
        <View style={s.backbone}>
          <View style={[s.backboneLine, incidentMode && s.backboneLineDanger]} />
          {dataPackets.map((offset, i) => <Animated.View key={i} style={[s.packet, incidentMode && s.packetDanger, {
            transform: [{ translateX: pulse.interpolate({ inputRange:[0,1], outputRange:[-55 + offset * 110, 55 + offset * 110] }) }],
            opacity: pulse.interpolate({ inputRange:[0,.15,.85,1], outputRange:[0,1,1,0] })
          }]} />)}
          <Text style={s.backboneText}>10.0.0.0/30</Text>
        </View>
        {core && <Node node={core} active={selected?.id === core.id} danger={false} onPress={() => choose(core)} />}
      </View>

      <View style={[s.dropLine, incidentMode && attacker && s.dropLineDanger]} />
      <View style={s.hostRow}>
        {hosts.map(node => {
          const threat = node.role === 'attacker';
          return <View key={node.id} style={s.hostColumn}>
            <View style={[s.hostStem, incidentMode && threat && s.hostStemDanger]} />
            <Node node={node} compact active={selected?.id === node.id} danger={threat} incident={incidentMode && threat} onPress={() => choose(node)} />
          </View>;
        })}
      </View>
    </View>

    <View style={s.bottom}>
      <View style={s.legend}>
        <Legend label="Observed controller data" color="#72CCFF" />
        <Legend label="Known lab relation" color="#9A8BFF" />
        <Legend label="Incident focus" color="#FF6D7F" />
      </View>
      {selected && <View style={s.detail}>
        <View style={s.detailIcon}><Feather name={iconFor(selected) as any} size={17} color={selected.role === 'attacker' ? '#FF8997' : '#7CCEFF'} /></View>
        <View style={{ flex:1 }}>
          <Text style={s.detailName}>{selected.label}</Text>
          <Text style={s.detailMeta}>{selected.ip || 'No IP'} · {selected.zone}{selected.vlan ? ` · VLAN ${selected.vlan}` : ''}</Text>
        </View>
        <Text style={s.detailRole}>{selected.role.toUpperCase()}</Text>
      </View>}
    </View>
  </View>;
}

function Node({ node, compact = false, danger, incident, active, onPress }: { node: TopologyNode; compact?: boolean; danger?: boolean; incident?: boolean; active?: boolean; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = () => Animated.spring(scale, { toValue: 1.04, useNativeDriver: true }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  return <Pressable onPress={onPress} onPressIn={onIn} onPressOut={onOut}>
    <Animated.View style={[s.node, compact && s.nodeCompact, danger && s.nodeDanger, incident && s.nodeIncident, active && s.nodeActive, { transform:[{ scale }] }]}>
      <View style={[s.nodeIcon, danger && s.nodeIconDanger]}><Feather name={iconFor(node) as any} size={compact ? 16 : 20} color={danger ? '#FF8292' : '#76CBFF'} /></View>
      <Text style={s.nodeName} numberOfLines={1}>{node.label}</Text>
      <Text style={s.nodeMeta}>{node.ip || node.zone}</Text>
      {!!node.vlan && <Text style={[s.nodeBadge, danger && { color:'#FF9CAA' }]}>VLAN {node.vlan}</Text>}
      {incident && <View style={s.incidentTag}><Text style={s.incidentTagText}>FOCUS</Text></View>}
    </Animated.View>
  </Pressable>;
}

function Legend({ label, color }: { label:string; color:string }) {
  return <View style={s.legendItem}><View style={[s.legendDot,{backgroundColor:color}]} /><Text style={s.legendText}>{label}</Text></View>;
}

const s = StyleSheet.create({
  wrap:{ borderWidth:1,borderColor:'#29425C',backgroundColor:'#0B1623',borderRadius:22,padding:18,overflow:'hidden' },
  wrapIncident:{ borderColor:'#6B3340',backgroundColor:'#160F16' },
  mapHeader:{ flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:16 },
  kicker:{ color:'#6FBFFF',fontSize:8,fontWeight:'900',letterSpacing:1.7 }, title:{color:'#EEF6FF',fontSize:18,fontWeight:'900',marginTop:5},
  modePill:{ flexDirection:'row',alignItems:'center',gap:6,borderWidth:1,borderColor:'#285C56',borderRadius:20,paddingHorizontal:9,paddingVertical:5 },
  modePillDanger:{borderColor:'#6B3340'},modeDot:{width:6,height:6,borderRadius:6,backgroundColor:'#62D9BF'},modeDotDanger:{backgroundColor:'#FF6D7F'},
  modeText:{color:'#7CE7D1',fontSize:8,fontWeight:'900',letterSpacing:.7},modeTextDanger:{color:'#FF9CAA'},
  canvas:{ borderRadius:17,borderWidth:1,borderColor:'#20364D',backgroundColor:'#0A1320',padding:18,minHeight:310 },
  deviceRow:{flexDirection:'row',justifyContent:'center',alignItems:'center'},
  backbone:{width:180,height:42,justifyContent:'center',alignItems:'center',overflow:'hidden'},
  backboneLine:{position:'absolute',height:2,width:'100%',backgroundColor:'#365C7A'},backboneLineDanger:{backgroundColor:'#6A3342'},
  packet:{position:'absolute',width:9,height:9,borderRadius:9,backgroundColor:'#79D7FF',shadowColor:'#79D7FF',shadowOpacity:1,shadowRadius:8},
  packetDanger:{backgroundColor:'#FF6D7F',shadowColor:'#FF6D7F'},backboneText:{color:'#4F6A84',fontSize:7.5,marginTop:20},
  dropLine:{alignSelf:'center',height:38,width:2,backgroundColor:'#31516D'},dropLineDanger:{backgroundColor:'#6A3342'},
  hostRow:{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:10},
  hostColumn:{alignItems:'center'},hostStem:{width:2,height:18,backgroundColor:'#28455F'},hostStemDanger:{backgroundColor:'#7B3746'},
  node:{width:160,minHeight:118,borderWidth:1,borderColor:'#2A4965',backgroundColor:'#112238',borderRadius:16,padding:13,alignItems:'center',justifyContent:'center'},
  nodeCompact:{width:132,minHeight:105},nodeDanger:{borderColor:'#753642',backgroundColor:'#26141B'},nodeIncident:{shadowColor:'#FF6578',shadowOpacity:.35,shadowRadius:18},
  nodeActive:{borderColor:'#77D0FF'},nodeIcon:{width:38,height:38,borderRadius:12,backgroundColor:'#17324D',alignItems:'center',justifyContent:'center',marginBottom:8},
  nodeIconDanger:{backgroundColor:'#3A1820'},nodeName:{color:'#F1F6FD',fontSize:11,fontWeight:'900',maxWidth:120},nodeMeta:{color:'#718AA3',fontSize:8.5,marginTop:4},
  nodeBadge:{color:'#71C6FF',fontSize:7.5,fontWeight:'900',marginTop:6,letterSpacing:.5},
  incidentTag:{position:'absolute',right:8,top:8,borderRadius:8,backgroundColor:'#5C2733',paddingHorizontal:6,paddingVertical:3},incidentTagText:{color:'#FF9CAA',fontSize:6.5,fontWeight:'900'},
  bottom:{marginTop:14,gap:12},legend:{flexDirection:'row',flexWrap:'wrap',gap:14},legendItem:{flexDirection:'row',alignItems:'center',gap:6},legendDot:{width:6,height:6,borderRadius:6},legendText:{color:'#637B95',fontSize:8.5},
  detail:{flexDirection:'row',alignItems:'center',gap:10,borderWidth:1,borderColor:'#263D56',backgroundColor:'#0E1B2B',borderRadius:13,padding:12},
  detailIcon:{width:32,height:32,borderRadius:10,backgroundColor:'#162B42',alignItems:'center',justifyContent:'center'},detailName:{color:'#EAF4FF',fontSize:10.5,fontWeight:'900'},detailMeta:{color:'#71869D',fontSize:8.5,marginTop:3},detailRole:{color:'#5F7892',fontSize:7.5,fontWeight:'900'}
});
