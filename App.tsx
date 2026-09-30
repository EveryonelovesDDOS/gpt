import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Orb } from './src/Orb';
import { AgentRun, Health, NetworkHealth, NetworkTopology, SecurityAnalysis } from './src/types';
import { checkHealth, defaultEndpoint, getNetworkHealth, getNetworkTopology, getRun, getSecurityAnalysis, startRun } from './src/api';

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
    <View style={[st.dot, { backgroundColor: good ? '#68E1C4' : '#FFC96D' }]} />
    <Text style={[st.pillText, { color: good ? '#8EF0D7' : '#FFD58A' }]}>{text}</Text>
  </View>;
}

function Metric({ label, value, icon }: { label: string; value: string | number; icon: IconName }) {
  return <View style={st.metric}>
    <View style={st.metricIcon}><Icon name={icon} size={17} color="#76BBFF" /></View>
    <Text style={st.metricValue}>{value}</Text>
    <Text style={st.metricLabel}>{label}</Text>
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
      Promise.all([getNetworkHealth(endpoint, pair), getNetworkTopology(endpoint, pair), getSecurityAnalysis(endpoint, pair)]).then(([n,t,s]) => { setNetwork(n); setTopology(t); setSecurity(s); }).catch(() => {});
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
      const [n, t, s] = await Promise.all([getNetworkHealth(url, token), getNetworkTopology(url, token), getSecurityAnalysis(url, token)]);
      setEndpoint(url); setPair(token); setServerHealth(h); setNetwork(n); setTopology(t); setSecurity(s); setConnected(true);
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
    try { const [n,t,s] = await Promise.all([getNetworkHealth(endpoint, pair), getNetworkTopology(endpoint, pair), getSecurityAnalysis(endpoint, pair)]); setNetwork(n); setTopology(t); setSecurity(s); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Refresh failed'); }
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
      <LinearGradient colors={['#79C9FF', '#5572FF']} style={st.brandLogo}><Text style={st.brandN}>N</Text></LinearGradient>
      <View><Text style={st.brandName}>NEXUS</Text><Text style={st.brandSub}>AI NETWORK COMMAND CENTER</Text></View>
    </View>
    <Text style={st.navLabel}>COMMAND</Text>
    {navigation.map(n => <Pressable key={n.id} onPress={() => setPage(n.id)} style={[st.navItem, page === n.id && st.navActive]}>
      <Icon name={n.icon} color={page === n.id ? '#79C1FF' : '#71839B'} />
      <Text style={[st.navText, page === n.id && { color: '#EEF6FF' }]}>{n.label}</Text>
    </Pressable>)}
    <View style={st.sideFoot}>
      <Pill text={live ? 'PACKET TRACER LIVE' : 'PREVIEW DATA'} good={live} />
      <Text style={st.sideHint}>{live ? 'Controller :58000 connected' : 'Connect your local gateway to read live devices.'}</Text>
    </View>
  </View>;

  return <SafeAreaView style={st.root} edges={['top', 'bottom']}>
    <StatusBar barStyle="light-content" />
    <View style={st.glow} />
    <View style={st.shell}>
      {desktop && sidebar}
      <View style={st.main}>
        <View style={st.topbar}>
          <View style={st.topLeft}>
            {!desktop && <LinearGradient colors={['#79C9FF', '#5572FF']} style={st.mobileLogo}><Text style={st.mobileN}>N</Text></LinearGradient>}
            <View><Text style={st.topTitle}>{desktop ? navigation.find(x => x.id === page)?.label : 'NEXUS'}</Text><Text style={st.topSub}>{live ? 'LIVE TELEMETRY' : 'PREVIEW MODE'}</Text></View>
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
                <View style={st.infoRow}><Text style={st.infoKey}>Reachability</Text><Text style={[st.infoValue, { color: device.status === 'online' ? '#68E1C4' : '#FF8E9C' }]}>{device.reachabilityStatus}</Text></View>
              </View>)}
            </View>

            <View style={st.aiStrip}>
              <View style={st.aiIcon}><Icon name="zap" color="#B79CFF" /></View>
              <View style={{ flex: 1 }}><Text style={st.aiTitle}>AI network analysis is ready</Text><Text style={st.aiText}>Ask about discovered devices, reachability and overall health. NEXUS uses live controller data instead of guessing.</Text></View>
              <Pressable onPress={() => { setPrompt('Analyse my current Packet Tracer network health and tell me what needs attention.'); setPage('agent'); }}><Icon name="arrow-right" color="#B79CFF" /></Pressable>
            </View>
          </>}

          {page === 'topology' && <>
            <View style={st.sectionRow}><View><Text style={st.eyebrow}>LIVE NETWORK MAP</Text><Text style={st.sectionTitle}>Topology</Text></View><Pill text={topology ? 'LIVE GRAPH' : 'NO LIVE DATA'} good={!!topology} /></View>
            <Text style={st.heroBody}>This view combines controller-discovered devices and hosts with the known lab backbone. Links marked inferred are derived from the current lab model when Packet Tracer does not expose a direct host attachment.</Text>
            <View style={st.topologyBoard}>
              <View style={st.topologyCoreRow}>
                {(topology?.nodes || []).filter(n => n.kind === 'device').map(n => <View key={n.id} style={[st.topologyNode, n.role === 'edge-router' && st.topologyNodeEdge]}>
                  <View style={st.topologyNodeIcon}><Icon name={n.role === 'edge-router' ? 'share-2' : 'layers'} color="#7BC3FF" size={20} /></View>
                  <Text style={st.topologyNodeName}>{n.label}</Text><Text style={st.topologyNodeMeta}>{n.ip || n.zone}</Text>
                </View>)}
              </View>
              <View style={st.topologyLine}><View style={st.topologyPulse} /></View>
              <View style={st.hostGrid}>
                {(topology?.nodes || []).filter(n => n.kind === 'host').map(n => <View key={n.id} style={[st.hostNode, n.role === 'attacker' && st.hostNodeThreat]}>
                  <Icon name={n.role === 'attacker' ? 'alert-triangle' : 'monitor'} color={n.role === 'attacker' ? '#FF8D9A' : '#79BDFF'} size={17} />
                  <Text style={st.hostName}>{n.label}</Text>
                  <Text style={st.hostMeta}>{n.ip || 'No IP'} · {n.zone}</Text>
                  {n.vlan ? <Text style={st.hostVlan}>VLAN {n.vlan}</Text> : null}
                </View>)}
              </View>
            </View>
            <View style={st.legendCard}><Text style={st.legendTitle}>Link intelligence</Text>{(topology?.links || []).slice(0,12).map(l => <View key={l.id} style={st.linkRow}><View style={st.linkDot} /><Text style={st.linkText}>{l.label || 'Network link'}</Text><Text style={st.linkSource}>{l.sourceType}</Text></View>)}</View>
          </>}

          {page === 'security' && <>
            <View style={st.sectionRow}><View><Text style={st.eyebrow}>DEFENSIVE MONITORING</Text><Text style={st.sectionTitle}>Security posture</Text></View><Pill text={(security?.posture || 'unknown').toUpperCase()} good={security?.posture === 'normal'} /></View>
            <Text style={st.heroBody}>NEXUS combines controller reachability with the lab VLAN plan and explicit simulation markers. These are defensive heuristics, not IDS/IPS verdicts.</Text>
            <View style={[st.metrics, desktop && { flexDirection: 'row' }]}>
              <Metric label="Observed hosts" value={security?.hostCount ?? 0} icon="monitor" />
              <Metric label="Security alerts" value={security?.alertCount ?? 0} icon="shield" />
              <Metric label="Critical" value={security?.criticalCount ?? 0} icon="alert-octagon" />
              <Metric label="High" value={security?.highCount ?? 0} icon="alert-triangle" />
            </View>
            <View style={st.securityPanel}>
              <View style={st.sectionRow}><Text style={st.securityTitle}>Detection feed</Text><Pressable onPress={refreshNetwork}><Icon name="refresh-cw" color="#7DC3FF" size={16} /></Pressable></View>
              {(security?.alerts || []).length ? (security?.alerts || []).map(a => <View key={a.id} style={[st.alertCard, a.severity === 'critical' && st.alertCritical]}>
                <View style={st.alertIcon}><Icon name={a.severity === 'critical' ? 'alert-octagon' : a.severity === 'high' ? 'alert-triangle' : 'info'} color={a.severity === 'critical' ? '#FF7E8D' : a.severity === 'high' ? '#FFC66D' : '#79BDFF'} /></View>
                <View style={{ flex: 1 }}><View style={st.alertHead}><Text style={st.alertTitle}>{a.title}</Text><Text style={st.alertSeverity}>{a.severity.toUpperCase()}</Text></View><Text style={st.alertDetail}>{a.detail}</Text></View>
              </View>) : <View style={st.emptySecure}><Icon name="shield" color="#68E1C4" size={28} /><Text style={st.emptySecureTitle}>No active NEXUS alerts</Text><Text style={st.emptySecureText}>No current heuristic matched. This does not mean the network has been exhaustively scanned.</Text></View>}
            </View>
            <Pressable onPress={() => { setPrompt('Review the current security analysis, explain every alert with evidence, and recommend defensive next checks without assuming compromise.'); setPage('agent'); }} style={st.aiStrip}>
              <View style={st.aiIcon}><Icon name="cpu" color="#B79CFF" /></View><View style={{ flex: 1 }}><Text style={st.aiTitle}>Ask NEXUS to investigate</Text><Text style={st.aiText}>The agent can inspect live hosts, topology, segmentation and security heuristics, then explain what is observed versus inferred.</Text></View><Icon name="arrow-right" color="#B79CFF" />
            </Pressable>
          </>}

          {page === 'agent' && <>
            <View style={st.agentHero}><View><Text style={st.eyebrow}>AGENTIC NETWORK OPS</Text><Text style={st.sectionTitle}>Ask the network directly.</Text><Text style={st.heroBody}>The local model can call NEXUS network tools and reason over the Packet Tracer controller inventory.</Text></View><Orb size={130} active={!!run && ['thinking','resuming'].includes(run.status)} /></View>
            <View style={st.promptCard}>
              <TextInput value={prompt} onChangeText={setPrompt} placeholder="e.g. Analyse my network health…" placeholderTextColor="#687B95" multiline style={st.prompt} />
              <Pressable onPress={submit} disabled={busy} style={st.send}>{busy ? <ActivityIndicator color="#06111C" /> : <Icon name="arrow-up" color="#06111C" />}</Pressable>
            </View>
            <View style={st.quickRow}>
              {['Show me all discovered network devices.', 'Is my Packet Tracer network healthy?', 'Which device is the core switch?'].map(q => <Pressable key={q} onPress={() => setPrompt(q)} style={st.quick}><Text style={st.quickText}>{q}</Text></Pressable>)}
            </View>
            {run && <View style={st.runCard}>
              <View style={st.sectionRow}><Text style={st.runTitle}>{run.prompt}</Text><Pill text={run.status.toUpperCase()} good={run.status === 'completed'} /></View>
              {run.events.map(e => <View key={e.id} style={st.event}><Icon name={e.kind === 'error' ? 'alert-triangle' : e.kind === 'tool' ? 'terminal' : 'circle'} size={14} color="#7DC3FF" /><View style={{ flex: 1 }}><Text style={st.eventTitle}>{e.title}</Text>{!!e.detail && <Text style={st.eventText}>{e.detail}</Text>}</View></View>)}
              {!!run.answer && <View style={st.answer}><Text style={st.answerLabel}>NEXUS</Text><Text style={st.answerText}>{run.answer}</Text></View>}
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
              <View style={st.connection}><View style={[st.dot, { backgroundColor: live ? '#68E1C4' : '#FFC96D' }]} /><Text style={st.connectionText}>{live ? `Connected · ${shown.deviceCount} devices · ${serverHealth?.modelReady ? 'AI ready' : 'AI model not ready'}` : 'Not connected · dashboard is showing preview data'}</Text></View>
            </View>
          </>}
        </ScrollView>

        {!desktop && <View style={st.bottomNav}>{navigation.map(n => <Pressable key={n.id} onPress={() => setPage(n.id)} style={st.bottomItem}><Icon name={n.icon} color={page === n.id ? '#7DC3FF' : '#6E819A'} /><Text style={[st.bottomText, page === n.id && { color: '#DDEEFF' }]}>{n.label}</Text></Pressable>)}</View>}
      </View>
    </View>
  </SafeAreaView>;
}

