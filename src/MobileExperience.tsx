import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ContinuousDataFlow, PulseHalo, Reveal } from './AuroraMotion';
import type { AgentRun, DefensiveAction, Health, IncidentCase, IncidentTimeline, NetworkHealth, NetworkTopology, SecurityAnalysis, TelemetryChange } from './types';

export type MobilePage = 'home' | 'dashboard' | 'topology' | 'security' | 'agent' | 'settings';

type Props = {
  page: MobilePage;
  setPage: (page: MobilePage) => void;
  live: boolean;
  network: NetworkHealth;
  topology: NetworkTopology | null;
  security: SecurityAnalysis | null;
  incidents: IncidentTimeline | null;
  serverHealth: Health | null;
  actions: DefensiveAction[];
  incidentCases: IncidentCase[];
  changes: TelemetryChange[];
  incidentMode: boolean;
  setIncidentMode: (value: boolean) => void;
  busy: boolean;
  prompt: string;
  setPrompt: (value: string) => void;
  run: AgentRun | null;
  editEndpoint: string;
  setEditEndpoint: (value: string) => void;
  editPair: string;
  setEditPair: (value: string) => void;
  onConnect: () => void;
  onRefresh: () => void;
  onSubmit: () => void;
  onCreatePlan: (kind: string, incidentCaseId?: string) => void;
  onDecidePlan: (id: string, approved: boolean) => void;
  onOpenIncident: (alertId: string) => void;
  onCloseIncident: (caseId: string) => void;
  notice: string;
  clearNotice: () => void;
};

type IconName = keyof typeof Feather.glyphMap;

const C = {
  bg:'#F4F7FB',
  card:'#FFFFFF',
  ink:'#101828',
  text:'#344054',
  muted:'#667085',
  faint:'#98A2B3',
  line:'#E4EAF2',
  mint:'#18B88F',
  mintSoft:'#E8F8F3',
  violet:'#6857F5',
  violetSoft:'#EEEBFF',
  blue:'#3B82F6',
  blueSoft:'#EAF3FF',
  coral:'#F04F6D',
  coralSoft:'#FFF0F3',
  amber:'#E59A2F',
  amberSoft:'#FFF7E8',
};

function Icon({name,size=18,color=C.ink}:{name:IconName;size?:number;color?:string}) {
  return <Feather name={name} size={size} color={color}/>;
}

