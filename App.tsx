import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Orb } from './src/Orb';
import { ScanRing, ThinkingDots } from './src/NexusVisuals';
import { TopologyScene } from './src/TopologyScene';
import { AgentRun, DefensiveAction, Health, IncidentTimeline, NetworkHealth, NetworkTopology, SecurityAnalysis } from './src/types';
import { checkHealth, decideAction, defaultEndpoint, getActions, getIncidents, getNetworkHealth, getNetworkTopology, getRun, getSecurityAnalysis, proposeAction, startRun } from './src/api';

type Page = 'dashboard' | 'topology' | 'security' | 'agent' | 'settings';
type IconName = keyof typeof Feather.glyphMap;

const P = {
  bg: '#0B0A0F',
  panel: '#15141A',
  panel2: '#19171F',
  border: '#2C2734',
  borderStrong: '#3C3449',
  mint: '#6EF2C6',
  mintSoft: '#A8F7DE',
  lilac: '#A78BFA',
  lilacSoft: '#D7C9FF',
  coral: '#FF6B8A',
  amber: '#FFCB7D',
  text: '#F7F3FB',
  text2: '#C3BCCB',
  muted: '#817A8C',
  muted2: '#635D6C',
};

const previewNetwork: NetworkHealth = {
  controllerOnline: true,
  deviceCount: 2,
  reachableCount: 2,
  unreachableCount: 0,
  allReachable: true,
  checkedAt: new Date().toISOString(),
  devices: [
    { id: 'preview-core', name: 'CORE-SW', role: 'core-switch', managementIp: '10.0.0.2', ipAddresses: ['10.0.0.2'], macAddress: '0001.4388.3D5C', interfaces: 33, status: 'online', reachabilityStatus: 'Reachable', collectionStatus: 'Unsupported', lastUpdated: 'preview' },
    { id: 'preview-edge', name: 'EDGE-RTR', role: 'edge-router', managementIp: '10.0.0.1', ipAddresses: ['10.0.0.1', '203.0.113.1'], macAddress: '0030.F219.26E7', interfaces: 4, status: 'online', reachabilityStatus: 'Reachable', collectionStatus: 'Unsupported', lastUpdated: 'preview' },
  ],
};

function Icon({ name, size = 18, color = P.text2 }: { name: IconName; size?: number; color?: string }) {
  return <Feather name={name} size={size} color={color} />;
}

function StatusChip({ label, tone = 'good' }: { label:string; tone?:'good'|'warn'|'danger'|'purple'|'neutral' }) {
  const color = tone === 'good' ? P.mint : tone === 'danger' ? P.coral : tone === 'warn' ? P.amber : tone === 'purple' ? P.lilac : P.text2;
  return <View style={[s.statusChip,{ borderColor: color + '66', backgroundColor: color + '12' }]}>
    <View style={[s.statusDot,{ backgroundColor:color }]} />
    <Text style={[s.statusText,{ color }]}>{label}</Text>
  </View>;
}

function Metric({ label, value, hint, icon, tone = 'mint' }: { label:string; value:string|number; hint?:string; icon:IconName; tone?:'mint'|'purple'|'coral'|'amber' }) {
  const color = tone === 'purple' ? P.lilac : tone === 'coral' ? P.coral : tone === 'amber' ? P.amber : P.mint;
  return <View style={s.metric}>
    <View style={s.metricTop}>
      <View style={[s.metricIcon,{ backgroundColor: color + '14' }]}><Icon name={icon} size={16} color={color} /></View>
      <Text style={[s.metricTrend,{ color }]}>{hint || 'LIVE'}</Text>
    </View>
    <Text style={s.metricValue}>{value}</Text>
    <Text style={s.metricLabel}>{label}</Text>
  </View>;
}

function SectionTitle({ overline, title, right }: { overline:string; title:string; right?:React.ReactNode }) {
  return <View style={s.sectionHead}>
    <View><Text style={s.overline}>{overline}</Text><Text style={s.sectionTitle}>{title}</Text></View>
    {right}
  </View>;
}

