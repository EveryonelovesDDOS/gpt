import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Orb } from './src/Orb';
import { AnimatedBackdrop, ScanRing, ThinkingDots } from './src/NexusVisuals';
import { TopologyScene } from './src/TopologyScene';
import { AgentRun, DefensiveAction, Health, IncidentTimeline, NetworkHealth, NetworkTopology, SecurityAnalysis } from './src/types';
import { checkHealth, decideAction, defaultEndpoint, getActions, getIncidents, getNetworkHealth, getNetworkTopology, getRun, getSecurityAnalysis, proposeAction, startRun } from './src/api';

type Page = 'dashboard' | 'topology' | 'security' | 'agent' | 'settings';
type IconName = keyof typeof Feather.glyphMap;

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

function Icon({ name, size = 18, color = '#CFE2FF' }: { name: IconName; size?: number; color?: string }) {
  return <Feather name={name} size={size} color={color} />;
}

function Pill({ text, good = true }: { text: string; good?: boolean }) {
  return <View style={[st.pill, { borderColor: good ? '#2E806E' : '#735A33' }]}>
    <View style={[st.dot, { backgroundColor: good ? '#61F4C3' : '#FFB86B' }]} />
    <Text style={[st.pillText, { color: good ? '#9EF7D8' : '#FFD3A3' }]}>{text}</Text>
  </View>;
}

function Metric({ label, value, icon }: { label: string; value: string | number; icon: IconName }) {
  return <View style={st.metric}>
    <View style={st.metricIcon}><Icon name={icon} size={17} color="#76BBFF" /></View>
    <Text style={st.metricValue}>{value}</Text>
    <Text style={st.metricLabel}>{label}</Text>
  </View>;
}