export default function App() {
  return <SafeAreaProvider><AppContent /></SafeAreaProvider>;
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#07101A' }, glow: { position: 'absolute', width: 700, height: 700, borderRadius: 400, backgroundColor: '#102A4A', opacity: .35, right: -360, top: -350 },
  shell: { flex: 1, flexDirection: 'row', maxWidth: 1500, width: '100%', alignSelf: 'center' }, sidebar: { width: 250, borderRightWidth: 1, borderRightColor: '#1B2A3E', backgroundColor: '#0A121E', padding: 20 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 50 }, brandLogo: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, brandN: { color: '#06111C', fontSize: 25, fontWeight: '900' }, brandName: { color: '#F3F7FF', fontWeight: '900', letterSpacing: 3, fontSize: 18 }, brandSub: { color: '#62758E', fontSize: 6.5, marginTop: 3, letterSpacing: 1.1 },
  navLabel: { color: '#5E718A', letterSpacing: 2, fontSize: 9, fontWeight: '800', marginBottom: 12 }, navItem: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 13, borderRadius: 13, marginBottom: 6 }, navActive: { backgroundColor: '#15283D', borderWidth: 1, borderColor: '#284A69' }, navText: { color: '#74859C', fontSize: 13, fontWeight: '700' }, sideFoot: { marginTop: 'auto' }, sideHint: { color: '#65778F', fontSize: 10, lineHeight: 16, marginTop: 12 },
  main: { flex: 1, minWidth: 0 }, topbar: { minHeight: 72, borderBottomWidth: 1, borderBottomColor: '#182638', paddingHorizontal: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, topLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 }, topTitle: { color: '#EDF5FF', fontSize: 15, fontWeight: '800' }, topSub: { color: '#5D718A', fontSize: 8, letterSpacing: 1.5, marginTop: 3, fontWeight: '800' }, mobileLogo: { width: 31, height: 31, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, mobileN: { color: '#06111C', fontWeight: '900', fontSize: 19 },
  scroll: { padding: 26, paddingBottom: 70 }, notice: { margin: 16, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#604F31', backgroundColor: '#2B241A', flexDirection: 'row', alignItems: 'center', gap: 9 }, noticeText: { flex: 1, color: '#FFD58A', fontSize: 11 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 }, dot: { width: 6, height: 6, borderRadius: 4 }, pillText: { fontSize: 9, letterSpacing: .8, fontWeight: '900' },
  hero: { backgroundColor: '#0E1B2D', borderWidth: 1, borderColor: '#274563', borderRadius: 27, padding: 30, minHeight: 320, flexDirection: 'row', overflow: 'hidden', marginBottom: 32 }, heroCopy: { flex: 1, justifyContent: 'center', zIndex: 2 }, eyebrow: { color: '#72B9FA', fontSize: 9, letterSpacing: 2.1, fontWeight: '900', marginBottom: 13 }, heroTitle: { color: '#F1F6FF', fontSize: 38, lineHeight: 47, fontWeight: '900', letterSpacing: -1 }, heroAccent: { color: '#75BCFF' }, heroBody: { color: '#93A5BD', fontSize: 12, lineHeight: 20, maxWidth: 520, marginTop: 12 }, heroActions: { flexDirection: 'row', gap: 10, marginTop: 22 }, primary: { backgroundColor: '#79BDFF', borderRadius: 11, paddingHorizontal: 17, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, primaryText: { color: '#06111C', fontWeight: '900', fontSize: 12 }, secondary: { borderWidth: 1, borderColor: '#34506B', borderRadius: 11, paddingHorizontal: 15, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }, secondaryText: { color: '#A8CFFF', fontWeight: '800', fontSize: 11 }, heroOrb: { justifyContent: 'center', alignItems: 'center', minWidth: 230 },
  healthHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 15 }, sectionTitle: { color: '#EFF6FF', fontSize: 24, fontWeight: '900' }, sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, timestamp: { color: '#64778F', fontSize: 10 },
  metrics: { gap: 11, marginBottom: 30 }, metric: { flex: 1, minHeight: 120, borderWidth: 1, borderColor: '#203249', backgroundColor: '#101A28', borderRadius: 17, padding: 17 }, metricIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#162B43', alignItems: 'center', justifyContent: 'center', marginBottom: 15 }, metricValue: { color: '#F2F7FF', fontSize: 25, fontWeight: '900' }, metricLabel: { color: '#73869E', fontSize: 10, marginTop: 5, letterSpacing: .4 },
  deviceGrid: { gap: 12, marginTop: 14, marginBottom: 28 }, deviceCard: { flex: 1, backgroundColor: '#101A28', borderWidth: 1, borderColor: '#24374E', borderRadius: 19, padding: 19 }, deviceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, deviceIcon: { width: 43, height: 43, borderRadius: 13, backgroundColor: '#162C44', alignItems: 'center', justifyContent: 'center' }, deviceName: { color: '#F2F7FF', fontWeight: '900', fontSize: 20, marginTop: 17 }, deviceRole: { color: '#69809A', fontWeight: '800', fontSize: 9, letterSpacing: 1.5, marginTop: 4 }, rule: { height: 1, backgroundColor: '#213249', marginVertical: 16 }, infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginVertical: 5 }, infoKey: { color: '#6E819A', fontSize: 10 }, infoValue: { color: '#C9D8EA', fontSize: 10, fontWeight: '700' },
  aiStrip: { borderRadius: 17, borderWidth: 1, borderColor: '#463D6E', backgroundColor: '#18182A', padding: 17, flexDirection: 'row', alignItems: 'center', gap: 13 }, aiIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: '#282143', alignItems: 'center', justifyContent: 'center' }, aiTitle: { color: '#ECE8FF', fontWeight: '900', fontSize: 13 }, aiText: { color: '#958CAD', fontSize: 10, lineHeight: 16, marginTop: 4 },
  agentHero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }, promptCard: { backgroundColor: '#101B2A', borderWidth: 1, borderColor: '#31506F', borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingLeft: 15 }, prompt: { flex: 1, minHeight: 58, maxHeight: 130, color: '#EEF6FF', fontSize: 13, paddingVertical: 13 }, send: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#78BDFF', alignItems: 'center', justifyContent: 'center', marginRight: 10 }, quickRow: { gap: 8, marginTop: 12, marginBottom: 22 }, quick: { borderWidth: 1, borderColor: '#25384F', backgroundColor: '#0F1825', borderRadius: 12, padding: 12 }, quickText: { color: '#91A8C1', fontSize: 11 },
  runCard: { borderRadius: 19, borderWidth: 1, borderColor: '#263950', backgroundColor: '#101A28', padding: 18 }, runTitle: { color: '#EDF5FF', fontWeight: '800', fontSize: 13, flex: 1 }, event: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1D2D41' }, eventTitle: { color: '#DDE9F8', fontSize: 11, fontWeight: '800' }, eventText: { color: '#7E91A8', fontSize: 10, lineHeight: 16, marginTop: 3 }, answer: { backgroundColor: '#13253A', borderRadius: 13, padding: 15, marginTop: 14 }, answerLabel: { color: '#79BDFF', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 }, answerText: { color: '#D6E3F2', fontSize: 12, lineHeight: 20, marginTop: 8 },
  settingsCard: { backgroundColor: '#101A28', borderWidth: 1, borderColor: '#273950', borderRadius: 19, padding: 20, marginTop: 24, maxWidth: 650 }, fieldLabel: { color: '#DDE8F5', fontWeight: '800', fontSize: 11, marginTop: 10 }, field: { color: '#EAF3FF', backgroundColor: '#0A131E', borderWidth: 1, borderColor: '#2A3F58', borderRadius: 11, padding: 13, marginTop: 8, marginBottom: 12 }, connect: { backgroundColor: '#79BDFF', borderRadius: 11, padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 }, connectText: { color: '#06111C', fontWeight: '900', fontSize: 12 }, connection: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 15 }, connectionText: { color: '#8194AB', fontSize: 10 },
  bottomNav: { height: 66, borderTopWidth: 1, borderTopColor: '#1B2A3D', backgroundColor: '#0A131E', flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8 }, bottomItem: { alignItems: 'center', width: 85 }, bottomText: { color: '#687B95', fontSize: 9, marginTop: 5, fontWeight: '700' },
});