function OperatorResponse({ text }: { text:string }) {
  const labels = ['OBSERVED','INFERRED','RISK','NEXT CHECKS','CONFIDENCE'];
  const sections:{label:string;body:string}[] = [];
  let current = { label:'NEXUS RESPONSE', body:'' };
  for (const raw of text.split('\n')) {
    const cleaned = raw.trim().toUpperCase().replace(/[:#*]/g,'').trim();
    const label = labels.find(x => x === cleaned);
    if (label) {
      if (current.body.trim()) sections.push(current);
      current = { label, body:'' };
    } else current.body += (current.body ? '\n' : '') + raw;
  }
  if (current.body.trim()) sections.push(current);
  if (sections.length <= 1) return <Text style={s.answerBody}>{text}</Text>;
  const icons:Record<string,IconName> = { OBSERVED:'eye', INFERRED:'git-merge', RISK:'alert-triangle', 'NEXT CHECKS':'check-square', CONFIDENCE:'target' };
  return <View style={s.responseGrid}>
    {sections.map((part,i)=><View key={part.label+i} style={[s.responseCard, part.label === 'RISK' && s.responseRisk]}>
      <View style={s.responseHead}><View style={s.responseIcon}><Icon name={icons[part.label] || 'cpu'} size={13} color={part.label === 'RISK' ? P.coral : P.mint} /></View><Text style={s.responseLabel}>{part.label}</Text></View>
      <Text style={s.responseText}>{part.body.trim()}</Text>
    </View>)}
  </View>;
}

function AppContent() {
  const { width } = useWindowDimensions();
  const desktop = width >= 980;
  const wide = width >= 1250;
  const [page,setPage] = useState<Page>('dashboard');
  const [endpoint,setEndpoint] = useState(defaultEndpoint());
  const [pair,setPair] = useState('');
  const [editEndpoint,setEditEndpoint] = useState(defaultEndpoint());
  const [editPair,setEditPair] = useState('');
  const [serverHealth,setServerHealth] = useState<Health|null>(null);
  const [network,setNetwork] = useState<NetworkHealth|null>(null);
  const [topology,setTopology] = useState<NetworkTopology|null>(null);
  const [security,setSecurity] = useState<SecurityAnalysis|null>(null);
  const [incidents,setIncidents] = useState<IncidentTimeline|null>(null);
  const [actions,setActions] = useState<DefensiveAction[]>([]);
  const [incidentMode,setIncidentMode] = useState(false);
  const [connected,setConnected] = useState(false);
  const [notice,setNotice] = useState('');
  const [busy,setBusy] = useState(false);
  const [prompt,setPrompt] = useState('');
  const [run,setRun] = useState<AgentRun|null>(null);

  useEffect(()=>{
    Promise.all([AsyncStorage.getItem('@nexus/endpoint'),AsyncStorage.getItem('@nexus/pair')]).then(([e,p])=>{
      if (e) { setEndpoint(e); setEditEndpoint(e); }
      if (p) { setPair(p); setEditPair(p); }
    }).catch(()=>{});
  },[]);

  useEffect(()=>{
    if (!connected) return;
    const timer = setInterval(()=>{
      Promise.all([
        getNetworkHealth(endpoint,pair),
        getNetworkTopology(endpoint,pair),
        getSecurityAnalysis(endpoint,pair),
        getIncidents(endpoint,pair),
        getActions(endpoint,pair),
      ]).then(([n,t,sec,inc,act])=>{
        setNetwork(n); setTopology(t); setSecurity(sec); setIncidents(inc); setActions(act.proposals);
      }).catch(()=>{});
    },4000);
    return ()=>clearInterval(timer);
  },[connected,endpoint,pair]);

  useEffect(()=>{
    if (!run?.id || !['thinking','approval','resuming'].includes(run.status)) return;
    const timer = setInterval(()=>getRun(endpoint,pair,run.id).then(setRun).catch(e=>setNotice(e.message)),850);
    return ()=>clearInterval(timer);
  },[run?.id,run?.status,endpoint,pair]);

  const shown = network || previewNetwork;
  const live = connected && !!network;
  const alertCount = security?.alertCount ?? 0;
  const posture = security?.posture || (alertCount ? 'warning' : 'normal');

  const nav = useMemo(()=>[
    { id:'dashboard' as Page, label:'Overview', icon:'grid' as IconName },
    { id:'topology' as Page, label:'Fabric', icon:'share-2' as IconName },
    { id:'security' as Page, label:'Defend', icon:'shield' as IconName },
    { id:'agent' as Page, label:'NEXUS AI', icon:'command' as IconName },
    { id:'settings' as Page, label:'Connect', icon:'sliders' as IconName },
  ],[]);

  async function connect() {
    setBusy(true); setNotice('');
    try {
      const base = editEndpoint.trim().replace(/\/$/,'');
      const token = editPair.trim();
      const h = await checkHealth(base);
      const [n,t,sec,inc,act] = await Promise.all([
        getNetworkHealth(base,token),
        getNetworkTopology(base,token),
        getSecurityAnalysis(base,token),
        getIncidents(base,token),
        getActions(base,token),
      ]);
      setEndpoint(base); setPair(token); setServerHealth(h); setNetwork(n); setTopology(t); setSecurity(sec); setIncidents(inc); setActions(act.proposals); setConnected(true);
      await AsyncStorage.multiSet([['@nexus/endpoint',base],['@nexus/pair',token]]);
      setNotice('Live Packet Tracer telemetry connected.');
      setPage('dashboard');
    } catch(e) {
      setConnected(false);
      setNotice(e instanceof Error ? e.message : 'Connection failed');
    } finally { setBusy(false); }
  }

  async function refresh() {
    if (!connected) { setPage('settings'); setNotice('Connect the local gateway first.'); return; }
    setBusy(true);
    try {
      const [n,t,sec,inc,act] = await Promise.all([
        getNetworkHealth(endpoint,pair),getNetworkTopology(endpoint,pair),getSecurityAnalysis(endpoint,pair),getIncidents(endpoint,pair),getActions(endpoint,pair)
      ]);
      setNetwork(n); setTopology(t); setSecurity(sec); setIncidents(inc); setActions(act.proposals);
    } catch(e) { setNotice(e instanceof Error ? e.message : 'Refresh failed'); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (!connected) { setPage('settings'); setNotice('Connect NEXUS first.'); return; }
    if (prompt.trim().length < 3) return;
    setBusy(true); setNotice('');
    try { setRun(await startRun(endpoint,pair,prompt.trim())); setPrompt(''); }
    catch(e) { setNotice(e instanceof Error ? e.message : 'Unable to start agent'); }
    finally { setBusy(false); }
  }

  async function createPlan(kind:string) {
    if (!connected) { setPage('settings'); setNotice('Connect NEXUS first.'); return; }
    setBusy(true);
    try {
      const proposal = await proposeAction(endpoint,pair,kind);
      setActions(prev=>[proposal,...prev.filter(x=>x.id!==proposal.id)]);
      setNotice('Defensive plan generated. Review before approval.');
    } catch(e) { setNotice(e instanceof Error ? e.message : 'Unable to create plan'); }
    finally { setBusy(false); }
  }

  async function decidePlan(id:string,approved:boolean) {
    setBusy(true);
    try {
      const updated = await decideAction(endpoint,pair,id,approved);
      setActions(prev=>prev.map(x=>x.id===id?updated:x));
      setNotice(approved ? 'Approved as preview only. No IOS change was executed.' : 'Plan rejected. No network change was made.');
    } catch(e) { setNotice(e instanceof Error ? e.message : 'Unable to update plan'); }
    finally { setBusy(false); }
  }

  const header = <View style={s.header}>
    <View style={s.brand}>
      <LinearGradient colors={[P.mint,P.lilac]} start={{x:0,y:0}} end={{x:1,y:1}} style={s.logo}><Text style={s.logoText}>N</Text></LinearGradient>
      <View><Text style={s.brandName}>NEXUS</Text><Text style={s.brandSub}>V4 · AUTONOMOUS NETWORK STUDIO</Text></View>
    </View>
    {desktop && <View style={s.tabs}>{nav.map(item=><Pressable key={item.id} onPress={()=>setPage(item.id)} style={[s.tab,page===item.id&&s.tabActive]}>
      <Icon name={item.icon} size={15} color={page===item.id?P.mint:P.muted} /><Text style={[s.tabText,page===item.id&&s.tabTextActive]}>{item.label}</Text>
    </Pressable>)}</View>}
    <View style={s.headerRight}>
      <StatusChip label={live?'LIVE':'PREVIEW'} tone={live?'good':'neutral'} />
      {desktop && <Pressable onPress={refresh} style={s.iconButton}><Icon name="refresh-cw" size={15} color={P.text2} /></Pressable>}
    </View>
  </View>;

  return <SafeAreaView style={s.root} edges={['top','bottom']}>
    <StatusBar barStyle="light-content" />
    <View pointerEvents="none" style={s.bgOrbA} />
    <View pointerEvents="none" style={s.bgOrbB} />
    {header}
    {!!notice && <Pressable onPress={()=>setNotice('')} style={s.notice}><Icon name="info" size={15} color={P.amber} /><Text style={s.noticeText}>{notice}</Text><Icon name="x" size={14} color={P.muted} /></Pressable>}

    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      {page==='dashboard' && <>
        <View style={[s.heroGrid,wide&&{flexDirection:'row'}]}>
          <LinearGradient colors={['#19171F','#121116']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.heroMain}>
            <View style={s.heroBadge}><View style={s.heroBadgeDot}/><Text style={s.heroBadgeText}>REAL-TIME LOCAL INTELLIGENCE</Text></View>
            <Text style={s.heroTitle}>Operate the network,{"\n"}<Text style={s.heroTitleAccent}>not the dashboard.</Text></Text>
            <Text style={s.heroText}>NEXUS turns Packet Tracer telemetry into a live operating picture: fabric, endpoints, trust zones, incidents and AI-assisted investigation.</Text>
            <View style={s.heroActions}>
              <Pressable onPress={()=>setPage('agent')} style={s.primary}><Text style={s.primaryText}>OPEN NEXUS AI</Text><Icon name="arrow-up-right" size={15} color="#0B0A0F" /></Pressable>
              <Pressable onPress={()=>setPage('topology')} style={s.secondary}><Icon name="share-2" size={14} color={P.lilac} /><Text style={s.secondaryText}>EXPLORE FABRIC</Text></Pressable>
            </View>
          </LinearGradient>
          <View style={s.pulseCard}>
            <View style={s.pulseTop}><View><Text style={s.overline}>NETWORK PULSE</Text><Text style={s.pulseTitle}>{shown.allReachable?'Stable fabric':'Attention required'}</Text></View><StatusChip label={posture.toUpperCase()} tone={posture==='critical'?'danger':posture==='warning'?'warn':'good'} /></View>
            <View style={s.orbWrap}><Orb size={190} active={live} /></View>
            <View style={s.pulseFooter}><View><Text style={s.pulseNumber}>{shown.reachableCount}/{shown.deviceCount}</Text><Text style={s.pulseLabel}>devices reachable</Text></View><View><Text style={[s.pulseNumber,{color:alertCount?P.coral:P.mint}]}>{alertCount}</Text><Text style={s.pulseLabel}>active alerts</Text></View></View>
          </View>
        </View>

        <View style={[s.metricGrid,desktop&&{flexDirection:'row'}]}>
          <Metric label="Network devices" value={shown.deviceCount} hint="DISCOVERED" icon="server" />
          <Metric label="Reachable" value={shown.reachableCount} hint="HEALTH" icon="check-circle" />
          <Metric label="Observed hosts" value={security?.hostCount ?? 0} hint="ENDPOINTS" icon="monitor" tone="purple" />
          <Metric label="Security alerts" value={alertCount} hint={alertCount?'REVIEW':'CLEAR'} icon="shield" tone={alertCount?'coral':'mint'} />
        </View>

        <View style={[s.dashboardLower,wide&&{flexDirection:'row'}]}>
          <View style={s.dashboardMain}>
            <SectionTitle overline="FABRIC SNAPSHOT" title="Network in context" right={<Pressable onPress={()=>setPage('topology')} style={s.textButton}><Text style={s.textButtonText}>OPEN FABRIC</Text><Icon name="arrow-right" size={13} color={P.mint}/></Pressable>} />
            <TopologyScene topology={topology} />
          </View>
          <View style={s.dashboardSide}>
            <SectionTitle overline="PRIORITY QUEUE" title="What needs attention" />
            <View style={s.queueCard}>
              {(security?.alerts||[]).length ? (security?.alerts||[]).slice(0,4).map(a=><Pressable key={a.id} onPress={()=>{setIncidentMode(true);setPage('security');}} style={s.queueItem}>
                <View style={[s.queueIcon,{backgroundColor:a.severity==='critical'?P.coral+'18':P.amber+'14'}]}><Icon name={a.severity==='critical'?'alert-octagon':'alert-triangle'} size={15} color={a.severity==='critical'?P.coral:P.amber}/></View>
                <View style={{flex:1}}><Text style={s.queueTitle}>{a.title}</Text><Text style={s.queueText} numberOfLines={2}>{a.detail}</Text></View><Icon name="chevron-right" size={15} color={P.muted2}/>
              </Pressable>) : <View style={s.clearState}><Icon name="check-circle" size={27} color={P.mint}/><Text style={s.clearTitle}>No NEXUS alerts</Text><Text style={s.clearText}>Current heuristics did not raise an active lab alert.</Text></View>}
            </View>

            <View style={s.aiLaunchCard}>
              <Text style={s.aiLaunchOverline}>NEXUS AI</Text>
              <Text style={s.aiLaunchTitle}>Investigate with context.</Text>
              <Text style={s.aiLaunchText}>The agent can inspect live hosts, topology and security evidence before answering.</Text>
              <Pressable onPress={()=>{setPrompt('Review my current network, identify anything that needs attention, and separate observed facts from inference.');setPage('agent');}} style={s.aiLaunchButton}><Text style={s.aiLaunchButtonText}>START INVESTIGATION</Text><Icon name="arrow-up-right" size={14} color={P.lilacSoft}/></Pressable>
            </View>
          </View>
        </View>
      </>}

      {page==='topology' && <>
        <SectionTitle overline="FABRIC / TRUST ZONES" title="Interactive network fabric" right={<View style={s.pageActions}>
          <Pressable onPress={()=>setIncidentMode(v=>!v)} style={[s.incidentButton,incidentMode&&s.incidentButtonActive]}>
            <Icon name={incidentMode?'x':'zap'} size={14} color={incidentMode?P.coral:P.text}/><Text style={[s.incidentButtonText,incidentMode&&{color:P.coral}]}>{incidentMode?'EXIT INCIDENT':'ENTER INCIDENT'}</Text>
          </Pressable>
          <StatusChip label={topology?'LIVE FABRIC':'NO DATA'} tone={topology?'good':'neutral'} />
        </View>} />
        <Text style={s.pageIntro}>A trust-zone view of your lab. Device and host cards are live controller observations; the backbone relation is labeled from the known lab model.</Text>
        <TopologyScene topology={topology} incidentMode={incidentMode} />
        <View style={s.relationshipPanel}>
          <View style={s.relationshipHead}><Text style={s.relationshipTitle}>Observed relationships</Text><Text style={s.relationshipCount}>{topology?.links.length||0} links</Text></View>
          <View style={s.relationshipGrid}>{(topology?.links||[]).slice(0,12).map(link=><View key={link.id} style={s.relationshipChip}><View style={s.relationshipDot}/><Text style={s.relationshipText}>{link.label||'Network link'}</Text><Text style={s.relationshipSource}>{link.sourceType}</Text></View>)}</View>
        </View>
      </>}

      {page==='security' && <>
        <SectionTitle overline="DEFEND / INCIDENT OPERATIONS" title="Security command board" right={<StatusChip label={posture.toUpperCase()} tone={posture==='critical'?'danger':posture==='warning'?'warn':'good'} />} />
        <Text style={s.pageIntro}>Prioritise what is observed, inspect the lab threat marker, and prepare reversible containment plans without silently changing IOS configuration.</Text>
        <View style={[s.metricGrid,desktop&&{flexDirection:'row'}]}>
          <Metric label="Observed hosts" value={security?.hostCount??0} hint="TELEMETRY" icon="monitor" />
          <Metric label="Active alerts" value={security?.alertCount??0} hint="QUEUE" icon="shield" tone={alertCount?'coral':'mint'} />
          <Metric label="Critical" value={security?.criticalCount??0} hint="SEVERITY" icon="alert-octagon" tone="coral" />
          <Metric label="Snapshots" value={incidents?.timeline.length??0} hint="TIMELINE" icon="clock" tone="purple" />
        </View>

        <View style={[s.securityGrid,wide&&{flexDirection:'row'}]}>
          <View style={s.securityMain}>
            <View style={s.panel}>
              <View style={s.panelHead}><View><Text style={s.panelOverline}>DETECTION FEED</Text><Text style={s.panelTitle}>Current signals</Text></View><Pressable onPress={refresh} style={s.iconButton}><Icon name="refresh-cw" size={14}/></Pressable></View>
              {(security?.alerts||[]).length ? (security?.alerts||[]).map(a=><View key={a.id} style={[s.alertRow,a.severity==='critical'&&s.alertRowCritical]}>
                <View style={s.alertScan}><ScanRing danger={a.severity==='critical'}/></View>
                <View style={{flex:1}}><View style={s.alertHead}><Text style={s.alertTitle}>{a.title}</Text><Text style={[s.alertSeverity,{color:a.severity==='critical'?P.coral:P.amber}]}>{a.severity.toUpperCase()}</Text></View><Text style={s.alertDetail}>{a.detail}</Text></View>
                <Pressable onPress={()=>{setIncidentMode(true);setPage('topology');}} style={s.traceButton}><Text style={s.traceText}>TRACE</Text><Icon name="arrow-up-right" size={12} color={P.mint}/></Pressable>
              </View>) : <View style={s.clearState}><Icon name="shield" size={30} color={P.mint}/><Text style={s.clearTitle}>Quiet detection feed</Text><Text style={s.clearText}>No current NEXUS heuristic matched.</Text></View>}
            </View>

            <View style={s.panel}>
              <View style={s.panelHead}><View><Text style={s.panelOverline}>EVENT HISTORY</Text><Text style={s.panelTitle}>Incident timeline</Text></View><Text style={s.panelMeta}>rolling snapshots</Text></View>
              {(incidents?.timeline||[]).slice(0,8).map((frame,index)=><View key={frame.id} style={s.timelineItem}>
                <View style={s.timelineTrack}><View style={[s.timelineDot,frame.posture==='critical'&&{backgroundColor:P.coral}]}/>{index<Math.min(7,(incidents?.timeline.length||1)-1)&&<View style={s.timelineStem}/>}</View>
                <View style={{flex:1}}><View style={s.timelineRow}><Text style={s.timelineTime}>{new Date(frame.at).toLocaleTimeString()}</Text><Text style={[s.timelinePosture,{color:frame.posture==='critical'?P.coral:P.mint}]}>{frame.posture.toUpperCase()}</Text></View><Text style={s.timelineText}>{frame.alertCount} alert{frame.alertCount===1?'':'s'} observed</Text></View>
              </View>)}
            </View>
          </View>

          <View style={s.securitySide}>
            <LinearGradient colors={['#1B1722','#131219']} style={s.playbook}>
              <Text style={s.panelOverline}>RESPONSE PLAYBOOK</Text><Text style={s.playbookTitle}>Containment planner</Text><Text style={s.playbookText}>Generate reversible IOS command plans. Approval is recorded as preview only until a verified write path is connected.</Text>
              {[
                ['isolate_guest_from_server','shield','Isolate guest → server'],
                ['quarantine_attacker_port','slash','Quarantine attacker port'],
                ['protect_management','lock','Protect management'],
              ].map(([kind,icon,label])=><Pressable key={kind} onPress={()=>createPlan(kind)} style={s.playbookAction}><View style={s.playbookIcon}><Icon name={icon as IconName} size={15} color={P.mint}/></View><Text style={s.playbookActionText}>{label}</Text><Icon name="plus" size={14} color={P.muted}/></Pressable>)}
            </LinearGradient>

            {actions.slice(0,3).map(a=><View key={a.id} style={s.plan}>
              <View style={s.planHead}><View><Text style={s.planRisk}>{a.risk.toUpperCase()} RISK</Text><Text style={s.planTitle}>{a.title}</Text></View><StatusChip label={a.status.toUpperCase()} tone={a.status==='approved-preview'?'good':a.status==='rejected'?'neutral':'warn'}/></View>
              <Text style={s.planSummary}>{a.summary}</Text>
              <View style={s.codeBox}>{a.commands.map((line,i)=><Text key={i} style={s.codeLine}>{line}</Text>)}</View>
              {a.status==='pending'&&<View style={s.planButtons}><Pressable onPress={()=>decidePlan(a.id,false)} style={s.reject}><Text style={s.rejectText}>REJECT</Text></Pressable><Pressable onPress={()=>decidePlan(a.id,true)} style={s.approve}><Text style={s.approveText}>APPROVE PREVIEW</Text></Pressable></View>}
              <Text style={s.planNote}>{a.note}</Text>
            </View>)}
          </View>
        </View>
      </>}

      {page==='agent' && <>
        <SectionTitle overline="NEXUS AI / OPERATOR COPILOT" title="Investigate the network" right={<View style={s.pageActions}><StatusChip label={serverHealth?.modelReady?'MODEL READY':'MODEL AUTO'} tone={serverHealth?.modelReady?'good':'purple'}/><StatusChip label={live?'CONTEXT LIVE':'NO CONTEXT'} tone={live?'good':'neutral'}/></View>} />
        <Text style={s.pageIntro}>This is not a generic chat box. NEXUS can call live network tools, expose its execution trace and organise the answer around evidence, inference, risk and next checks.</Text>

        <View style={[s.agentGrid,wide&&{flexDirection:'row'}]}>
          <View style={s.agentMain}>
            <LinearGradient colors={['#18161F','#101015']} style={s.agentComposer}>
              <View style={s.agentComposerTop}><View><Text style={s.panelOverline}>COMMAND SURFACE</Text><Text style={s.agentComposerTitle}>What should NEXUS investigate?</Text></View><View style={s.miniOrb}><Orb size={82} active={busy||!!run&&['thinking','resuming'].includes(run.status)}/></View></View>
              <View style={s.promptBox}>
                <TextInput value={prompt} onChangeText={setPrompt} multiline placeholder="Ask about topology, segmentation, reachability, attacker context or security posture…" placeholderTextColor={P.muted2} style={s.promptInput}/>
                <Pressable onPress={submit} disabled={busy} style={[s.execute,busy&&{opacity:.65}]}>{busy?<ThinkingDots/>:<><Text style={s.executeText}>EXECUTE</Text><Icon name="arrow-up-right" size={14} color="#0B0A0F"/></>}</Pressable>
              </View>
              <View style={s.quickGrid}>{[
                ['shield','Investigate alerts','Review the current security analysis and explain every alert with evidence.'],
                ['share-2','Map trust zones','Explain the current topology, trust zones and observed versus inferred links.'],
                ['activity','Health review','Analyse the live network health and tell me what needs attention.'],
                ['eye','Locate attacker','Locate ATTACKER-PC, show its VLAN and interface, and distinguish simulation markers from proof.'],
              ].map(([icon,title,q])=><Pressable key={title} onPress={()=>setPrompt(q)} style={s.quickCard}><View style={s.quickIcon}><Icon name={icon as IconName} size={14} color={P.lilac}/></View><View style={{flex:1}}><Text style={s.quickTitle}>{title}</Text><Text style={s.quickText} numberOfLines={2}>{q}</Text></View></Pressable>)}</View>
            </LinearGradient>

            {run&&<View style={s.runPanel}>
              <View style={s.runHead}><View><Text style={s.panelOverline}>EXECUTION TRACE</Text><Text style={s.runPrompt}>{run.prompt}</Text></View><StatusChip label={run.status.toUpperCase()} tone={run.status==='completed'?'good':run.status==='failed'?'danger':'purple'}/></View>
              <View style={s.traceList}>{run.events.map((e,i)=><View key={e.id} style={s.traceItem}><View style={s.traceRail}><View style={[s.traceDot,{backgroundColor:e.kind==='error'?P.coral:e.kind==='success'?P.mint:P.lilac}]}/>{i<run.events.length-1&&<View style={s.traceStem}/>}</View><View style={{flex:1}}><View style={s.traceHead}><Text style={s.traceTitle}>{e.title}</Text><Text style={s.traceIndex}>{String(i+1).padStart(2,'0')}</Text></View>{!!e.detail&&<Text style={s.traceDetail}>{e.detail}</Text>}</View></View>)}</View>
              {run.status==='thinking'&&<View style={s.reasoning}><ThinkingDots/><Text style={s.reasoningText}>NEXUS is evaluating live context…</Text></View>}
              {!!run.answer&&<View style={s.answer}><Text style={s.panelOverline}>OPERATOR RESPONSE</Text><OperatorResponse text={run.answer}/></View>}
              {!!run.error&&<View style={s.errorBox}><Icon name="alert-triangle" size={16} color={P.coral}/><View style={{flex:1}}><Text style={s.errorTitle}>Agent interrupted</Text><Text style={s.errorText}>{run.error}</Text></View></View>}
            </View>}
          </View>

          <View style={s.agentSide}>
            <View style={s.contextCard}>
              <Text style={s.panelOverline}>LIVE CONTEXT</Text><Text style={s.contextTitle}>What the agent can see</Text>
              {[
                ['server','Network devices',String(shown.deviceCount),live],
                ['monitor','Observed hosts',String(security?.hostCount??0),!!security],
                ['share-2','Topology graph',topology?'Ready':'Waiting',!!topology],
                ['shield','Security analysis',security?'Ready':'Waiting',!!security],
              ].map(([icon,label,value,ready])=><View key={String(label)} style={s.contextRow}><View style={s.contextIcon}><Icon name={icon as IconName} size={14} color={ready?P.mint:P.muted}/></View><Text style={s.contextLabel}>{label}</Text><Text style={[s.contextValue,{color:ready?P.text:P.muted}]}>{value}</Text></View>)}
            </View>

            <View style={s.contextCard}>
              <Text style={s.panelOverline}>MODEL</Text><Text style={s.contextTitle}>{serverHealth?.model||'Auto-select'}</Text><Text style={s.contextText}>Local Ollama workflow with network tools and evidence-aware prompting.</Text>
              <View style={s.modelBadge}><ScanRing/><Text style={s.modelBadgeText}>{serverHealth?.modelReady?'READY':'FALLBACK ENABLED'}</Text></View>
            </View>
          </View>
        </View>
      </>}

      {page==='settings' && <>
        <SectionTitle overline="LOCAL CONNECTION" title="Connect NEXUS to your lab" />
        <Text style={s.pageIntro}>The web UI talks to your local Node gateway. Packet Tracer stays open with NEXUS-CTRL Real World Access listening on port 58000.</Text>
        <View style={[s.settingsGrid,wide&&{flexDirection:'row'}]}>
          <View style={s.settingsMain}>
            <View style={s.panel}>
              <Text style={s.fieldLabel}>Gateway address</Text>
              <TextInput value={editEndpoint} onChangeText={setEditEndpoint} autoCapitalize="none" style={s.field} placeholder="http://localhost:8787" placeholderTextColor={P.muted2}/>
              <Text style={s.fieldLabel}>Pairing code</Text>
              <TextInput value={editPair} onChangeText={setEditPair} autoCapitalize="none" secureTextEntry style={s.field} placeholder="Paste the code printed by npm run server" placeholderTextColor={P.muted2}/>
              <Pressable onPress={connect} disabled={busy} style={s.connectButton}>{busy?<ActivityIndicator color="#0B0A0F"/>:<><Icon name="link" size={15} color="#0B0A0F"/><Text style={s.connectText}>CONNECT LIVE LAB</Text></>}</Pressable>
            </View>
          </View>
          <View style={s.settingsSide}>
            <View style={s.connectionCard}><View style={s.connectionIcon}><Icon name="radio" size={18} color={live?P.mint:P.muted}/></View><Text style={s.connectionTitle}>{live?'Packet Tracer connected':'Waiting for connection'}</Text><Text style={s.connectionText}>{live?'Controller :58000 · live telemetry enabled':'Enter the gateway and pairing code to unlock live data.'}</Text><StatusChip label={live?'CONNECTED':'OFFLINE'} tone={live?'good':'neutral'}/></View>
            <View style={s.connectionCard}><View style={s.connectionIcon}><Icon name="cpu" size={18} color={serverHealth?.modelReady?P.lilac:P.muted}/></View><Text style={s.connectionTitle}>{serverHealth?.model||'Local model'}</Text><Text style={s.connectionText}>NEXUS will auto-fallback to an installed Ollama model if the requested model is unavailable.</Text><StatusChip label={serverHealth?.modelReady?'AI READY':'AUTO FALLBACK'} tone={serverHealth?.modelReady?'purple':'neutral'}/></View>
          </View>
        </View>
      </>}
    </ScrollView>

    {!desktop&&<View style={s.mobileNav}>{nav.map(item=><Pressable key={item.id} onPress={()=>setPage(item.id)} style={s.mobileNavItem}><Icon name={item.icon} size={17} color={page===item.id?P.mint:P.muted}/><Text style={[s.mobileNavText,page===item.id&&{color:P.text}]}>{item.label}</Text></Pressable>)}</View>}
  </SafeAreaView>;
}

export default function App() {
  return <SafeAreaProvider><AppContent/></SafeAreaProvider>;
}

const s = StyleSheet.create({
  root:{flex:1,backgroundColor:P.bg},
  bgOrbA:{position:'absolute',width:520,height:520,borderRadius:320,backgroundColor:'#241735',opacity:.48,right:-260,top:-260},
  bgOrbB:{position:'absolute',width:420,height:420,borderRadius:260,backgroundColor:'#143128',opacity:.26,left:-220,bottom:-260},
  header:{height:78,borderBottomWidth:1,borderBottomColor:P.border,backgroundColor:'rgba(11,10,15,.96)',paddingHorizontal:26,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:18},
  brand:{flexDirection:'row',alignItems:'center',gap:11},logo:{width:40,height:40,borderRadius:13,alignItems:'center',justifyContent:'center'},logoText:{color:'#0B0A0F',fontSize:24,fontWeight:'900'},brandName:{color:P.text,fontSize:17,fontWeight:'900',letterSpacing:2.4},brandSub:{color:P.muted,fontSize:6.8,fontWeight:'800',letterSpacing:1.1,marginTop:3},
  tabs:{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'#121116',borderWidth:1,borderColor:P.border,borderRadius:14,padding:4},
  tab:{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:12,paddingVertical:9,borderRadius:10},tabActive:{backgroundColor:'#211D29'},tabText:{color:P.muted,fontSize:9.5,fontWeight:'800'},tabTextActive:{color:P.text},
  headerRight:{flexDirection:'row',alignItems:'center',gap:9},iconButton:{width:36,height:36,borderRadius:11,borderWidth:1,borderColor:P.border,backgroundColor:P.panel,alignItems:'center',justifyContent:'center'},
  statusChip:{flexDirection:'row',alignItems:'center',gap:7,borderWidth:1,borderRadius:20,paddingHorizontal:10,paddingVertical:6},statusDot:{width:6,height:6,borderRadius:6},statusText:{fontSize:7.5,fontWeight:'900',letterSpacing:.8},
  notice:{marginHorizontal:20,marginTop:12,borderWidth:1,borderColor:'#5A472F',backgroundColor:'#211B13',borderRadius:12,padding:11,flexDirection:'row',alignItems:'center',gap:9},noticeText:{flex:1,color:'#EBCB99',fontSize:9.5},
  scroll:{padding:24,paddingBottom:90,maxWidth:1500,width:'100%',alignSelf:'center'},
  sectionHead:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',gap:14,marginBottom:16},overline:{color:P.mint,fontSize:8,fontWeight:'900',letterSpacing:1.7},sectionTitle:{color:P.text,fontSize:26,fontWeight:'900',marginTop:5,letterSpacing:-.4},pageIntro:{color:P.text2,fontSize:10.5,lineHeight:17,maxWidth:760,marginTop:-7,marginBottom:20},
  heroGrid:{gap:14,marginBottom:14},heroMain:{flex:1.6,minHeight:330,borderWidth:1,borderColor:P.borderStrong,borderRadius:28,padding:28,justifyContent:'center'},heroBadge:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:20},heroBadgeDot:{width:7,height:7,borderRadius:7,backgroundColor:P.mint},heroBadgeText:{color:P.mintSoft,fontSize:8,fontWeight:'900',letterSpacing:1.5},heroTitle:{color:P.text,fontSize:42,lineHeight:50,fontWeight:'900',letterSpacing:-1.2},heroTitleAccent:{color:P.lilacSoft},heroText:{color:P.text2,fontSize:11.5,lineHeight:19,maxWidth:650,marginTop:14},heroActions:{flexDirection:'row',gap:10,marginTop:24,flexWrap:'wrap'},
  primary:{backgroundColor:P.mint,borderRadius:12,paddingHorizontal:16,paddingVertical:12,flexDirection:'row',alignItems:'center',gap:9},primaryText:{color:'#0B0A0F',fontSize:9.5,fontWeight:'900',letterSpacing:.6},secondary:{borderWidth:1,borderColor:'#51455F',backgroundColor:'#17151D',borderRadius:12,paddingHorizontal:16,paddingVertical:12,flexDirection:'row',alignItems:'center',gap:8},secondaryText:{color:P.lilacSoft,fontSize:9.5,fontWeight:'900',letterSpacing:.5},
  pulseCard:{flex:1,minWidth:300,borderWidth:1,borderColor:P.border,borderRadius:28,backgroundColor:P.panel,padding:20},pulseTop:{flexDirection:'row',justifyContent:'space-between',gap:12,alignItems:'flex-start'},pulseTitle:{color:P.text,fontSize:16,fontWeight:'900',marginTop:5},orbWrap:{alignItems:'center',justifyContent:'center',flex:1,minHeight:190},pulseFooter:{flexDirection:'row',justifyContent:'space-around',borderTopWidth:1,borderTopColor:P.border,paddingTop:14},pulseNumber:{color:P.text,fontSize:21,fontWeight:'900',textAlign:'center'},pulseLabel:{color:P.muted,fontSize:8.5,marginTop:3,textAlign:'center'},
  metricGrid:{gap:10,marginBottom:24},metric:{flex:1,minHeight:126,borderWidth:1,borderColor:P.border,backgroundColor:P.panel,borderRadius:18,padding:16},metricTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},metricIcon:{width:34,height:34,borderRadius:10,alignItems:'center',justifyContent:'center'},metricTrend:{fontSize:7,fontWeight:'900',letterSpacing:.8},metricValue:{color:P.text,fontSize:25,fontWeight:'900',marginTop:15},metricLabel:{color:P.muted,fontSize:9.5,marginTop:4},
  dashboardLower:{gap:14},dashboardMain:{flex:1.65,minWidth:0},dashboardSide:{flex:1,minWidth:290,gap:14},textButton:{flexDirection:'row',alignItems:'center',gap:7},textButtonText:{color:P.mint,fontSize:8,fontWeight:'900',letterSpacing:.8},
  queueCard:{borderWidth:1,borderColor:P.border,backgroundColor:P.panel,borderRadius:20,padding:10},queueItem:{flexDirection:'row',alignItems:'center',gap:10,padding:10,borderBottomWidth:1,borderBottomColor:'#24212B'},queueIcon:{width:34,height:34,borderRadius:10,alignItems:'center',justifyContent:'center'},queueTitle:{color:P.text,fontSize:9.5,fontWeight:'900'},queueText:{color:P.muted,fontSize:8,lineHeight:12,marginTop:3},clearState:{alignItems:'center',padding:26},clearTitle:{color:P.text,fontSize:11,fontWeight:'900',marginTop:9},clearText:{color:P.muted,fontSize:8.5,lineHeight:14,marginTop:4,textAlign:'center'},
  aiLaunchCard:{borderWidth:1,borderColor:'#4A365D',backgroundColor:'#1B1524',borderRadius:20,padding:17},aiLaunchOverline:{color:P.lilac,fontSize:8,fontWeight:'900',letterSpacing:1.5},aiLaunchTitle:{color:P.text,fontSize:17,fontWeight:'900',marginTop:7},aiLaunchText:{color:'#9B8EA9',fontSize:9,lineHeight:14,marginTop:7},aiLaunchButton:{marginTop:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderWidth:1,borderColor:'#5B436F',borderRadius:11,padding:10},aiLaunchButtonText:{color:P.lilacSoft,fontSize:8,fontWeight:'900',letterSpacing:.7},
  pageActions:{flexDirection:'row',alignItems:'center',gap:9,flexWrap:'wrap',justifyContent:'flex-end'},incidentButton:{flexDirection:'row',alignItems:'center',gap:7,borderWidth:1,borderColor:P.borderStrong,backgroundColor:P.panel,borderRadius:12,paddingHorizontal:12,paddingVertical:9},incidentButtonActive:{borderColor:'#6E3144',backgroundColor:'#25131A'},incidentButtonText:{color:P.text,fontSize:8.5,fontWeight:'900',letterSpacing:.7},
  relationshipPanel:{marginTop:14,borderWidth:1,borderColor:P.border,backgroundColor:P.panel,borderRadius:20,padding:15},relationshipHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},relationshipTitle:{color:P.text,fontSize:11,fontWeight:'900'},relationshipCount:{color:P.muted,fontSize:8},relationshipGrid:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:12},relationshipChip:{flexDirection:'row',alignItems:'center',gap:7,borderWidth:1,borderColor:'#302B37',backgroundColor:'#111116',borderRadius:10,paddingHorizontal:10,paddingVertical:8},relationshipDot:{width:6,height:6,borderRadius:6,backgroundColor:P.mint},relationshipText:{color:P.text2,fontSize:8.5},relationshipSource:{color:P.muted2,fontSize:7,textTransform:'uppercase'},
  securityGrid:{gap:14},securityMain:{flex:1.5,minWidth:0,gap:14},securitySide:{flex:1,minWidth:300,gap:12},panel:{borderWidth:1,borderColor:P.border,backgroundColor:P.panel,borderRadius:20,padding:16},panelHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10,marginBottom:10},panelOverline:{color:P.mint,fontSize:7.5,fontWeight:'900',letterSpacing:1.4},panelTitle:{color:P.text,fontSize:14,fontWeight:'900',marginTop:5},panelMeta:{color:P.muted,fontSize:8},
  alertRow:{flexDirection:'row',alignItems:'center',gap:11,borderWidth:1,borderColor:'#4A3C2F',backgroundColor:'#1C1813',borderRadius:14,padding:12,marginTop:8},alertRowCritical:{borderColor:'#5E3040',backgroundColor:'#211318'},alertScan:{width:34,alignItems:'center'},alertHead:{flexDirection:'row',justifyContent:'space-between',gap:10,alignItems:'center'},alertTitle:{color:P.text,fontSize:9.5,fontWeight:'900',flex:1},alertSeverity:{fontSize:7.2,fontWeight:'900',letterSpacing:.7},alertDetail:{color:P.muted,fontSize:8.4,lineHeight:13,marginTop:4},traceButton:{borderWidth:1,borderColor:'#39443F',backgroundColor:'#121714',borderRadius:9,paddingHorizontal:8,paddingVertical:7,flexDirection:'row',alignItems:'center',gap:5},traceText:{color:P.mint,fontSize:7,fontWeight:'900'},
  timelineItem:{flexDirection:'row',gap:11,minHeight:46},timelineTrack:{width:17,alignItems:'center'},timelineDot:{width:7,height:7,borderRadius:7,backgroundColor:P.mint,marginTop:5},timelineStem:{width:1,flex:1,backgroundColor:'#312B38',marginTop:4},timelineRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},timelineTime:{color:P.text2,fontSize:8.8,fontWeight:'800'},timelinePosture:{fontSize:7,fontWeight:'900',letterSpacing:.7},timelineText:{color:P.muted,fontSize:8,marginTop:3},
  playbook:{borderWidth:1,borderColor:'#44354F',borderRadius:20,padding:16},playbookTitle:{color:P.text,fontSize:17,fontWeight:'900',marginTop:6},playbookText:{color:'#968A9E',fontSize:8.8,lineHeight:14,marginTop:7,marginBottom:10},playbookAction:{flexDirection:'row',alignItems:'center',gap:9,borderWidth:1,borderColor:'#312A39',backgroundColor:'#111116',borderRadius:12,padding:10,marginTop:7},playbookIcon:{width:30,height:30,borderRadius:9,backgroundColor:'#17231F',alignItems:'center',justifyContent:'center'},playbookActionText:{flex:1,color:P.text2,fontSize:8.8,fontWeight:'800'},
  plan:{borderWidth:1,borderColor:'#453A2D',backgroundColor:'#1A1713',borderRadius:18,padding:14},planHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',gap:10},planRisk:{color:P.amber,fontSize:7,fontWeight:'900',letterSpacing:.7},planTitle:{color:P.text,fontSize:10.5,fontWeight:'900',marginTop:4,maxWidth:210},planSummary:{color:P.muted,fontSize:8.2,lineHeight:13,marginTop:8},codeBox:{backgroundColor:'#0D0D11',borderWidth:1,borderColor:'#302B37',borderRadius:10,padding:9,marginTop:9},codeLine:{color:P.mintSoft,fontSize:7.8,lineHeight:13,fontFamily:'monospace'},planButtons:{flexDirection:'row',gap:8,marginTop:9},reject:{flex:1,borderWidth:1,borderColor:'#5A3140',borderRadius:9,padding:9,alignItems:'center'},rejectText:{color:'#FFA0B3',fontSize:7.5,fontWeight:'900'},approve:{flex:1,backgroundColor:P.mint,borderRadius:9,padding:9,alignItems:'center'},approveText:{color:'#0B0A0F',fontSize:7.5,fontWeight:'900'},planNote:{color:P.muted2,fontSize:7.2,lineHeight:11,marginTop:8},
  agentGrid:{gap:14},agentMain:{flex:1.65,minWidth:0},agentSide:{flex:1,minWidth:290,gap:12},agentComposer:{borderWidth:1,borderColor:P.borderStrong,borderRadius:24,padding:18},agentComposerTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},agentComposerTitle:{color:P.text,fontSize:20,fontWeight:'900',marginTop:5},miniOrb:{width:90,alignItems:'center'},promptBox:{marginTop:14,borderWidth:1,borderColor:'#443A50',backgroundColor:'#0F0F14',borderRadius:16,padding:10,flexDirection:'row',alignItems:'center',gap:10},promptInput:{flex:1,minHeight:60,maxHeight:130,color:P.text,fontSize:10.5,lineHeight:17,paddingHorizontal:4},execute:{minWidth:95,height:40,borderRadius:11,backgroundColor:P.mint,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:7,paddingHorizontal:12},executeText:{color:'#0B0A0F',fontSize:8,fontWeight:'900',letterSpacing:.7},quickGrid:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:10},quickCard:{flexGrow:1,flexBasis:250,minWidth:230,flexDirection:'row',alignItems:'center',gap:9,borderWidth:1,borderColor:'#312B38',backgroundColor:'#131218',borderRadius:12,padding:10},quickIcon:{width:30,height:30,borderRadius:9,backgroundColor:'#211B2C',alignItems:'center',justifyContent:'center'},quickTitle:{color:P.text2,fontSize:8.8,fontWeight:'900'},quickText:{color:P.muted,fontSize:7.6,lineHeight:11,marginTop:2},
  runPanel:{marginTop:12,borderWidth:1,borderColor:P.border,backgroundColor:P.panel,borderRadius:20,padding:16},runHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',gap:12},runPrompt:{color:P.text,fontSize:12.5,fontWeight:'900',marginTop:5,maxWidth:760},traceList:{marginTop:14},traceItem:{flexDirection:'row',gap:10,minHeight:48},traceRail:{width:18,alignItems:'center'},traceDot:{width:7,height:7,borderRadius:7,marginTop:5},traceStem:{width:1,flex:1,backgroundColor:'#332D3A',marginTop:4},traceHead:{flexDirection:'row',justifyContent:'space-between',gap:10},traceTitle:{color:P.text2,fontSize:9,fontWeight:'900'},traceIndex:{color:P.muted2,fontSize:7.5,fontWeight:'900'},traceDetail:{color:P.muted,fontSize:8,lineHeight:12.5,marginTop:4},reasoning:{flexDirection:'row',alignItems:'center',gap:9,borderWidth:1,borderColor:'#303A35',backgroundColor:'#111713',borderRadius:11,padding:10,marginTop:8},reasoningText:{color:'#8EB7A9',fontSize:8.5},
  answer:{marginTop:12,borderWidth:1,borderColor:'#453754',backgroundColor:'#17131D',borderRadius:15,padding:13},answerBody:{color:P.text2,fontSize:9.5,lineHeight:16,marginTop:8},responseGrid:{gap:8,marginTop:9},responseCard:{borderWidth:1,borderColor:'#302B38',backgroundColor:'#111116',borderRadius:11,padding:10},responseRisk:{borderColor:'#5B3B31',backgroundColor:'#1B1512'},responseHead:{flexDirection:'row',alignItems:'center',gap:7,marginBottom:6},responseIcon:{width:24,height:24,borderRadius:8,backgroundColor:'#1C1B22',alignItems:'center',justifyContent:'center'},responseLabel:{color:P.mintSoft,fontSize:7.5,fontWeight:'900',letterSpacing:1},responseText:{color:P.text2,fontSize:8.7,lineHeight:14},
  errorBox:{marginTop:10,flexDirection:'row',gap:9,borderWidth:1,borderColor:'#5A2E3D',backgroundColor:'#201217',borderRadius:12,padding:11},errorTitle:{color:'#FFD6DF',fontSize:9,fontWeight:'900'},errorText:{color:'#B98793',fontSize:8,lineHeight:12,marginTop:3},
  contextCard:{borderWidth:1,borderColor:P.border,backgroundColor:P.panel,borderRadius:18,padding:15},contextTitle:{color:P.text,fontSize:14,fontWeight:'900',marginTop:6},contextText:{color:P.muted,fontSize:8.5,lineHeight:13.5,marginTop:6},contextRow:{flexDirection:'row',alignItems:'center',gap:9,paddingVertical:9,borderBottomWidth:1,borderBottomColor:'#25212B'},contextIcon:{width:28,height:28,borderRadius:9,backgroundColor:'#1B1A20',alignItems:'center',justifyContent:'center'},contextLabel:{flex:1,color:P.text2,fontSize:8.8},contextValue:{fontSize:8.2,fontWeight:'900'},modelBadge:{marginTop:12,flexDirection:'row',alignItems:'center',gap:8},modelBadgeText:{color:P.mint,fontSize:7.5,fontWeight:'900',letterSpacing:.7},
  settingsGrid:{gap:14},settingsMain:{flex:1.3},settingsSide:{flex:1,gap:12},fieldLabel:{color:P.text2,fontSize:9,fontWeight:'800',marginTop:9},field:{borderWidth:1,borderColor:'#393241',backgroundColor:'#0F0F14',borderRadius:11,padding:12,color:P.text,marginTop:7},connectButton:{marginTop:16,backgroundColor:P.mint,borderRadius:11,padding:12,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},connectText:{color:'#0B0A0F',fontSize:9,fontWeight:'900',letterSpacing:.6},connectionCard:{borderWidth:1,borderColor:P.border,backgroundColor:P.panel,borderRadius:18,padding:16},connectionIcon:{width:38,height:38,borderRadius:12,backgroundColor:'#1D1C22',alignItems:'center',justifyContent:'center'},connectionTitle:{color:P.text,fontSize:12,fontWeight:'900',marginTop:12},connectionText:{color:P.muted,fontSize:8.5,lineHeight:13.5,marginTop:6,marginBottom:12},
  mobileNav:{height:66,borderTopWidth:1,borderTopColor:P.border,backgroundColor:'#0D0C11',flexDirection:'row',alignItems:'center',justifyContent:'space-around',paddingHorizontal:4},mobileNavItem:{flex:1,alignItems:'center',gap:4},mobileNavText:{color:P.muted,fontSize:7.5,fontWeight:'800'},
});