function OperatorResponse({ text }: { text: string }) {
  const labels = ['OBSERVED','INFERRED','RISK','NEXT CHECKS','CONFIDENCE'];
  const sections: { label: string; body: string }[] = [];
  let current = { label: 'NEXUS RESPONSE', body: '' };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const found = labels.find(label => line.toUpperCase().replace(/[:#*]/g,'').trim() === label);
    if (found) {
      if (current.body.trim()) sections.push(current);
      current = { label: found, body: '' };
    } else {
      current.body += (current.body ? '\n' : '') + raw;
    }
  }
  if (current.body.trim()) sections.push(current);
  if (sections.length <= 1) return <Text style={st.answerTextV2}>{text}</Text>;
  const icons: Record<string, IconName> = { OBSERVED:'eye', INFERRED:'git-merge', RISK:'alert-triangle', 'NEXT CHECKS':'check-square', CONFIDENCE:'target' };
  return <View style={st.operatorGrid}>
    {sections.map((section, index) => <View key={section.label + index} style={[st.operatorCard, section.label === 'RISK' && st.operatorRisk]}>
      <View style={st.operatorHead}><View style={st.operatorIcon}><Icon name={icons[section.label] || 'cpu'} size={13} color={section.label === 'RISK' ? '#FF9A75' : '#61F4C3'} /></View><Text style={st.operatorLabel}>{section.label}</Text></View>
      <Text style={st.operatorBody}>{section.body.trim()}</Text>
    </View>)}
  </View>;
}

function AppContent() {
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const [page, setPage] = useState<Page>('dashboard');
  const [endpoint, setEndpoint] = useState(defaultEndpoint());
  const [pair, setPair] = useState('');
  const [editEndpoint, setEditEndpoint] = useState(defaultEndpoint());
  const [editPair, setEditPair] = useState('');
  const [serverHealth, setServerHealth] = useState<Health | null>(null);
  const [network, setNetwork] = useState<NetworkHealth | null>(null);
  const [topology, setTopology] = useState<NetworkTopology | null>(null);
  const [security, setSecurity] = useState<SecurityAnalysis | null>(null);
  const [incidents, setIncidents] = useState<IncidentTimeline | null>(null);
  const [actions, setActions] = useState<DefensiveAction[]>([]);
  const [incidentMode, setIncidentMode] = useState(false);
  const [connected, setConnected] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [run, setRun] = useState<AgentRun | null>(null);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem('@nexus/endpoint'), AsyncStorage.getItem('@nexus/pair')]).then(([e, p]) => {
      if (e) { setEndpoint(e); setEditEndpoint(e); }
      if (p) { setPair(p); setEditPair(p); }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!connected) return;
    const timer = setInterval(() => {
      Promise.all([getNetworkHealth(endpoint, pair), getNetworkTopology(endpoint, pair), getSecurityAnalysis(endpoint, pair), getIncidents(endpoint, pair), getActions(endpoint, pair)]).then(([n,t,s,i,a]) => { setNetwork(n); setTopology(t); setSecurity(s); setIncidents(i); setActions(a.proposals); }).catch(() => {});
    }, 4000);
    return () => clearInterval(timer);
  }, [connected, endpoint, pair]);

  useEffect(() => {
    if (!run?.id || !['thinking', 'approval', 'resuming'].includes(run.status)) return;
    const timer = setInterval(() => getRun(endpoint, pair, run.id).then(setRun).catch(e => setNotice(e.message)), 900);
    return () => clearInterval(timer);
  }, [run?.id, run?.status, endpoint, pair]);

  const shown = network || previewNetwork;
  const live = connected && !!network;
  const statusText = shown.allReachable ? 'OPERATIONAL' : 'ATTENTION REQUIRED';
  const statusGood = shown.allReachable;

  async function connect() {
    setBusy(true); setNotice('');
    try {
      const url = editEndpoint.trim().replace(/\/$/, '');
      const token = editPair.trim();
      const h = await checkHealth(url);
      const [n, t, s, i, a] = await Promise.all([getNetworkHealth(url, token), getNetworkTopology(url, token), getSecurityAnalysis(url, token), getIncidents(url, token), getActions(url, token)]);
      setEndpoint(url); setPair(token); setServerHealth(h); setNetwork(n); setTopology(t); setSecurity(s); setIncidents(i); setActions(a.proposals); setConnected(true);
      await AsyncStorage.multiSet([['@nexus/endpoint', url], ['@nexus/pair', token]]);
      setNotice('Connected to NEXUS and Packet Tracer Controller.');
      setPage('dashboard');
    } catch (e) {
      setConnected(false);
      setNotice(e instanceof Error ? e.message : 'Connection failed');
    } finally { setBusy(false); }
  }

  async function refreshNetwork() {
    if (!connected) return setPage('settings');
    setBusy(true);
    try { const [n,t,s,i,a] = await Promise.all([getNetworkHealth(endpoint, pair), getNetworkTopology(endpoint, pair), getSecurityAnalysis(endpoint, pair), getIncidents(endpoint, pair), getActions(endpoint, pair)]); setNetwork(n); setTopology(t); setSecurity(s); setIncidents(i); setActions(a.proposals); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Refresh failed'); }
    finally { setBusy(false); }
  }

  async function createDefensivePlan(kind: string) {
    if (!connected) { setNotice('Connect NEXUS first.'); setPage('settings'); return; }
    setBusy(true); setNotice('');
    try {
      const proposal = await proposeAction(endpoint, pair, kind);
      setActions(prev => [proposal, ...prev.filter(x => x.id !== proposal.id)]);
      setNotice('Defensive change plan prepared. Review the commands before approval.');
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Unable to create defensive plan'); }
    finally { setBusy(false); }
  }

  async function decideDefensivePlan(id: string, approved: boolean) {
    setBusy(true); setNotice('');
    try {
      const proposal = await decideAction(endpoint, pair, id, approved);
      setActions(prev => prev.map(x => x.id === id ? proposal : x));
      setNotice(approved
        ? 'Plan approved for preview. Automatic IOS execution remains disabled until a verified write transport is configured.'
        : 'Plan rejected. No network change was made.');
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Unable to update defensive plan'); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (!connected) { setNotice('Connect NEXUS in Settings first.'); setPage('settings'); return; }
    if (prompt.trim().length < 3) return;
    setBusy(true); setNotice('');
    try {
      setRun(await startRun(endpoint, pair, prompt.trim()));
      setPrompt('');
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Unable to start agent'); }
    finally { setBusy(false); }
  }

  const navigation = useMemo(() => [
    { id: 'dashboard' as Page, label: 'Dashboard', icon: 'activity' as IconName },
    { id: 'topology' as Page, label: 'Topology', icon: 'git-branch' as IconName },
    { id: 'security' as Page, label: 'Security', icon: 'shield' as IconName },
    { id: 'agent' as Page, label: 'AI Agent', icon: 'command' as IconName },
    { id: 'settings' as Page, label: 'Settings', icon: 'sliders' as IconName },
  ], []);

  const sidebar = <View style={st.sidebar}>
    <View style={st.brand}>
      <LinearGradient colors={['#61F4C3', '#8B5CF6']} style={st.brandLogo}><Text style={st.brandN}>N</Text></LinearGradient>
      <View><Text style={st.brandName}>NEXUS</Text><Text style={st.brandSub}>AI NETWORK COMMAND CENTER</Text></View>
    </View>
    <Text style={st.navLabel}>COMMAND</Text>
    {navigation.map(n => <Pressable key={n.id} onPress={() => setPage(n.id)} style={[st.navItem, page === n.id && st.navActive]}>
      <Icon name={n.icon} color={page === n.id ? '#61F4C3' : '#8B93A7'} />
      <Text style={[st.navText, page === n.id && { color: '#F7F5FF' }]}>{n.label}</Text>
    </Pressable>)}
    <View style={st.sideFoot}>
      <Pill text={live ? 'PACKET TRACER LIVE' : 'PREVIEW DATA'} good={live} />
      <Text style={st.sideHint}>{live ? 'Controller :58000 connected' : 'Connect your local gateway to read live devices.'}</Text>
    </View>
  </View>;

  return <SafeAreaView style={st.root} edges={['top', 'bottom']}>
    <StatusBar barStyle="light-content" />
    <AnimatedBackdrop />
    <View style={st.glow} />
    <View style={st.shell}>
      {desktop && sidebar}
      <View style={st.main}>
        <View style={st.topbar}>
          <View style={st.topLeft}>
            {!desktop && <LinearGradient colors={['#61F4C3', '#8B5CF6']} style={st.mobileLogo}><Text style={st.mobileN}>N</Text></LinearGradient>}
            <View><Text style={st.topTitle}>{desktop ? navigation.find(x => x.id === page)?.label : 'NEXUS'}</Text><Text style={st.topSub}>AURORA V3 · {live ? 'LIVE TELEMETRY' : 'PREVIEW MODE'}</Text></View>
          </View>
          <Pill text={live ? 'LIVE' : 'PREVIEW'} good={live} />
        </View>

        {!!notice && <Pressable onPress={() => setNotice('')} style={st.notice}><Icon name="info" color="#FFD58A" size={16} /><Text style={st.noticeText}>{notice}</Text><Icon name="x" color="#8B9AB0" size={15} /></Pressable>}

        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
          {page === 'dashboard' && <>
            <View style={st.hero}>
              <View style={st.heroCopy}>
                <Text style={st.eyebrow}>NETWORK INTELLIGENCE · LOCAL FIRST</Text>
                <Text style={st.heroTitle}>Your network.{"\n"}<Text style={st.heroAccent}>Under one command.</Text></Text>
                <Text style={st.heroBody}>NEXUS reads your Cisco Packet Tracer controller, tracks discovered infrastructure and gives the local AI agent real network context.</Text>
                <View style={st.heroActions}>
                  <Pressable onPress={() => setPage('agent')} style={st.primary}><Text style={st.primaryText}>Ask NEXUS</Text><Icon name="arrow-up-right" color="#06111C" /></Pressable>
                  <Pressable onPress={refreshNetwork} style={st.secondary}><Icon name="refresh-cw" size={15} color="#8CC8FF" /><Text style={st.secondaryText}>Refresh</Text></Pressable>
                </View>
              </View>
              <View style={st.heroOrb}><Orb size={desktop ? 245 : 190} active={live} /></View>
            </View>

            <View style={st.healthHead}>
              <View><Text style={st.eyebrow}>NETWORK HEALTH</Text><Text style={st.sectionTitle}>{statusText}</Text></View>
              <Pill text={live ? 'REAL-TIME' : 'SAMPLE'} good={statusGood} />
            </View>
            <View style={[st.metrics, desktop && { flexDirection: 'row' }]}>
              <Metric label="Discovered devices" value={shown.deviceCount} icon="server" />
              <Metric label="Online" value={shown.reachableCount} icon="check-circle" />
              <Metric label="Offline" value={shown.unreachableCount} icon="alert-circle" />
              <Metric label="Controller" value={shown.controllerOnline ? 'UP' : 'DOWN'} icon="radio" />
            </View>

            <View style={st.sectionRow}><Text style={st.sectionTitle}>Infrastructure</Text><Text style={st.timestamp}>{live ? 'Auto-refresh 4s' : 'Preview'}</Text></View>
            <View style={[st.deviceGrid, desktop && { flexDirection: 'row' }]}>
              {shown.devices.map(device => <View key={device.id} style={st.deviceCard}>
                <View style={st.deviceTop}>
                  <View style={st.deviceIcon}><Icon name={device.role === 'edge-router' ? 'share-2' : 'layers'} size={22} color="#7DC3FF" /></View>
                  <Pill text={device.status.toUpperCase()} good={device.status === 'online'} />
                </View>
                <Text style={st.deviceName}>{device.name}</Text>
                <Text style={st.deviceRole}>{device.role.replace('-', ' ').toUpperCase()}</Text>
                <View style={st.rule} />
                <View style={st.infoRow}><Text style={st.infoKey}>Management IP</Text><Text style={st.infoValue}>{device.managementIp}</Text></View>
                <View style={st.infoRow}><Text style={st.infoKey}>Interfaces</Text><Text style={st.infoValue}>{device.interfaces}</Text></View>
                <View style={st.infoRow}><Text style={st.infoKey}>MAC</Text><Text style={st.infoValue}>{device.macAddress || '—'}</Text></View>
                <View style={st.infoRow}><Text style={st.infoKey}>Reachability</Text><Text style={[st.infoValue, { color: device.status === 'online' ? '#61F4C3' : '#FF6B8A' }]}>{device.reachabilityStatus}</Text></View>
              </View>)}
            </View>

            <View style={st.aiStrip}>
              <View style={st.aiIcon}><Icon name="zap" color="#B79CFF" /></View>
              <View style={{ flex: 1 }}><Text style={st.aiTitle}>AI network analysis is ready</Text><Text style={st.aiText}>Ask about discovered devices, reachability and overall health. NEXUS uses live controller data instead of guessing.</Text></View>
              <Pressable onPress={() => { setPrompt('Analyse my current Packet Tracer network health and tell me what needs attention.'); setPage('agent'); }}><Icon name="arrow-right" color="#B79CFF" /></Pressable>
            </View>
          </>}

          {page === 'topology' && <>
            <View style={st.sectionRow}>
              <View><Text style={st.eyebrow}>LIVE NETWORK MAP</Text><Text style={st.sectionTitle}>Topology intelligence</Text></View>
              <View style={st.topologyActions}>
                <Pressable onPress={() => setIncidentMode(x => !x)} style={[st.modeButton, incidentMode && st.modeButtonActive]}><Icon name={incidentMode ? 'x' : 'alert-triangle'} color={incidentMode ? '#FF9CAA' : '#86CFFF'} size={14} /><Text style={[st.modeButtonText, incidentMode && { color:'#FF9CAA' }]}>{incidentMode ? 'Exit incident mode' : 'Incident mode'}</Text></Pressable>
                <Pill text={topology ? 'LIVE GRAPH' : 'NO LIVE DATA'} good={!!topology} />
              </View>
            </View>
            <Text style={st.heroBody}>Interactive nodes, animated traffic, VLAN context and threat focus. Incident mode highlights the simulated attacker path without presenting a lab marker as proof of compromise.</Text>
            <View style={{ marginTop:18 }}><TopologyScene topology={topology} incidentMode={incidentMode} /></View>
            <View style={st.legendCard}>
              <View style={st.sectionRow}><Text style={st.legendTitle}>Link intelligence</Text><Text style={st.timestamp}>{topology?.links.length || 0} relationships</Text></View>
              {(topology?.links || []).slice(0,12).map(l => <View key={l.id} style={st.linkRow}><View style={st.linkDot} /><Text style={st.linkText}>{l.label || 'Network link'}</Text><Text style={st.linkSource}>{l.sourceType}</Text></View>)}
            </View>
          </>}

          {page === 'security' && <>
            <View style={st.sectionRow}><View><Text style={st.eyebrow}>DEFENSIVE MONITORING</Text><Text style={st.sectionTitle}>Security operations</Text></View><Pill text={(security?.posture || 'unknown').toUpperCase()} good={security?.posture === 'normal'} /></View>
            <Text style={st.heroBody}>Live lab telemetry, incident context and approval-gated defensive planning. NEXUS labels simulation heuristics as heuristics and does not silently push IOS changes.</Text>
            <View style={[st.metrics, desktop && { flexDirection: 'row' }]}>
              <Metric label="Observed hosts" value={security?.hostCount ?? 0} icon="monitor" />
              <Metric label="Active alerts" value={security?.alertCount ?? 0} icon="shield" />
              <Metric label="Critical" value={security?.criticalCount ?? 0} icon="alert-octagon" />
              <Metric label="Timeline frames" value={incidents?.timeline.length ?? 0} icon="clock" />
            </View>

            <View style={[st.socGrid, desktop && { flexDirection:'row' }]}>
              <View style={st.socMain}>
                <View style={st.securityPanel}>
                  <View style={st.sectionRow}><Text style={st.securityTitle}>Detection feed</Text><Pressable onPress={refreshNetwork}><Icon name="refresh-cw" color="#7DC3FF" size={16} /></Pressable></View>
                  {(security?.alerts || []).length ? (security?.alerts || []).map(a => <View key={a.id} style={[st.alertCard, a.severity === 'critical' && st.alertCritical]}>
                    <View style={st.alertIcon}><ScanRing danger={a.severity === 'critical'} /></View>
                    <View style={{ flex: 1 }}><View style={st.alertHead}><Text style={st.alertTitle}>{a.title}</Text><Text style={st.alertSeverity}>{a.severity.toUpperCase()}</Text></View><Text style={st.alertDetail}>{a.detail}</Text></View>
                    <Pressable onPress={() => { setIncidentMode(true); setPage('topology'); }} style={st.inspectButton}><Text style={st.inspectButtonText}>TRACE</Text><Icon name="arrow-up-right" color="#7CCBFF" size={13} /></Pressable>
                  </View>) : <View style={st.emptySecure}><Icon name="shield" color="#68E1C4" size={28} /><Text style={st.emptySecureTitle}>No active NEXUS alerts</Text><Text style={st.emptySecureText}>No current heuristic matched. This does not mean the network has been exhaustively scanned.</Text></View>}
                </View>

                <View style={st.timelinePanel}>
                  <View style={st.sectionRow}><Text style={st.securityTitle}>Incident timeline</Text><Text style={st.timestamp}>rolling snapshots</Text></View>
                  {(incidents?.timeline || []).slice(0,8).map((frame, index) => <View key={frame.id} style={st.timelineRow}>
                    <View style={st.timelineTrack}><View style={[st.timelineDot, frame.posture === 'critical' && st.timelineDotCritical]} />{index < Math.min((incidents?.timeline.length || 0),8)-1 && <View style={st.timelineStem} />}</View>
                    <View style={{flex:1}}><View style={st.timelineHead}><Text style={st.timelineTime}>{new Date(frame.at).toLocaleTimeString()}</Text><Text style={[st.timelinePosture, frame.posture === 'critical' && {color:'#FF8291'}]}>{frame.posture.toUpperCase()}</Text></View><Text style={st.timelineDetail}>{frame.alertCount} alert{frame.alertCount === 1 ? '' : 's'} observed in this snapshot</Text></View>
                  </View>)}
                </View>
              </View>

              <View style={st.socSide}>
                <View style={st.containmentPanel}>
                  <Text style={st.eyebrow}>CONTAINMENT PLANNER</Text><Text style={st.containmentTitle}>Defensive actions</Text><Text style={st.containmentText}>Generate a reversible IOS change plan. Approval records your decision, but execution remains preview-only until a verified write transport is connected.</Text>
                  {[
                    ['isolate_guest_from_server','shield','Isolate GUEST → SERVER'],
                    ['quarantine_attacker_port','slash','Quarantine attacker port'],
                    ['protect_management','lock','Protect MANAGEMENT'],
                  ].map(([kind,icon,label]) => <Pressable key={kind} onPress={() => createDefensivePlan(kind)} style={st.containmentAction}><View style={st.containmentIcon}><Icon name={icon as IconName} color="#7FCBFF" size={15} /></View><Text style={st.containmentActionText}>{label}</Text><Icon name="plus" color="#66809A" size={14} /></Pressable>)}
                </View>

                {actions.slice(0,3).map(a => <View key={a.id} style={[st.planCard, a.status !== 'pending' && st.planCardDone]}>
                  <View style={st.sectionRow}><View><Text style={st.planOverline}>{a.risk.toUpperCase()} RISK</Text><Text style={st.planTitle}>{a.title}</Text></View><Pill text={a.status.toUpperCase()} good={a.status === 'approved-preview'} /></View>
                  <Text style={st.planSummary}>{a.summary}</Text>
                  <View style={st.codeBox}>{a.commands.map((line,i)=><Text key={i} style={st.codeLine}>{line}</Text>)}</View>
                  {a.status === 'pending' && <View style={st.planActions}><Pressable onPress={() => decideDefensivePlan(a.id,false)} style={st.reject}><Text style={st.rejectText}>REJECT</Text></Pressable><Pressable onPress={() => decideDefensivePlan(a.id,true)} style={st.approve}><Text style={st.approveText}>APPROVE PREVIEW</Text></Pressable></View>}
                  <Text style={st.planNote}>{a.note}</Text>
                </View>)}
              </View>
            </View>

            <Pressable onPress={() => { setPrompt('Review the current security analysis, explain every alert with evidence, identify observed versus inferred facts, and recommend the safest defensive next checks.'); setPage('agent'); }} style={st.aiStrip}>
              <View style={st.aiIcon}><Icon name="cpu" color="#B79CFF" /></View><View style={{ flex: 1 }}><Text style={st.aiTitle}>Launch AI incident investigation</Text><Text style={st.aiText}>NEXUS can correlate hosts, topology, segmentation and alert evidence before presenting a structured response.</Text></View><Icon name="arrow-right" color="#B79CFF" />
            </Pressable>
          </>}

          {page === 'agent' && <>
            <View style={[st.agentCommand, desktop && { flexDirection: 'row' }]}>
              <View style={st.agentLeft}>
                <View style={[st.agentHeroV2, !desktop && { flexDirection:'column', alignItems:'stretch' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.eyebrow}>NEXUS COGNITIVE OPS</Text>
                    <Text style={st.agentTitle}>Command the network.{"\n"}<Text style={st.agentAccent}>Watch NEXUS reason.</Text></Text>
                    <Text style={st.heroBody}>Ask in plain language. NEXUS can inspect live devices, hosts, topology, reachability, VLAN context and defensive alerts before it answers.</Text>
                  </View>
                  <View style={st.agentOrbWrap}><Orb size={150} active={busy || !!run && ['thinking','resuming'].includes(run.status)} /></View>
                </View>

                <View style={st.commandBox}>
                  <View style={st.commandPrefix}><Icon name="terminal" color="#71CCFF" size={17} /><Text style={st.commandPrefixText}>NEXUS://</Text></View>
                  <TextInput value={prompt} onChangeText={setPrompt} placeholder="Ask NEXUS to inspect, explain, compare or investigate…" placeholderTextColor="#657A94" multiline style={st.commandInput} />
                  <Pressable onPress={submit} disabled={busy} style={[st.commandSend, busy && { opacity:.65 }]}>{busy ? <ThinkingDots /> : <><Text style={st.commandSendText}>EXECUTE</Text><Icon name="arrow-up-right" color="#06111C" size={16} /></>}</Pressable>
                </View>

                <View style={st.suggestionGrid}>
                  {[
                    ['shield','Investigate alerts','Review the current security analysis, explain every alert with evidence, and recommend defensive next checks without assuming compromise.'],
                    ['git-branch','Explain topology','Explain my current network topology, trust zones and which links are observed versus inferred.'],
                    ['activity','Health check','Analyse my current Packet Tracer network health and tell me what needs attention.'],
                    ['eye','Find attacker host','Locate ATTACKER-PC, show its VLAN, interface and surrounding context, and clearly distinguish simulation markers from proof.'],
                  ].map(([icon,title,q]) => <Pressable key={title} onPress={() => setPrompt(q)} style={st.suggestionCard}>
                    <View style={st.suggestionIcon}><Icon name={icon as IconName} color="#7CC8FF" size={16} /></View>
                    <View style={{flex:1}}><Text style={st.suggestionTitle}>{title}</Text><Text style={st.suggestionSub}>{q}</Text></View>
                    <Icon name="arrow-up-right" color="#5A708B" size={15} />
                  </Pressable>)}
                </View>
              </View>

              <View style={[st.agentRight, desktop && { width:310 }]}>
                <View style={st.cognitivePanel}>
                  <View style={st.cognitiveHead}><Text style={st.cognitiveLabel}>COGNITIVE STATUS</Text><Pill text={serverHealth?.modelReady ? 'MODEL READY' : 'MODEL FALLBACK'} good={!!serverHealth?.modelReady} /></View>
                  <View style={st.cognitiveModel}><ScanRing /><View><Text style={st.cognitiveModelName}>{serverHealth?.model || 'Auto-select'}</Text><Text style={st.cognitiveModelMeta}>Local Ollama · tool-enabled workflow</Text></View></View>
                  <View style={st.cognitiveRule} />
                  {[
                    ['Database','Packet Tracer context', live ? 'LIVE' : 'WAITING'],
                    ['GitBranch','Topology reasoning', topology ? 'READY' : 'WAITING'],
                    ['Shield','Security analysis', security ? 'READY' : 'WAITING'],
                  ].map(([k,label,status],i) => <View key={label} style={st.cognitiveRow}><ScanRing danger={false} /><Text style={st.cognitiveText}>{label}</Text><Text style={st.cognitiveStatus}>{status}</Text></View>)}
                </View>
              </View>
            </View>

            {run && <View style={st.runConsole}>
              <View style={st.runConsoleHead}>
                <View><Text style={st.runOverline}>EXECUTION TRACE</Text><Text style={st.runTitleV2}>{run.prompt}</Text></View>
                <Pill text={run.status.toUpperCase()} good={run.status === 'completed'} />
              </View>
              <View style={st.traceRail} />
              {run.events.map((e,i) => <View key={e.id} style={st.traceRow}>
                <View style={st.traceIcon}><Icon name={e.kind === 'error' ? 'alert-triangle' : e.kind === 'tool' ? 'cpu' : e.kind === 'success' ? 'check' : 'circle'} size={13} color={e.kind === 'error' ? '#FF8291' : '#78C8FF'} /></View>
                <View style={{flex:1}}><View style={st.traceHead}><Text style={st.traceTitle}>{e.title}</Text><Text style={st.traceIndex}>0{i+1}</Text></View>{!!e.detail && <Text style={st.traceDetail}>{e.detail}</Text>}</View>
              </View>)}
              {run.status === 'thinking' && <View style={st.reasoningBar}><ThinkingDots /><Text style={st.reasoningText}>NEXUS is evaluating live network context…</Text></View>}
              {!!run.answer && <LinearGradient colors={['#162C27','#251937']} style={st.answerV2}><Text style={st.answerLabel}>NEXUS RESPONSE</Text><OperatorResponse text={run.answer} /></LinearGradient>}
              {!!run.error && <View style={st.errorPanel}><Icon name="alert-triangle" color="#FF8B98" /><View style={{flex:1}}><Text style={st.errorTitle}>Agent interrupted</Text><Text style={st.errorText}>{run.error}</Text></View></View>}
            </View>}
          </>}

          {page === 'settings' && <>
            <Text style={st.eyebrow}>LOCAL CONNECTION</Text><Text style={st.sectionTitle}>Connect NEXUS.</Text><Text style={st.heroBody}>Use the pairing code printed by the Node gateway. Packet Tracer must stay open with NEXUS-CTRL Real World Access listening on port 58000.</Text>
            <View style={st.settingsCard}>
              <Text style={st.fieldLabel}>Gateway address</Text>
              <TextInput value={editEndpoint} onChangeText={setEditEndpoint} autoCapitalize="none" style={st.field} placeholder="http://localhost:8787" placeholderTextColor="#61738C" />
              <Text style={st.fieldLabel}>Pairing code</Text>
              <TextInput value={editPair} onChangeText={setEditPair} autoCapitalize="none" secureTextEntry style={st.field} placeholder="Paste code from terminal" placeholderTextColor="#61738C" />
              <Pressable onPress={connect} disabled={busy} style={st.connect}>{busy ? <ActivityIndicator color="#06111C" /> : <><Icon name="link" color="#06111C" /><Text style={st.connectText}>Connect live network</Text></>}</Pressable>
              <View style={st.connection}><View style={[st.dot, { backgroundColor: live ? '#61F4C3' : '#FFB86B' }]} /><Text style={st.connectionText}>{live ? `Connected · ${shown.deviceCount} devices · ${serverHealth?.modelReady ? 'AI ready' : 'AI model not ready'}` : 'Not connected · dashboard is showing preview data'}</Text></View>
            </View>
          </>}
        </ScrollView>

        {!desktop && <View style={st.bottomNav}>{navigation.map(n => <Pressable key={n.id} onPress={() => setPage(n.id)} style={st.bottomItem}><Icon name={n.icon} color={page === n.id ? '#61F4C3' : '#6E819A'} /><Text style={[st.bottomText, page === n.id && { color: '#DDEEFF' }]}>{n.label}</Text></Pressable>)}</View>}
      </View>
    </View>
  </SafeAreaView>;
}

export default function App() {
  return <SafeAreaProvider><AppContent /></SafeAreaProvider>;
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0C0D12' }, glow: { position: 'absolute', width: 700, height: 700, borderRadius: 400, backgroundColor: '#2E145C', opacity: .35, right: -360, top: -350 },
  shell: { flex: 1, flexDirection: 'row', maxWidth: 1500, width: '100%', alignSelf: 'center' }, sidebar: { width: 268, borderRightWidth: 1, borderRightColor: '#332844', backgroundColor: 'rgba(18,17,25,.94)', padding: 24 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 50 }, brandLogo: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, brandN: { color: '#06111C', fontSize: 25, fontWeight: '900' }, brandName: { color: '#F3F7FF', fontWeight: '900', letterSpacing: 3, fontSize: 18 }, brandSub: { color: '#62758E', fontSize: 6.5, marginTop: 3, letterSpacing: 1.1 },
  navLabel: { color: '#5E718A', letterSpacing: 2, fontSize: 9, fontWeight: '800', marginBottom: 12 }, navItem: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 13, borderRadius: 13, marginBottom: 6 }, navActive: { backgroundColor: '#241F31', borderWidth: 1, borderColor: '#7057A8' }, navText: { color: '#74859C', fontSize: 13, fontWeight: '700' }, sideFoot: { marginTop: 'auto' }, sideHint: { color: '#65778F', fontSize: 10, lineHeight: 16, marginTop: 12 },
  main: { flex: 1, minWidth: 0 }, topbar: { minHeight: 78, borderBottomWidth: 1, borderBottomColor: '#30273C', paddingHorizontal: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, topLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 }, topTitle: { color: '#EDF5FF', fontSize: 15, fontWeight: '800' }, topSub: { color: '#5D718A', fontSize: 8, letterSpacing: 1.5, marginTop: 3, fontWeight: '800' }, mobileLogo: { width: 31, height: 31, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, mobileN: { color: '#06111C', fontWeight: '900', fontSize: 19 },
  scroll: { padding: 26, paddingBottom: 70 }, notice: { margin: 16, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#604F31', backgroundColor: '#2B241A', flexDirection: 'row', alignItems: 'center', gap: 9 }, noticeText: { flex: 1, color: '#FFD3A3', fontSize: 11 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 }, dot: { width: 6, height: 6, borderRadius: 4 }, pillText: { fontSize: 9, letterSpacing: .8, fontWeight: '900' },
  hero: { backgroundColor: '#17141F', borderWidth: 1, borderColor: '#4A3A63', borderRadius: 32, padding: 30, minHeight: 320, flexDirection: 'row', overflow: 'hidden', marginBottom: 32 }, heroCopy: { flex: 1, justifyContent: 'center', zIndex: 2 }, eyebrow: { color: '#72B9FA', fontSize: 9, letterSpacing: 2.1, fontWeight: '900', marginBottom: 13 }, heroTitle: { color: '#F1F6FF', fontSize: 38, lineHeight: 47, fontWeight: '900', letterSpacing: -1 }, heroAccent: { color: '#75BCFF' }, heroBody: { color: '#93A5BD', fontSize: 12, lineHeight: 20, maxWidth: 520, marginTop: 12 }, heroActions: { flexDirection: 'row', gap: 10, marginTop: 22 }, primary: { backgroundColor: '#61F4C3', borderRadius: 11, paddingHorizontal: 17, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, primaryText: { color: '#06111C', fontWeight: '900', fontSize: 12 }, secondary: { borderWidth: 1, borderColor: '#34506B', borderRadius: 11, paddingHorizontal: 15, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }, secondaryText: { color: '#A8CFFF', fontWeight: '800', fontSize: 11 }, heroOrb: { justifyContent: 'center', alignItems: 'center', minWidth: 230 },
  healthHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 15 }, sectionTitle: { color: '#EFF6FF', fontSize: 24, fontWeight: '900' }, sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, timestamp: { color: '#64778F', fontSize: 10 },
  metrics: { gap: 11, marginBottom: 30 }, metric: { flex: 1, minHeight: 120, borderWidth: 1, borderColor: '#34303E', backgroundColor: '#16151D', borderRadius: 20, padding: 17 }, metricIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#202C2B', alignItems: 'center', justifyContent: 'center', marginBottom: 15 }, metricValue: { color: '#F2F7FF', fontSize: 25, fontWeight: '900' }, metricLabel: { color: '#73869E', fontSize: 10, marginTop: 5, letterSpacing: .4 },
  deviceGrid: { gap: 12, marginTop: 14, marginBottom: 28 }, deviceCard: { flex: 1, backgroundColor: '#16151D', borderWidth: 1, borderColor: '#24374E', borderRadius: 24, padding: 19 }, deviceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, deviceIcon: { width: 43, height: 43, borderRadius: 13, backgroundColor: '#162C44', alignItems: 'center', justifyContent: 'center' }, deviceName: { color: '#F2F7FF', fontWeight: '900', fontSize: 20, marginTop: 17 }, deviceRole: { color: '#69809A', fontWeight: '800', fontSize: 9, letterSpacing: 1.5, marginTop: 4 }, rule: { height: 1, backgroundColor: '#213249', marginVertical: 16 }, infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginVertical: 5 }, infoKey: { color: '#6E819A', fontSize: 10 }, infoValue: { color: '#C9D8EA', fontSize: 10, fontWeight: '700' },
  aiStrip: { borderRadius: 17, borderWidth: 1, borderColor: '#744EA3', backgroundColor: '#20172A', padding: 17, flexDirection: 'row', alignItems: 'center', gap: 13 }, aiIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: '#3A2453', alignItems: 'center', justifyContent: 'center' }, aiTitle: { color: '#ECE8FF', fontWeight: '900', fontSize: 13 }, aiText: { color: '#958CAD', fontSize: 10, lineHeight: 16, marginTop: 4 },
  agentHero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }, promptCard: { backgroundColor: '#15131B', borderWidth: 1, borderColor: '#5B4678', borderRadius: 18, flexDirection: 'row', alignItems: 'center', paddingLeft: 15 }, prompt: { flex: 1, minHeight: 58, maxHeight: 130, color: '#F7F5FF', fontSize: 13, paddingVertical: 13 }, send: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#78BDFF', alignItems: 'center', justifyContent: 'center', marginRight: 10 }, quickRow: { gap: 8, marginTop: 12, marginBottom: 22 }, quick: { borderWidth: 1, borderColor: '#25384F', backgroundColor: '#15131B', borderRadius: 12, padding: 12 }, quickText: { color: '#91A8C1', fontSize: 11 },
  runCard: { borderRadius: 19, borderWidth: 1, borderColor: '#263950', backgroundColor: '#101A28', padding: 18 }, runTitle: { color: '#EDF5FF', fontWeight: '800', fontSize: 13, flex: 1 }, event: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1D2D41' }, eventTitle: { color: '#DDE9F8', fontSize: 11, fontWeight: '800' }, eventText: { color: '#7E91A8', fontSize: 10, lineHeight: 16, marginTop: 3 }, answer: { backgroundColor: '#13253A', borderRadius: 13, padding: 15, marginTop: 14 }, answerLabel: { color: '#61F4C3', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 }, answerText: { color: '#D6E3F2', fontSize: 12, lineHeight: 20, marginTop: 8 },
  agentCommand: { gap: 18, alignItems: 'stretch' },
  agentLeft: { flex: 1, minWidth: 0 },
  agentRight: { width: '100%' },
  agentHeroV2: { minHeight: 230, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#4E3A63', backgroundColor: '#17141F', borderRadius: 24, padding: 24, overflow: 'hidden' },
  agentTitle: { color: '#F2F7FF', fontSize: 31, lineHeight: 39, fontWeight: '900', letterSpacing: -.7 },
  agentAccent: { color: '#61F4C3' },
  agentOrbWrap: { minWidth: 150, alignItems: 'center', justifyContent: 'center' },
  commandBox: { marginTop: 16, borderWidth: 1, borderColor: '#5F4A77', backgroundColor: '#100F15', borderRadius: 22, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#53B9FF', shadowOpacity: .08, shadowRadius: 22 },
  commandPrefix: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingLeft: 4 },
  commandPrefixText: { color: '#6FCBFF', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  commandInput: { flex: 1, minHeight: 50, maxHeight: 120, color: '#EEF7FF', fontSize: 12.5, lineHeight: 18, paddingVertical: 10 },
  commandSend: { minWidth: 105, height: 42, borderRadius: 12, backgroundColor: '#61F4C3', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 14 },
  commandSendText: { color: '#06111C', fontWeight: '900', fontSize: 10, letterSpacing: .8 },
  suggestionGrid: { marginTop: 12, gap: 9 },
  suggestionCard: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: '#223750', backgroundColor: '#0F1926', borderRadius: 15, padding: 13 },
  suggestionIcon: { width: 35, height: 35, borderRadius: 11, backgroundColor: '#152C43', alignItems: 'center', justifyContent: 'center' },
  suggestionTitle: { color: '#E7F1FD', fontSize: 11, fontWeight: '900' },
  suggestionSub: { color: '#71849A', fontSize: 8.8, lineHeight: 13, marginTop: 3 },
  cognitivePanel: { borderWidth: 1, borderColor: '#293E57', backgroundColor: '#101A28', borderRadius: 20, padding: 16, minHeight: 260 },
  cognitiveHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cognitiveLabel: { color: '#6D839E', fontSize: 8.5, fontWeight: '900', letterSpacing: 1.5 },
  cognitiveModel: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 20 },
  cognitiveModelName: { color: '#EAF4FF', fontSize: 12, fontWeight: '900' },
  cognitiveModelMeta: { color: '#667C95', fontSize: 8.5, marginTop: 3 },
  cognitiveRule: { height: 1, backgroundColor: '#1F3045', marginVertical: 16 },
  cognitiveRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8 },
  cognitiveText: { flex: 1, color: '#A9BAD0', fontSize: 10 },
  cognitiveStatus: { color: '#68DCC1', fontSize: 8, fontWeight: '900', letterSpacing: .7 },
  runConsole: { marginTop: 18, borderWidth: 1, borderColor: '#3A3248', backgroundColor: '#121117', borderRadius: 20, padding: 18, overflow: 'hidden' },
  runConsoleHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 },
  runOverline: { color: '#A78BFA', fontSize: 8.5, fontWeight: '900', letterSpacing: 1.7, marginBottom: 6 },
  runTitleV2: { color: '#EAF3FF', fontSize: 14, fontWeight: '900', maxWidth: 760 },
  traceRail: { height: 1, backgroundColor: '#20334A', marginVertical: 16 },
  traceRow: { flexDirection: 'row', gap: 11, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#182A3D' },
  traceIcon: { width: 28, height: 28, borderRadius: 9, borderWidth: 1, borderColor: '#294866', backgroundColor: '#14263A', alignItems: 'center', justifyContent: 'center' },
  traceHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  traceTitle: { color: '#DCEAF9', fontSize: 10.5, fontWeight: '900' },
  traceIndex: { color: '#4E6782', fontSize: 8, fontWeight: '900' },
  traceDetail: { color: '#778CA5', fontSize: 9.2, lineHeight: 14.5, marginTop: 4 },
  reasoningBar: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#122437', borderRadius: 12, padding: 12, marginTop: 12 },
  reasoningText: { color: '#83A8C8', fontSize: 9.5 },
  operatorGrid:{ gap:9, marginTop:10 }, operatorCard:{ borderWidth:1,borderColor:'#29445F',backgroundColor:'#0E1C2B',borderRadius:12,padding:12 }, operatorRisk:{ borderColor:'#6D4536',backgroundColor:'#201813' },
  operatorHead:{ flexDirection:'row',alignItems:'center',gap:8,marginBottom:7 }, operatorIcon:{ width:25,height:25,borderRadius:8,backgroundColor:'#152B42',alignItems:'center',justifyContent:'center' }, operatorLabel:{ color:'#8ED1FF',fontSize:8,fontWeight:'900',letterSpacing:1.1 },
  operatorBody:{ color:'#C9D9E9',fontSize:10.2,lineHeight:17 },
  answerV2: { marginTop: 14, borderRadius: 15, padding: 16, borderWidth: 1, borderColor: '#345A7C' },
  answerTextV2: { color: '#D9E9F8', fontSize: 11.5, lineHeight: 19, marginTop: 8 },
  errorPanel: { marginTop: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1, borderColor: '#6A3742', backgroundColor: '#25161B', borderRadius: 13, padding: 13 },
  errorTitle: { color: '#FFD6DB', fontSize: 10.5, fontWeight: '900' },
  errorText: { color: '#C59098', fontSize: 9.3, lineHeight: 14, marginTop: 4 },
  topologyActions: { flexDirection:'row', alignItems:'center', gap:10, flexWrap:'wrap', justifyContent:'flex-end' },
  modeButton: { flexDirection:'row', alignItems:'center', gap:7, borderWidth:1, borderColor:'#2F4B67', backgroundColor:'#0F1B2A', borderRadius:12, paddingHorizontal:11, paddingVertical:8 },
  modeButtonActive: { borderColor:'#743744', backgroundColor:'#25151B' }, modeButtonText:{ color:'#8CCBFF', fontSize:9, fontWeight:'900' },
  socGrid:{ gap:14, marginBottom:18 }, socMain:{ flex:1.55, minWidth:0 }, socSide:{ flex:1, minWidth:280, gap:12 },
  inspectButton:{ borderWidth:1,borderColor:'#31516D',borderRadius:10,paddingHorizontal:9,paddingVertical:7,flexDirection:'row',alignItems:'center',gap:5 },
  inspectButtonText:{ color:'#61F4C3',fontSize:7.5,fontWeight:'900',letterSpacing:.6 },
  timelinePanel:{ borderWidth:1,borderColor:'#293B51',backgroundColor:'#0F1825',borderRadius:18,padding:17,marginTop:12 },
  timelineRow:{ flexDirection:'row',gap:12,minHeight:48 }, timelineTrack:{ width:18,alignItems:'center' }, timelineDot:{ width:8,height:8,borderRadius:8,backgroundColor:'#6FCBFF',marginTop:5 }, timelineDotCritical:{ backgroundColor:'#FF6D7F' }, timelineStem:{ width:1,flex:1,backgroundColor:'#263B53',marginTop:4 },
  timelineHead:{ flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12 }, timelineTime:{ color:'#C7D7E9',fontSize:9.5,fontWeight:'800' }, timelinePosture:{ color:'#73D6BE',fontSize:7.5,fontWeight:'900',letterSpacing:.7 }, timelineDetail:{ color:'#6E839A',fontSize:8.8,marginTop:4 },
  containmentPanel:{ borderWidth:1,borderColor:'#30435B',backgroundColor:'#101A28',borderRadius:18,padding:16 }, containmentTitle:{ color:'#F0F6FF',fontSize:17,fontWeight:'900' }, containmentText:{ color:'#788CA4',fontSize:9.2,lineHeight:14.5,marginTop:6,marginBottom:12 },
  containmentAction:{ flexDirection:'row',alignItems:'center',gap:9,borderWidth:1,borderColor:'#24394F',backgroundColor:'#0C1622',borderRadius:12,padding:10,marginTop:7 },
  containmentIcon:{ width:30,height:30,borderRadius:9,backgroundColor:'#162C42',alignItems:'center',justifyContent:'center' }, containmentActionText:{ flex:1,color:'#B7C8DB',fontSize:9.5,fontWeight:'800' },
  planCard:{ borderWidth:1,borderColor:'#4A3D2D',backgroundColor:'#1D1914',borderRadius:17,padding:15 }, planCardDone:{ borderColor:'#2F4D51',backgroundColor:'#111C22' }, planOverline:{ color:'#FFBE77',fontSize:7.5,fontWeight:'900',letterSpacing:.7 }, planTitle:{ color:'#EEF5FD',fontSize:11,fontWeight:'900',marginTop:4,maxWidth:210 }, planSummary:{ color:'#8C9BAD',fontSize:8.8,lineHeight:14,marginTop:9 },
  codeBox:{ borderRadius:11,backgroundColor:'#081018',borderWidth:1,borderColor:'#24384C',padding:10,marginTop:10 }, codeLine:{ color:'#9EF7D8',fontSize:8.2,lineHeight:14,fontFamily:'monospace' },
  planActions:{ flexDirection:'row',gap:8,marginTop:10 }, reject:{ flex:1,borderWidth:1,borderColor:'#5E3A43',borderRadius:10,padding:9,alignItems:'center' }, rejectText:{ color:'#FF9EAA',fontSize:8,fontWeight:'900' }, approve:{ flex:1,backgroundColor:'#61F4C3',borderRadius:10,padding:9,alignItems:'center' }, approveText:{ color:'#06111C',fontSize:8,fontWeight:'900' }, planNote:{ color:'#62758B',fontSize:7.8,lineHeight:12,marginTop:9 },
  settingsCard: { backgroundColor: '#101A28', borderWidth: 1, borderColor: '#273950', borderRadius: 19, padding: 20, marginTop: 24, maxWidth: 650 }, fieldLabel: { color: '#DDE8F5', fontWeight: '800', fontSize: 11, marginTop: 10 }, field: { color: '#EAF3FF', backgroundColor: '#0F0E14', borderWidth: 1, borderColor: '#2A3F58', borderRadius: 11, padding: 13, marginTop: 8, marginBottom: 12 }, connect: { backgroundColor: '#61F4C3', borderRadius: 11, padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 }, connectText: { color: '#06111C', fontWeight: '900', fontSize: 12 }, connection: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 15 }, connectionText: { color: '#8194AB', fontSize: 10 },
  topologyBoard: { marginTop: 22, borderRadius: 22, borderWidth: 1, borderColor: '#263A52', backgroundColor: '#0D1826', padding: 20, overflow: 'hidden' },
  topologyCoreRow: { flexDirection: 'row', gap: 12, justifyContent: 'center', flexWrap: 'wrap' },
  topologyNode: { minWidth: 170, borderWidth: 1, borderColor: '#2C4A68', backgroundColor: '#132238', borderRadius: 16, padding: 15, alignItems: 'center' },
  topologyNodeEdge: { borderColor: '#514776', backgroundColor: '#19182C' },
  topologyNodeIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#17304B', alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  topologyNodeName: { color: '#F0F6FF', fontSize: 13, fontWeight: '900' }, topologyNodeMeta: { color: '#7790AA', fontSize: 9, marginTop: 4 },
  topologyLine: { height: 34, alignItems: 'center', justifyContent: 'center' }, topologyPulse: { width: 2, height: 34, backgroundColor: '#385A7A', borderRadius: 2 },
  hostGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, justifyContent: 'center' },
  hostNode: { width: 145, minHeight: 105, borderWidth: 1, borderColor: '#243A53', backgroundColor: '#111D2C', borderRadius: 14, padding: 12 },
  hostNodeThreat: { borderColor: '#7D3F4B', backgroundColor: '#28151B' }, hostName: { color: '#E7F0FC', fontSize: 11, fontWeight: '800', marginTop: 8 },
  hostMeta: { color: '#758AA3', fontSize: 8.5, marginTop: 4 }, hostVlan: { color: '#7CC4FF', fontSize: 8, fontWeight: '900', marginTop: 8, letterSpacing: .7 },
  legendCard: { marginTop: 14, borderWidth: 1, borderColor: '#24364D', backgroundColor: '#15131B', borderRadius: 16, padding: 16, marginBottom: 24 },
  legendTitle: { color: '#EAF3FF', fontSize: 12, fontWeight: '900', marginBottom: 10 }, linkRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#1A2A3D' },
  linkDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: '#6FC6FF' }, linkText: { flex: 1, color: '#9FB2C8', fontSize: 10 }, linkSource: { color: '#637A94', fontSize: 8, textTransform: 'uppercase' },
  securityPanel: { borderWidth: 1, borderColor: '#293A51', backgroundColor: '#101925', borderRadius: 18, padding: 17, marginBottom: 18 }, securityTitle: { color: '#EEF5FF', fontSize: 14, fontWeight: '900' },
  alertCard: { flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: '#4A3E2B', backgroundColor: '#211C16', borderRadius: 14, padding: 14, marginTop: 10 },
  alertCritical: { borderColor: '#6D3440', backgroundColor: '#25151A' }, alertIcon: { width: 35, height: 35, borderRadius: 10, backgroundColor: '#161C26', alignItems: 'center', justifyContent: 'center' },
  alertHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, alertTitle: { color: '#EEF4FC', fontSize: 11, fontWeight: '900', flex: 1 },
  alertSeverity: { color: '#FFB77A', fontSize: 8, fontWeight: '900', letterSpacing: .8 }, alertDetail: { color: '#9AABBD', fontSize: 9.5, lineHeight: 15, marginTop: 5 },
  emptySecure: { alignItems: 'center', paddingVertical: 28 }, emptySecureTitle: { color: '#DFF8F1', fontSize: 13, fontWeight: '900', marginTop: 10 }, emptySecureText: { color: '#71879F', fontSize: 9.5, lineHeight: 15, marginTop: 5, textAlign: 'center', maxWidth: 360 },
  bottomNav: { height: 66, borderTopWidth: 1, borderTopColor: '#332844', backgroundColor: '#0A131E', flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8 }, bottomItem: { alignItems: 'center', flex: 1 }, bottomText: { color: '#687B95', fontSize: 9, marginTop: 5, fontWeight: '700' },
});