function cleanMarkup(text:string) {
  return String(text || '')
    .replace(/^#{1,6}\\s*/gm,'')
    .replace(/\\*\\*(.*?)\\*\\*/g,'$1')
    .replace(/__(.*?)__/g,'$1')
    .replace(/`([^`]+)`/g,'$1')
    .trim();
}

function operatorSections(text:string) {
  const labels=['OBSERVED','INFERRED','RISK','NEXT CHECKS','CONFIDENCE'];
  const sections:{label:string;body:string}[]=[];
  let current={label:'NEXUS RESPONSE',body:''};
  for(const raw of String(text||'').split('\\n')){
    const candidate=raw.trim().toUpperCase().replace(/[:#*]/g,'').trim();
    const label=labels.find(x=>x===candidate);
    if(label){
      if(current.body.trim()) sections.push({...current,body:cleanMarkup(current.body)});
      current={label,body:''};
    } else current.body += (current.body?'\\n':'') + raw;
  }
  if(current.body.trim()) sections.push({...current,body:cleanMarkup(current.body)});
  return sections;
}

function changeColor(severity:string) {
  return severity==='critical'||severity==='high'?C.coral:severity==='medium'||severity==='warning'?C.amber:C.mint;
}

function ChangeCard({change}:{change:TelemetryChange}) {
  const color=changeColor(change.severity);
  return <View style={s.changeCard}>
    <View style={[s.changeIcon,{backgroundColor:color+'16'}]}><Icon name={change.type.includes('resolved')?'check-circle':change.type.includes('host')?'monitor':'activity'} size={16} color={color}/></View>
    <View style={{flex:1}}>
      <View style={s.changeHead}><Text style={s.changeTitle}>{change.title}</Text><Text style={s.changeTime}>{new Date(change.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</Text></View>
      <Text style={s.changeDetail}>{change.detail}</Text>
    </View>
  </View>;
}

function SoftButton({icon,label,onPress,tone='dark'}:{icon:IconName;label:string;onPress:()=>void;tone?:'dark'|'mint'|'light'}) {
  const bg = tone==='dark' ? C.ink : tone==='mint' ? C.mint : '#FFFFFF';
  const fg = tone==='light' ? C.ink : '#FFFFFF';
  return <Pressable onPress={onPress} style={({pressed})=>[s.softButton,{backgroundColor:bg},pressed&&{transform:[{scale:.98}],opacity:.92}]}>
    <Icon name={icon} size={15} color={fg}/><Text style={[s.softButtonText,{color:fg}]}>{label}</Text>
  </Pressable>;
}

function StatCard({icon,value,label,tone}:{icon:IconName;value:string|number;label:string;tone:'mint'|'violet'|'blue'|'coral'}) {
  const color=tone==='mint'?C.mint:tone==='violet'?C.violet:tone==='blue'?C.blue:C.coral;
  const bg=tone==='mint'?C.mintSoft:tone==='violet'?C.violetSoft:tone==='blue'?C.blueSoft:C.coralSoft;
  return <View style={s.statCard}>
    <View style={[s.statIcon,{backgroundColor:bg}]}><Icon name={icon} size={16} color={color}/></View>
    <Text style={s.statValue}>{value}</Text>
    <Text style={s.statLabel}>{label}</Text>
  </View>;
}

function MobileHeader({live,onConnect}:{live:boolean;onConnect:()=>void}) {
  return <View style={s.header}>
    <View style={s.brandRow}>
      <LinearGradient colors={[C.mint,C.violet]} start={{x:0,y:0}} end={{x:1,y:1}} style={s.logo}><Text style={s.logoText}>N</Text></LinearGradient>
      <View><Text style={s.brand}>NEXUS</Text><Text style={s.brandSub}>NETWORK COMMAND</Text></View>
    </View>
    <View style={s.headerActions}>
      <View style={[s.livePill,{backgroundColor:live?C.mintSoft:'#F2F4F7'}]}>
        {live?<PulseHalo color={C.mint}/>:<View style={s.offlineDot}/>}
        <Text style={[s.livePillText,{color:live?'#117B61':C.muted}]}>{live?'LIVE':'PREVIEW'}</Text>
      </View>
      <Pressable onPress={onConnect} style={s.roundButton}><Icon name="link-2" size={17} color={C.ink}/></Pressable>
    </View>
  </View>;
}

function SectionHead({eyebrow,title,action}:{eyebrow:string;title:string;action?:React.ReactNode}) {
  return <View style={s.sectionHead}><View style={{flex:1}}><Text style={s.eyebrow}>{eyebrow}</Text><Text style={s.sectionTitle}>{title}</Text></View>{action}</View>;
}

function Home({live,network,topology,security,changes,setPage}:{live:boolean;network:NetworkHealth;topology:NetworkTopology|null;security:SecurityAnalysis|null;changes:TelemetryChange[];setPage:(p:MobilePage)=>void}) {
  const hosts=topology?.nodes.filter(n=>n.kind==='host')||[];
  const alertCount=security?.alertCount||0;
  const score=Math.max(24,Math.min(100,Math.round((network.reachableCount/Math.max(network.deviceCount,1))*76 + (alertCount?8:24))));
  const topAlert=security?.alerts?.[0];
  const latestChange=changes.find(item=>item.type!=='baseline')||changes[0];

  return <View style={s.page}>
    <Reveal>
      <LinearGradient colors={['#111A2D','#1D2B4F','#332B72']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.hero}>
        <View style={s.heroGlowA}/><View style={s.heroGlowB}/>
        <View style={s.heroTop}><Text style={s.heroKicker}>GOOD {new Date().getHours()<12?'MORNING':new Date().getHours()<18?'AFTERNOON':'EVENING'}</Text><View style={s.heroBadge}><Text style={s.heroBadgeText}>{live?'SYNCED':'DEMO'}</Text></View></View>
        <Text style={s.heroTitle}>Your network,{"\n"}in one glance.</Text>
        <Text style={s.heroCopy}>Live topology, security posture and AI investigation — without the clutter.</Text>
        <View style={s.heroActions}><SoftButton icon="command" label="Ask NEXUS" onPress={()=>setPage('agent')} tone="mint"/><SoftButton icon="share-2" label="Open fabric" onPress={()=>setPage('topology')} tone="light"/></View>
        <View style={s.heroPulseRow}>
          <View style={s.scoreRing}><Text style={s.scoreValue}>{score}</Text><Text style={s.scoreLabel}>HEALTH</Text></View>
          <View style={{flex:1}}><Text style={s.heroPulseTitle}>{network.allReachable?'Fabric is stable':'Attention needed'}</Text><Text style={s.heroPulseSub}>{network.reachableCount}/{network.deviceCount} infrastructure devices reachable · {alertCount} active signal{alertCount===1?'':'s'}</Text></View>
        </View>
      </LinearGradient>
    </Reveal>

    <Reveal delay={80}>
      <View style={s.statGrid}>
        <StatCard icon="server" value={network.deviceCount} label="Devices" tone="blue"/>
        <StatCard icon="monitor" value={hosts.length} label="Endpoints" tone="violet"/>
        <StatCard icon="check-circle" value={network.reachableCount} label="Reachable" tone="mint"/>
        <StatCard icon="shield" value={alertCount} label="Alerts" tone="coral"/>
      </View>
    </Reveal>

    <Reveal delay={140}>
      <View style={s.flowCompact}><ContinuousDataFlow label="PACKET FLOW" sublabel="controller → fabric → endpoints"/></View>
    </Reveal>
    <Reveal delay={170}>
      <SectionHead eyebrow="LIVE CHANGE" title="What just changed"/>
      {latestChange ? <ChangeCard change={latestChange}/> : <View style={s.clearCard}><View style={s.clearIcon}><Icon name="activity" size={17} color={C.mint}/></View><View><Text style={s.clearTitle}>Baseline is quiet</Text><Text style={s.clearText}>NEXUS will surface device, host, segment and alert changes here.</Text></View></View>}
    </Reveal>

    <Reveal delay={200}>
      <SectionHead eyebrow="PRIORITY" title="What needs attention" action={<Pressable onPress={()=>setPage('security')}><Text style={s.textAction}>View all</Text></Pressable>}/>
      {topAlert ? <Pressable onPress={()=>setPage('security')} style={s.priorityCard}>
        <View style={s.priorityIcon}><Icon name={topAlert.severity==='critical'?'alert-octagon':'alert-triangle'} size={18} color={C.coral}/></View>
        <View style={{flex:1}}><View style={s.priorityTop}><Text style={s.priorityTitle}>{topAlert.title}</Text><Text style={s.prioritySeverity}>{topAlert.severity.toUpperCase()}</Text></View><Text style={s.priorityText} numberOfLines={2}>{topAlert.detail}</Text></View>
        <Icon name="chevron-right" size={18} color={C.faint}/>
      </Pressable> : <View style={s.clearCard}><View style={s.clearIcon}><Icon name="check" size={17} color={C.mint}/></View><View><Text style={s.clearTitle}>Nothing urgent</Text><Text style={s.clearText}>Current NEXUS heuristics are quiet.</Text></View></View>}
    </Reveal>

    <Reveal delay={260}>
      <SectionHead eyebrow="SHORTCUTS" title="Jump back in"/>
      <View style={s.actionGrid}>
        {[
          ['grid','Overview','Health & inventory','dashboard',C.blue,C.blueSoft],
          ['share-2','Fabric','Trust zones','topology',C.mint,C.mintSoft],
          ['shield','Defend','Incidents & plans','security',C.coral,C.coralSoft],
          ['command','NEXUS AI','Ask the network','agent',C.violet,C.violetSoft],
        ].map(([icon,title,sub,target,color,bg])=><Pressable key={String(title)} onPress={()=>setPage(target as MobilePage)} style={({pressed})=>[s.actionCard,pressed&&{transform:[{scale:.98}]}]}>
          <View style={[s.actionIcon,{backgroundColor:String(bg)}]}><Icon name={icon as IconName} size={18} color={String(color)}/></View>
          <Text style={s.actionTitle}>{title}</Text><Text style={s.actionSub}>{sub}</Text>
          <View style={s.actionArrow}><Icon name="arrow-up-right" size={14} color={String(color)}/></View>
        </Pressable>)}
      </View>
    </Reveal>
  </View>;
}

function Overview({network,topology,security,changes}:{network:NetworkHealth;topology:NetworkTopology|null;security:SecurityAnalysis|null;changes:TelemetryChange[]}) {
  const hosts=topology?.nodes.filter(n=>n.kind==='host')||[];
  const zones=useMemo(()=>[
    {label:'Trusted',count:hosts.filter(n=>['ADMIN','FINANCE','STAFF'].includes(n.zone)).length,color:C.mint},
    {label:'Guest',count:hosts.filter(n=>n.zone==='GUEST').length,color:C.coral},
    {label:'Services',count:hosts.filter(n=>['SERVER','PUBLIC','MANAGEMENT'].includes(n.zone)).length,color:C.violet},
  ],[hosts]);

  return <View style={s.page}>
    <SectionHead eyebrow="OVERVIEW" title="Network health"/>
    <LinearGradient colors={['#FFFFFF','#F7FAFF']} style={s.healthCard}>
      <View><Text style={s.healthBig}>{network.reachableCount}/{network.deviceCount}</Text><Text style={s.healthLabel}>Infrastructure reachable</Text></View>
      <View style={[s.healthBadge,{backgroundColor:network.allReachable?C.mintSoft:C.amberSoft}]}><Icon name={network.allReachable?'check-circle':'alert-circle'} size={16} color={network.allReachable?C.mint:C.amber}/><Text style={[s.healthBadgeText,{color:network.allReachable?'#117B61':'#A66C17'}]}>{network.allReachable?'HEALTHY':'REVIEW'}</Text></View>
      <View style={s.progressTrack}><View style={[s.progressFill,{width:(Math.min(100,(network.reachableCount/Math.max(network.deviceCount,1))*100)+'%') as any}]}/></View>
    </LinearGradient>

    <View style={s.statGrid}>
      <StatCard icon="monitor" value={hosts.length} label="Observed hosts" tone="violet"/>
      <StatCard icon="shield" value={security?.alertCount||0} label="Active alerts" tone="coral"/>
      <StatCard icon="alert-octagon" value={security?.criticalCount||0} label="Critical" tone="coral"/>
      <StatCard icon="wifi" value={network.controllerOnline?'On':'Off'} label="Controller" tone="mint"/>
    </View>

    <SectionHead eyebrow="LIVE TELEMETRY" title="Recent changes"/>
    <View style={s.changeList}>
      {changes.length ? changes.slice(0,4).map(change=><ChangeCard key={change.id} change={change}/>) : <View style={s.emptyState}><Icon name="activity" size={24} color={C.mint}/><Text style={s.emptyTitle}>No change events yet</Text><Text style={s.emptyText}>Once the live baseline moves, NEXUS will record it here.</Text></View>}
    </View>

    <SectionHead eyebrow="SEGMENTATION" title="Trust zones"/>
    <View style={s.card}>
      {zones.map(z=><View key={z.label} style={s.zoneRow}><View style={s.zoneRowHead}><View style={[s.zoneDot,{backgroundColor:z.color}]}/><Text style={s.zoneName}>{z.label}</Text><Text style={s.zoneCount}>{z.count}</Text></View><View style={s.zoneTrack}><View style={[s.zoneFill,{backgroundColor:z.color,width:(Math.max(8,z.count/Math.max(hosts.length,1)*100)+'%') as any}]}/></View></View>)}
    </View>

    <SectionHead eyebrow="INFRASTRUCTURE" title="Discovered devices"/>
    <View style={s.card}>
      {network.devices.map((d,i)=><View key={d.id} style={[s.deviceRow,i<network.devices.length-1&&s.rowDivider]}>
        <View style={[s.deviceIcon,{backgroundColor:d.role==='core-switch'?C.mintSoft:C.violetSoft}]}><Icon name={d.role==='core-switch'?'cpu':'radio'} size={17} color={d.role==='core-switch'?C.mint:C.violet}/></View>
        <View style={{flex:1}}><Text style={s.deviceName}>{d.name}</Text><Text style={s.deviceMeta}>{d.managementIp} · {d.interfaces} interfaces</Text></View>
        <View style={[s.statusDot,{backgroundColor:d.status==='online'?C.mint:C.coral}]}/>
      </View>)}
    </View>
  </View>;
}

function Fabric({topology,incidentMode,setIncidentMode}:{topology:NetworkTopology|null;incidentMode:boolean;setIncidentMode:(v:boolean)=>void}) {
  const nodes=topology?.nodes||[];
  const edge=nodes.find(n=>n.role==='edge-router');
  const core=nodes.find(n=>n.role==='core-switch');
  const hosts=nodes.filter(n=>n.kind==='host');
  const flow=useRef(new Animated.Value(0)).current;
  useEffect(()=>{ const loop=Animated.loop(Animated.timing(flow,{toValue:1,duration:2200,easing:Easing.linear,useNativeDriver:true}));loop.start();return()=>loop.stop();},[flow]);

  return <View style={s.page}>
    <SectionHead eyebrow="FABRIC" title="Live network map" action={<Pressable onPress={()=>setIncidentMode(!incidentMode)} style={[s.modeButton,incidentMode&&s.modeButtonActive]}><Icon name="zap" size={13} color={incidentMode?C.coral:C.text}/><Text style={[s.modeText,incidentMode&&{color:C.coral}]}>{incidentMode?'Incident on':'Trace'}</Text></Pressable>}/>
    <View style={[s.fabricCard,incidentMode&&{borderColor:'#F4C3CE'}]}>
      <View style={s.fabricNode}><View style={[s.fabricNodeIcon,{backgroundColor:C.violetSoft}]}><Icon name="radio" size={19} color={C.violet}/></View><Text style={s.fabricNodeName}>{edge?.label||'EDGE-RTR'}</Text><Text style={s.fabricNodeIp}>{edge?.ip||'10.0.0.1'}</Text></View>
      <View style={s.verticalPath}><View style={s.verticalLine}/>{[0,.32,.64].map((offset,i)=><Animated.View key={i} style={[s.packet,{backgroundColor:incidentMode?C.coral:[C.mint,C.violet,C.blue][i]},{
        opacity:flow.interpolate({inputRange:[0,.08,.92,1],outputRange:[0,1,1,0]}),
        transform:[{translateY:flow.interpolate({inputRange:[0,1],outputRange:[-6+offset*64,64+offset*64]})}]
      }]}/>)}</View>
      <View style={s.fabricNode}><View style={[s.fabricNodeIcon,{backgroundColor:C.mintSoft}]}><Icon name="cpu" size={19} color={C.mint}/></View><Text style={s.fabricNodeName}>{core?.label||'CORE-SW'}</Text><Text style={s.fabricNodeIp}>{core?.ip||'10.0.0.2'}</Text></View>
    </View>

    <Text style={s.microLabel}>ENDPOINTS BY TRUST ZONE</Text>
    <View style={s.hostList}>
      {hosts.map(h=>{
        const danger=h.role==='attacker'||h.zone==='GUEST';
        const service=['SERVER','PUBLIC','MANAGEMENT'].includes(h.zone);
        const color=danger?C.coral:service?C.violet:C.mint;
        const bg=danger?C.coralSoft:service?C.violetSoft:C.mintSoft;
        return <View key={h.id} style={[s.hostRow,danger&&incidentMode&&{borderColor:'#F2B8C5',backgroundColor:'#FFF8FA'}]}>
          <View style={[s.hostIcon,{backgroundColor:bg}]}><Icon name={danger?'alert-triangle':'monitor'} size={16} color={color}/></View>
          <View style={{flex:1}}><Text style={s.hostName}>{h.label}</Text><Text style={s.hostMeta}>{h.ip} · {h.zone}</Text></View>
          {!!h.vlan&&<View style={[s.vlanPill,{backgroundColor:bg}]}><Text style={[s.vlanText,{color}]}>VLAN {h.vlan}</Text></View>}
        </View>;
      })}
    </View>
  </View>;
}

function IncidentWorkspace({incidentCase,onCreatePlan,onClose}:{incidentCase:IncidentCase;onCreatePlan:(kind:string,caseId?:string)=>void;onClose:(caseId:string)=>void}) {
  return <View style={s.incidentWorkspace}>
    <View style={s.caseHead}>
      <View style={{flex:1}}>
        <Text style={s.caseKicker}>ACTIVE INCIDENT · {incidentCase.severity.toUpperCase()}</Text>
        <Text style={s.caseTitle}>{incidentCase.title}</Text>
      </View>
      <View style={s.caseLive}><View style={s.caseLiveDot}/><Text style={s.caseLiveText}>{incidentCase.status.toUpperCase()}</Text></View>
    </View>
    <Text style={s.caseAssessment}>{incidentCase.assessment}</Text>

    <Text style={s.microLabel}>EVIDENCE</Text>
    <View style={s.evidenceList}>
      {incidentCase.evidence.map((item,i)=><View key={item.label+i} style={s.evidenceRow}>
        <View style={s.evidenceRail}>
          <View style={[s.evidenceDot,{backgroundColor:item.certainty==='observed'?C.mint:item.certainty==='heuristic'?C.violet:C.faint}]}/>
          {i<incidentCase.evidence.length-1&&<View style={s.evidenceStem}/>}
        </View>
        <View style={{flex:1}}>
          <Text style={s.evidenceLabel}>{item.label}</Text>
          <Text style={s.evidenceValue}>{item.value}</Text>
          <Text style={s.evidenceSource}>{item.source} · {item.certainty}</Text>
        </View>
      </View>)}
    </View>

    <Text style={s.microLabel}>VERIFICATION PATH</Text>
    <View style={s.pathRow}>
      {incidentCase.path.map((step,i)=><React.Fragment key={step.label+i}>
        <View style={s.pathNode}>
          <View style={[s.pathIcon,{backgroundColor:step.kind==='source'?C.coralSoft:step.kind==='fabric'?C.mintSoft:C.violetSoft}]}>
            <Icon name={step.kind==='source'?'alert-triangle':step.kind==='fabric'?'cpu':'shield'} size={14} color={step.kind==='source'?C.coral:step.kind==='fabric'?C.mint:C.violet}/>
          </View>
          <Text style={s.pathLabel}>{step.label}</Text>
          <Text style={s.pathCert}>{step.certainty}</Text>
        </View>
        {i<incidentCase.path.length-1&&<Icon name="arrow-right" size={13} color={C.faint}/>}
      </React.Fragment>)}
    </View>

    <Text style={s.microLabel}>SAFE NEXT ACTIONS</Text>
    <View style={s.recommendations}>
      {incidentCase.recommendations.map(rec=><Pressable key={rec.kind} onPress={()=>onCreatePlan(rec.kind,incidentCase.id)} style={s.recommendation}>
        <View style={s.recommendNumber}><Text style={s.recommendNumberText}>{rec.priority}</Text></View>
        <Text style={s.recommendText}>{rec.label}</Text>
        <Icon name="arrow-up-right" size={14} color={C.violet}/>
      </Pressable>)}
    </View>

    {incidentCase.status!=='closed'&&<Pressable onPress={()=>onClose(incidentCase.id)} style={s.closeCaseButton}>
      <Icon name="check-circle" size={15} color={C.mint}/><Text style={s.closeCaseText}>Close investigation</Text>
    </Pressable>}
  </View>;
}

function Defend({security,incidentCases,actions,onCreatePlan,onDecidePlan,onOpenIncident,onCloseIncident}:{security:SecurityAnalysis|null;incidentCases:IncidentCase[];actions:DefensiveAction[];onCreatePlan:(kind:string,caseId?:string)=>void;onDecidePlan:(id:string,approved:boolean)=>void;onOpenIncident:(alertId:string)=>void;onCloseIncident:(caseId:string)=>void}) {
  const posture=security?.posture||'normal';
  const color=posture==='critical'?C.coral:posture==='warning'?C.amber:C.mint;
  const activeCase=incidentCases.find(item=>item.status!=='closed')||incidentCases[0];

  return <View style={s.page}>
    <SectionHead eyebrow="DEFEND" title="Security posture"/>
    <LinearGradient colors={posture==='critical'?['#3A1720','#6C2638']:posture==='warning'?['#2E2414','#5E4720']:['#0F3329','#16644E']} style={s.postureCard}>
      <Text style={s.postureKicker}>CURRENT POSTURE</Text>
      <Text style={s.postureTitle}>{posture.toUpperCase()}</Text>
      <Text style={s.postureCopy}>{security?.alertCount||0} active alerts · {security?.criticalCount||0} critical · {security?.hostCount||0} observed hosts</Text>
      <View style={[s.postureDot,{backgroundColor:color}]}/>
    </LinearGradient>

    {activeCase&&<>
      <SectionHead eyebrow="INCIDENT WORKSPACE" title={activeCase.status==='closed'?'Latest investigation':'Investigation in progress'}/>
      <IncidentWorkspace incidentCase={activeCase} onCreatePlan={onCreatePlan} onClose={onCloseIncident}/>
    </>}

    <SectionHead eyebrow="DETECTION FEED" title="Active signals"/>
    <View style={s.card}>
      {(security?.alerts||[]).length ? security!.alerts.map((a,i)=><View key={a.id} style={[s.alertRow,i<(security?.alerts.length||0)-1&&s.rowDivider]}>
        <View style={[s.alertIcon,{backgroundColor:a.severity==='critical'?C.coralSoft:C.amberSoft}]}>
          <Icon name={a.severity==='critical'?'alert-octagon':'alert-triangle'} size={17} color={a.severity==='critical'?C.coral:C.amber}/>
        </View>
        <View style={{flex:1}}>
          <View style={s.alertTitleRow}><Text style={s.alertTitle}>{a.title}</Text><Text style={[s.alertSeverity,{color:a.severity==='critical'?C.coral:C.amber}]}>{a.severity.toUpperCase()}</Text></View>
          <Text style={s.alertDetail}>{a.detail}</Text>
          <Pressable onPress={()=>onOpenIncident(a.id)} style={s.investigateButton}>
            <Icon name="search" size={13} color={C.violet}/><Text style={s.investigateText}>Investigate with NEXUS</Text>
          </Pressable>
        </View>
      </View>) : <View style={s.emptyState}><Icon name="shield" size={26} color={C.mint}/><Text style={s.emptyTitle}>Detection feed is quiet</Text><Text style={s.emptyText}>No active NEXUS heuristic matched.</Text></View>}
    </View>

    <SectionHead eyebrow="RESPONSE PLANS" title="Human-approved actions"/>
    {actions.length ? <View style={s.planList}>
      {actions.slice(0,3).map(a=><View key={a.id} style={s.planCard}>
        <View style={s.planTop}><View style={{flex:1}}><Text style={s.planKicker}>{a.risk.toUpperCase()} RISK · PREVIEW ONLY</Text><Text style={s.planTitle}>{a.title}</Text></View><Text style={s.planStatus}>{a.status.toUpperCase()}</Text></View>
        <Text style={s.planSummary}>{a.summary}</Text>
        <View style={s.codePreview}>{a.commands.slice(0,3).map((line,i)=><Text key={i} style={s.codeLine}>{line}</Text>)}</View>
        <Text style={s.rollbackLabel}>ROLLBACK READY · {a.rollback.length} command(s)</Text>
        {a.status==='pending'&&<View style={s.planActions}><Pressable onPress={()=>onDecidePlan(a.id,false)} style={s.planReject}><Text style={s.planRejectText}>Reject</Text></Pressable><Pressable onPress={()=>onDecidePlan(a.id,true)} style={s.planApprove}><Text style={s.planApproveText}>Approve preview</Text></Pressable></View>}
      </View>)}
    </View> : <View style={s.emptyState}><Icon name="check-square" size={24} color={C.violet}/><Text style={s.emptyTitle}>No response plan yet</Text><Text style={s.emptyText}>Open an incident and choose a safe next action to generate one.</Text></View>}
  </View>;
}

function Agent({live,serverHealth,busy,prompt,setPrompt,run,onSubmit}:{live:boolean;serverHealth:Health|null;busy:boolean;prompt:string;setPrompt:(v:string)=>void;run:AgentRun|null;onSubmit:()=>void}) {
  return <View style={s.page}>
    <SectionHead eyebrow="NEXUS AI" title="Ask the network" action={<View style={[s.contextPill,{backgroundColor:live?C.mintSoft:'#F2F4F7'}]}><View style={[s.statusDot,{backgroundColor:live?C.mint:C.faint}]}/><Text style={s.contextPillText}>{live?'LIVE CONTEXT':'NO CONTEXT'}</Text></View>}/>
    <LinearGradient colors={['#191C2C','#272147','#35265E']} style={s.aiHero}>
      <View style={s.aiOrb}><View style={s.aiOrbInner}><Text style={s.aiOrbText}>N</Text></View></View>
      <Text style={s.aiHeroTitle}>Network intelligence,{"\n"}ready when you are.</Text>
      <Text style={s.aiHeroCopy}>Ask about health, trust zones, devices, risk or what to check next.</Text>
      <View style={s.aiModelRow}><Icon name="cpu" size={13} color="#C9C3FF"/><Text style={s.aiModelText}>{serverHealth?.model||'Local model'} · {serverHealth?.modelReady?'ready':'auto fallback'}</Text></View>
    </LinearGradient>

    <View style={s.composer}>
      <TextInput value={prompt} onChangeText={setPrompt} multiline placeholder="Ask NEXUS anything about this lab…" placeholderTextColor={C.faint} style={s.composerInput}/>
      <Pressable onPress={onSubmit} disabled={busy} style={[s.sendButton,busy&&{opacity:.6}]}><Icon name={busy?'loader':'arrow-up'} size={18} color="#FFFFFF"/></Pressable>
    </View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.promptChips}>
      {[
        'Review my network health',
        'Where is ATTACKER-PC?',
        'Explain the current alerts',
        'What should I check next?',
      ].map(q=><Pressable key={q} onPress={()=>setPrompt(q)} style={s.promptChip}><Text style={s.promptChipText}>{q}</Text></Pressable>)}
    </ScrollView>

    {run&&<View style={s.runCard}>
      <View style={s.runHeader}><Text style={s.runLabel}>AGENT RUN</Text><Text style={[s.runStatus,{color:run.status==='completed'?C.mint:run.status==='failed'?C.coral:C.violet}]}>{run.status.toUpperCase()}</Text></View>
      <Text style={s.runPrompt}>{run.prompt}</Text>
      <View style={s.runEvents}>{run.events.slice(-5).map(e=><View key={e.id} style={s.runEvent}><View style={[s.runEventDot,{backgroundColor:e.kind==='error'?C.coral:e.kind==='success'?C.mint:C.violet}]}/><View style={{flex:1}}><Text style={s.runEventTitle}>{e.title}</Text>{!!e.detail&&<Text style={s.runEventDetail}>{e.detail}</Text>}</View></View>)}</View>
      {!!run.answer&&<View style={s.answerBox}><Text style={s.answerLabel}>NEXUS RESPONSE</Text><Text style={s.answerText}>{run.answer}</Text></View>}
      {!!run.error&&<View style={s.agentError}><Icon name="alert-triangle" size={15} color={C.coral}/><Text style={s.agentErrorText}>{run.error}</Text></View>}
    </View>}
  </View>;
}

function Connect({live,editEndpoint,setEditEndpoint,editPair,setEditPair,onConnect,busy,serverHealth}:{live:boolean;editEndpoint:string;setEditEndpoint:(v:string)=>void;editPair:string;setEditPair:(v:string)=>void;onConnect:()=>void;busy:boolean;serverHealth:Health|null}) {
  return <View style={s.page}>
    <SectionHead eyebrow="CONNECT" title="Local lab session"/>
    <LinearGradient colors={live?['#E7F9F3','#F7FFFC']:['#EEF3F8','#FFFFFF']} style={s.connectionHero}>
      <View style={[s.connectionHeroIcon,{backgroundColor:live?C.mintSoft:'#EEF2F6'}]}><Icon name="radio" size={22} color={live?C.mint:C.muted}/></View>
      <Text style={s.connectionHeroTitle}>{live?'Packet Tracer is live':'Ready to connect'}</Text>
      <Text style={s.connectionHeroText}>{live?'NEXUS is receiving local controller telemetry.':'Use 10.0.2.2 from the Android emulator to reach your Windows NEXUS server.'}</Text>
      <View style={[s.connectionState,{backgroundColor:live?C.mintSoft:'#F2F4F7'}]}><View style={[s.statusDot,{backgroundColor:live?C.mint:C.faint}]}/><Text style={[s.connectionStateText,{color:live?'#117B61':C.muted}]}>{live?'CONNECTED':'OFFLINE'}</Text></View>
    </LinearGradient>

    <View style={s.formCard}>
      <Text style={s.fieldLabel}>Gateway address</Text>
      <View style={s.inputWrap}><Icon name="globe" size={16} color={C.muted}/><TextInput value={editEndpoint} onChangeText={setEditEndpoint} autoCapitalize="none" style={s.input} placeholder="http://10.0.2.2:8787" placeholderTextColor={C.faint}/></View>
      <Text style={s.fieldLabel}>Pairing code</Text>
      <View style={s.inputWrap}><Icon name="key" size={16} color={C.muted}/><TextInput value={editPair} onChangeText={setEditPair} autoCapitalize="none" secureTextEntry style={s.input} placeholder="Enter pairing code" placeholderTextColor={C.faint}/></View>
      <Pressable onPress={onConnect} disabled={busy} style={[s.connectButton,busy&&{opacity:.6}]}><Icon name="link-2" size={16} color="#FFFFFF"/><Text style={s.connectButtonText}>{busy?'CONNECTING…':live?'RECONNECT LAB':'CONNECT LIVE LAB'}</Text></Pressable>
    </View>

    <View style={s.tipCard}><View style={s.tipIcon}><Icon name="smartphone" size={16} color={C.blue}/></View><View style={{flex:1}}><Text style={s.tipTitle}>Android emulator shortcut</Text><Text style={s.tipText}>Use http://10.0.2.2:8787 to access the NEXUS server running on your Windows host.</Text></View></View>
    <View style={s.tipCard}><View style={[s.tipIcon,{backgroundColor:C.violetSoft}]}><Icon name="cpu" size={16} color={C.violet}/></View><View style={{flex:1}}><Text style={s.tipTitle}>Local AI model</Text><Text style={s.tipText}>{serverHealth?.model||'Auto-select'} · {serverHealth?.modelReady?'ready':'fallback available'}</Text></View></View>
  </View>;
}

const nav:{id:MobilePage;label:string;icon:IconName}[]=[
  {id:'home',label:'Home',icon:'home'},
  {id:'dashboard',label:'Overview',icon:'grid'},
  {id:'topology',label:'Fabric',icon:'share-2'},
  {id:'security',label:'Defend',icon:'shield'},
  {id:'agent',label:'AI',icon:'command'},
];

export function MobileExperience(props:Props) {
  const {page,setPage,live,network,topology,security,incidents,serverHealth,actions,incidentMode,setIncidentMode,busy,prompt,setPrompt,run,editEndpoint,setEditEndpoint,editPair,setEditPair,onConnect,onRefresh,onSubmit,onCreatePlan,onDecidePlan,notice,clearNotice}=props;
  return <SafeAreaView style={s.root} edges={['top','bottom']}>
    <MobileHeader live={live} onConnect={()=>setPage('settings')}/>
    {!!notice&&<Pressable onPress={clearNotice} style={s.notice}><Icon name="info" size={14} color={C.amber}/><Text style={s.noticeText} numberOfLines={2}>{notice}</Text><Icon name="x" size={14} color={C.muted}/></Pressable>}
    <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
      {page==='home'&&<Home live={live} network={network} topology={topology} security={security} setPage={setPage}/>}
      {page==='dashboard'&&<Overview network={network} topology={topology} security={security}/>}
      {page==='topology'&&<Fabric topology={topology} incidentMode={incidentMode} setIncidentMode={setIncidentMode}/>}
      {page==='security'&&<Defend security={security} incidents={incidents} actions={actions} onCreatePlan={onCreatePlan} onDecidePlan={onDecidePlan}/>}
      {page==='agent'&&<Agent live={live} serverHealth={serverHealth} busy={busy} prompt={prompt} setPrompt={setPrompt} run={run} onSubmit={onSubmit}/>}
      {page==='settings'&&<Connect live={live} editEndpoint={editEndpoint} setEditEndpoint={setEditEndpoint} editPair={editPair} setEditPair={setEditPair} onConnect={onConnect} busy={busy} serverHealth={serverHealth}/>}
    </ScrollView>

    <View style={s.navShell}>
      {nav.map(item=>{
        const active=page===item.id;
        return <Pressable key={item.id} onPress={()=>setPage(item.id)} style={s.navItem}>
          <View style={[s.navIconWrap,active&&s.navIconActive]}><Icon name={item.icon} size={18} color={active?C.ink:C.muted}/></View>
          <Text style={[s.navText,active&&s.navTextActive]}>{item.label}</Text>
        </Pressable>;
      })}
    </View>
  </SafeAreaView>;
}

const s=StyleSheet.create({
  root:{flex:1,backgroundColor:C.bg},
  header:{height:68,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'rgba(255,255,255,.96)',borderBottomWidth:1,borderBottomColor:'#E8EDF4'},
  brandRow:{flexDirection:'row',alignItems:'center',gap:10},logo:{width:38,height:38,borderRadius:13,alignItems:'center',justifyContent:'center'},logoText:{color:'#FFFFFF',fontSize:20,fontWeight:'900'},brand:{color:C.ink,fontSize:16,fontWeight:'900',letterSpacing:1.7},brandSub:{color:C.faint,fontSize:6.5,fontWeight:'800',letterSpacing:1,marginTop:2},
  headerActions:{flexDirection:'row',alignItems:'center',gap:8},livePill:{height:34,borderRadius:17,paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:5},livePillText:{fontSize:7.5,fontWeight:'900',letterSpacing:.8},offlineDot:{width:7,height:7,borderRadius:7,backgroundColor:C.faint},roundButton:{width:36,height:36,borderRadius:12,backgroundColor:'#F2F5F9',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#E1E7EF'},
  notice:{marginHorizontal:14,marginTop:10,paddingHorizontal:12,paddingVertical:10,borderRadius:13,backgroundColor:C.amberSoft,borderWidth:1,borderColor:'#F1D6A8',flexDirection:'row',alignItems:'center',gap:8},noticeText:{flex:1,color:'#8B601D',fontSize:9,lineHeight:13},
  scroll:{flex:1},scrollContent:{padding:14,paddingBottom:108},page:{gap:16},
  sectionHead:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',gap:12,marginTop:2},eyebrow:{color:C.mint,fontSize:8,fontWeight:'900',letterSpacing:1.5},sectionTitle:{color:C.ink,fontSize:24,lineHeight:29,fontWeight:'900',marginTop:4,letterSpacing:-.6},textAction:{color:C.violet,fontSize:9,fontWeight:'900'},
  hero:{borderRadius:26,padding:20,overflow:'hidden',minHeight:390},heroGlowA:{position:'absolute',width:220,height:220,borderRadius:150,backgroundColor:'#5AE0BD',opacity:.16,right:-80,top:-70},heroGlowB:{position:'absolute',width:240,height:240,borderRadius:160,backgroundColor:'#8A7CFF',opacity:.18,left:-100,bottom:-120},
  heroTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},heroKicker:{color:'#B9F3E2',fontSize:8,fontWeight:'900',letterSpacing:1.4},heroBadge:{paddingHorizontal:9,paddingVertical:5,borderRadius:10,backgroundColor:'rgba(255,255,255,.12)'},heroBadgeText:{color:'#FFFFFF',fontSize:7,fontWeight:'900',letterSpacing:.8},
  heroTitle:{color:'#FFFFFF',fontSize:36,lineHeight:39,fontWeight:'900',letterSpacing:-1.2,marginTop:28},heroCopy:{color:'#CBD5E1',fontSize:12,lineHeight:18,marginTop:11,maxWidth:310},heroActions:{flexDirection:'row',gap:9,marginTop:19},
  softButton:{height:42,borderRadius:13,paddingHorizontal:13,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},softButtonText:{fontSize:9,fontWeight:'900'},
  heroPulseRow:{marginTop:27,flexDirection:'row',alignItems:'center',gap:13,paddingTop:18,borderTopWidth:1,borderTopColor:'rgba(255,255,255,.13)'},scoreRing:{width:61,height:61,borderRadius:31,borderWidth:4,borderColor:'#45DAB5',alignItems:'center',justifyContent:'center'},scoreValue:{color:'#FFFFFF',fontSize:18,fontWeight:'900'},scoreLabel:{color:'#9FE9D5',fontSize:5.5,fontWeight:'900',letterSpacing:.8},heroPulseTitle:{color:'#FFFFFF',fontSize:11,fontWeight:'900'},heroPulseSub:{color:'#AEB9CB',fontSize:8.5,lineHeight:13,marginTop:4},
  statGrid:{flexDirection:'row',flexWrap:'wrap',gap:10},statCard:{width:'48.5%',backgroundColor:C.card,borderRadius:18,padding:14,borderWidth:1,borderColor:C.line,shadowColor:'#64748B',shadowOpacity:.05,shadowRadius:12,shadowOffset:{width:0,height:6}},statIcon:{width:32,height:32,borderRadius:11,alignItems:'center',justifyContent:'center'},statValue:{color:C.ink,fontSize:23,fontWeight:'900',marginTop:12},statLabel:{color:C.muted,fontSize:9,marginTop:3},
  flowCompact:{overflow:'hidden',borderRadius:18},priorityCard:{backgroundColor:C.card,borderRadius:18,padding:13,borderWidth:1,borderColor:'#F0D4DA',flexDirection:'row',gap:10,alignItems:'center'},priorityIcon:{width:38,height:38,borderRadius:12,backgroundColor:C.coralSoft,alignItems:'center',justifyContent:'center'},priorityTop:{flexDirection:'row',justifyContent:'space-between',gap:8},priorityTitle:{color:C.ink,fontSize:10.5,fontWeight:'900',flex:1},prioritySeverity:{color:C.coral,fontSize:6.5,fontWeight:'900',letterSpacing:.7},priorityText:{color:C.muted,fontSize:8.5,lineHeight:13,marginTop:4},clearCard:{backgroundColor:C.card,borderWidth:1,borderColor:C.line,borderRadius:18,padding:14,flexDirection:'row',alignItems:'center',gap:11},clearIcon:{width:38,height:38,borderRadius:12,backgroundColor:C.mintSoft,alignItems:'center',justifyContent:'center'},clearTitle:{color:C.ink,fontSize:10.5,fontWeight:'900'},clearText:{color:C.muted,fontSize:8.5,marginTop:3},
  actionGrid:{flexDirection:'row',flexWrap:'wrap',gap:10},actionCard:{width:'48.5%',minHeight:132,backgroundColor:C.card,borderWidth:1,borderColor:C.line,borderRadius:20,padding:14,position:'relative'},actionIcon:{width:36,height:36,borderRadius:12,alignItems:'center',justifyContent:'center'},actionTitle:{color:C.ink,fontSize:11,fontWeight:'900',marginTop:12},actionSub:{color:C.muted,fontSize:8.3,marginTop:4},actionArrow:{position:'absolute',right:12,top:12},
  healthCard:{borderRadius:22,padding:18,borderWidth:1,borderColor:C.line},healthBig:{color:C.ink,fontSize:34,fontWeight:'900'},healthLabel:{color:C.muted,fontSize:9,marginTop:3},healthBadge:{position:'absolute',right:16,top:16,paddingHorizontal:10,paddingVertical:7,borderRadius:12,flexDirection:'row',alignItems:'center',gap:6},healthBadgeText:{fontSize:7.5,fontWeight:'900'},progressTrack:{height:7,backgroundColor:'#E9EEF5',borderRadius:7,overflow:'hidden',marginTop:18},progressFill:{height:'100%',backgroundColor:C.mint,borderRadius:7},
  card:{backgroundColor:C.card,borderRadius:20,borderWidth:1,borderColor:C.line,paddingHorizontal:14},zoneRow:{paddingVertical:12},zoneRowHead:{flexDirection:'row',alignItems:'center',gap:8},zoneDot:{width:8,height:8,borderRadius:8},zoneName:{flex:1,color:C.text,fontSize:9.5,fontWeight:'800'},zoneCount:{color:C.ink,fontSize:10,fontWeight:'900'},zoneTrack:{height:5,backgroundColor:'#EEF2F6',borderRadius:5,overflow:'hidden',marginTop:8},zoneFill:{height:'100%',borderRadius:5},deviceRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:12},rowDivider:{borderBottomWidth:1,borderBottomColor:'#EEF1F5'},deviceIcon:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center'},deviceName:{color:C.ink,fontSize:10,fontWeight:'900'},deviceMeta:{color:C.muted,fontSize:8.2,marginTop:3},statusDot:{width:8,height:8,borderRadius:8},
  modeButton:{height:34,borderRadius:12,paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:C.line},modeButtonActive:{backgroundColor:C.coralSoft,borderColor:'#F3C6D0'},modeText:{color:C.text,fontSize:8,fontWeight:'900'},
  fabricCard:{backgroundColor:C.card,borderRadius:24,borderWidth:1,borderColor:C.line,padding:18,alignItems:'center'},fabricNode:{width:'82%',backgroundColor:'#F9FAFC',borderRadius:18,padding:13,flexDirection:'row',alignItems:'center',gap:10,borderWidth:1,borderColor:'#E4E9F0'},fabricNodeIcon:{width:40,height:40,borderRadius:13,alignItems:'center',justifyContent:'center'},fabricNodeName:{color:C.ink,fontSize:11,fontWeight:'900'},fabricNodeIp:{color:C.muted,fontSize:8.5,marginLeft:'auto'},verticalPath:{height:78,width:40,alignItems:'center',justifyContent:'center',overflow:'hidden'},verticalLine:{position:'absolute',width:2,height:'100%',backgroundColor:'#D8E0EA'},packet:{position:'absolute',width:10,height:10,borderRadius:10,shadowOpacity:.22,shadowRadius:7},microLabel:{color:C.muted,fontSize:7.5,fontWeight:'900',letterSpacing:1.3,marginTop:3},hostList:{gap:9},hostRow:{backgroundColor:C.card,borderRadius:16,borderWidth:1,borderColor:C.line,padding:12,flexDirection:'row',alignItems:'center',gap:10},hostIcon:{width:36,height:36,borderRadius:12,alignItems:'center',justifyContent:'center'},hostName:{color:C.ink,fontSize:10,fontWeight:'900'},hostMeta:{color:C.muted,fontSize:8.2,marginTop:3},vlanPill:{paddingHorizontal:8,paddingVertical:5,borderRadius:9},vlanText:{fontSize:7,fontWeight:'900'},
  postureCard:{borderRadius:24,padding:19,overflow:'hidden'},postureKicker:{color:'#D7F7EC',fontSize:7.5,fontWeight:'900',letterSpacing:1.3},postureTitle:{color:'#FFFFFF',fontSize:30,fontWeight:'900',marginTop:8},postureCopy:{color:'#D2DAE5',fontSize:9,lineHeight:14,marginTop:6},postureDot:{position:'absolute',right:18,top:18,width:11,height:11,borderRadius:11,shadowOpacity:.5,shadowRadius:10},alertRow:{flexDirection:'row',gap:10,paddingVertical:12},alertIcon:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center'},alertTitleRow:{flexDirection:'row',gap:8},alertTitle:{color:C.ink,fontSize:10,fontWeight:'900',flex:1},alertSeverity:{fontSize:6.5,fontWeight:'900'},alertDetail:{color:C.muted,fontSize:8.2,lineHeight:13,marginTop:4},emptyState:{alignItems:'center',paddingVertical:22},emptyTitle:{color:C.ink,fontSize:10.5,fontWeight:'900',marginTop:8},emptyText:{color:C.muted,fontSize:8.5,marginTop:3},responseGrid:{gap:8},responseButton:{height:52,borderRadius:16,backgroundColor:C.card,borderWidth:1,borderColor:C.line,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:12},responseButtonIcon:{width:34,height:34,borderRadius:11,backgroundColor:C.violetSoft,alignItems:'center',justifyContent:'center'},responseButtonText:{color:C.ink,fontSize:9.5,fontWeight:'900',flex:1},planCard:{backgroundColor:C.card,borderWidth:1,borderColor:C.line,borderRadius:18,padding:14},planTop:{flexDirection:'row',gap:8},planKicker:{color:C.amber,fontSize:6.5,fontWeight:'900'},planTitle:{color:C.ink,fontSize:10.5,fontWeight:'900',marginTop:4},planStatus:{color:C.muted,fontSize:6.5,fontWeight:'900'},planSummary:{color:C.muted,fontSize:8.5,lineHeight:13,marginTop:8},planActions:{flexDirection:'row',gap:8,marginTop:12},planReject:{flex:1,height:38,borderWidth:1,borderColor:'#F0C4CD',borderRadius:11,alignItems:'center',justifyContent:'center'},planRejectText:{color:C.coral,fontSize:8,fontWeight:'900'},planApprove:{flex:1,height:38,backgroundColor:C.mint,borderRadius:11,alignItems:'center',justifyContent:'center'},planApproveText:{color:'#FFFFFF',fontSize:8,fontWeight:'900'},
  contextPill:{height:30,borderRadius:15,paddingHorizontal:9,flexDirection:'row',alignItems:'center',gap:6},contextPillText:{color:C.muted,fontSize:6.5,fontWeight:'900'},aiHero:{borderRadius:24,padding:20,overflow:'hidden'},aiOrb:{width:58,height:58,borderRadius:29,borderWidth:1,borderColor:'rgba(255,255,255,.2)',alignItems:'center',justifyContent:'center'},aiOrbInner:{width:44,height:44,borderRadius:22,backgroundColor:'#6F61F6',alignItems:'center',justifyContent:'center'},aiOrbText:{color:'#FFFFFF',fontSize:20,fontWeight:'900'},aiHeroTitle:{color:'#FFFFFF',fontSize:25,lineHeight:29,fontWeight:'900',marginTop:18},aiHeroCopy:{color:'#C9C5DB',fontSize:10,lineHeight:16,marginTop:7},aiModelRow:{flexDirection:'row',gap:6,alignItems:'center',marginTop:16},aiModelText:{color:'#C9C3FF',fontSize:7.5,fontWeight:'800'},
  composer:{minHeight:62,backgroundColor:C.card,borderWidth:1,borderColor:'#D7DDEA',borderRadius:18,padding:8,flexDirection:'row',alignItems:'flex-end',gap:8,shadowColor:'#64748B',shadowOpacity:.05,shadowRadius:12},composerInput:{flex:1,minHeight:44,maxHeight:120,paddingHorizontal:7,paddingVertical:9,color:C.ink,fontSize:10.5,lineHeight:16},sendButton:{width:44,height:44,borderRadius:14,backgroundColor:C.ink,alignItems:'center',justifyContent:'center'},promptChips:{gap:8,paddingRight:12},promptChip:{borderWidth:1,borderColor:C.line,backgroundColor:'#FFFFFF',borderRadius:999,paddingHorizontal:11,paddingVertical:8},promptChipText:{color:C.text,fontSize:8,fontWeight:'800'},
  runCard:{backgroundColor:C.card,borderRadius:20,borderWidth:1,borderColor:C.line,padding:14},runHeader:{flexDirection:'row',justifyContent:'space-between'},runLabel:{color:C.muted,fontSize:7,fontWeight:'900',letterSpacing:1.2},runStatus:{fontSize:7,fontWeight:'900'},runPrompt:{color:C.ink,fontSize:11,fontWeight:'900',lineHeight:16,marginTop:8},runEvents:{marginTop:12,gap:9},runEvent:{flexDirection:'row',gap:8},runEventDot:{width:7,height:7,borderRadius:7,marginTop:4},runEventTitle:{color:C.text,fontSize:8.5,fontWeight:'800'},runEventDetail:{color:C.muted,fontSize:7.8,lineHeight:12,marginTop:2},answerBox:{marginTop:14,backgroundColor:'#F7F6FF',borderWidth:1,borderColor:'#E2DEFB',borderRadius:14,padding:11},answerLabel:{color:C.violet,fontSize:7,fontWeight:'900',letterSpacing:1},answerText:{color:C.text,fontSize:9,lineHeight:15,marginTop:6},agentError:{marginTop:10,flexDirection:'row',gap:7,backgroundColor:C.coralSoft,padding:10,borderRadius:12},agentErrorText:{color:'#9D3F52',fontSize:8.3,flex:1},
  connectionHero:{borderRadius:23,padding:18,borderWidth:1,borderColor:C.line},connectionHeroIcon:{width:46,height:46,borderRadius:15,alignItems:'center',justifyContent:'center'},connectionHeroTitle:{color:C.ink,fontSize:17,fontWeight:'900',marginTop:13},connectionHeroText:{color:C.muted,fontSize:9,lineHeight:14,marginTop:6},connectionState:{alignSelf:'flex-start',marginTop:13,borderRadius:12,paddingHorizontal:10,paddingVertical:7,flexDirection:'row',alignItems:'center',gap:6},connectionStateText:{fontSize:7,fontWeight:'900'},formCard:{backgroundColor:C.card,borderRadius:20,borderWidth:1,borderColor:C.line,padding:15},fieldLabel:{color:C.text,fontSize:8.5,fontWeight:'900',marginBottom:6,marginTop:7},inputWrap:{height:48,borderWidth:1,borderColor:'#D6DEE9',borderRadius:13,backgroundColor:'#FAFBFD',paddingHorizontal:11,flexDirection:'row',alignItems:'center',gap:8},input:{flex:1,color:C.ink,fontSize:10},connectButton:{height:48,borderRadius:14,backgroundColor:C.mint,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginTop:15},connectButtonText:{color:'#FFFFFF',fontSize:9,fontWeight:'900',letterSpacing:.6},tipCard:{backgroundColor:C.card,borderWidth:1,borderColor:C.line,borderRadius:16,padding:12,flexDirection:'row',gap:10},tipIcon:{width:36,height:36,borderRadius:12,backgroundColor:C.blueSoft,alignItems:'center',justifyContent:'center'},tipTitle:{color:C.ink,fontSize:9.5,fontWeight:'900'},tipText:{color:C.muted,fontSize:8.2,lineHeight:13,marginTop:3},
  navShell:{height:74,backgroundColor:'rgba(255,255,255,.98)',borderTopWidth:1,borderTopColor:'#E5EAF1',flexDirection:'row',paddingHorizontal:8,paddingTop:7,shadowColor:'#64748B',shadowOpacity:.08,shadowRadius:14,shadowOffset:{width:0,height:-6}},
  navItem:{flex:1,alignItems:'center',gap:3},navIconWrap:{width:38,height:34,borderRadius:12,alignItems:'center',justifyContent:'center'},navIconActive:{backgroundColor:'#E9F7F2'},navText:{color:C.muted,fontSize:6.8,fontWeight:'800'},navTextActive:{color:C.ink,fontWeight:'900'},
});