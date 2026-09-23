import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, Text, TextInput, useWindowDimensions, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Orb } from './src/Orb';
import { AgentEvent, AgentRun, Health } from './src/types';
import { cancelRun, checkHealth, decideRun, defaultEndpoint, getFile, getFiles, getRun, startRun } from './src/api';
import { demoAdvance, demoDecide, demoStart } from './src/demo';
import { C, s } from './src/theme';

type Page = 'home' | 'agent' | 'workspace' | 'settings';
type IconName = keyof typeof Feather.glyphMap;
const nav: { id: Page; title: string; icon: IconName }[] = [
  { id: 'home', title: '总览', icon: 'grid' }, { id: 'agent', title: 'Agent', icon: 'command' },
  { id: 'workspace', title: '工作区', icon: 'folder' }, { id: 'settings', title: '设置', icon: 'sliders' },
];
const prompts = [
  { icon: 'file-text' as IconName, title: '制作简报', text: '读取工作区资料，提炼要点，生成一份简洁的中文简报。', hue: '#78BAFF' },
  { icon: 'compass' as IconName, title: '规划项目', text: '分析工作区内容，制定清晰的项目执行计划并保存。', hue: '#B79CFF' },
  { icon: 'search' as IconName, title: '定位信息', text: '在工作区文件里找到关键问题、相关事实和下一步建议。', hue: '#64DAC5' },
];
const eventIcon: Record<AgentEvent['kind'], IconName> = {
  thinking: 'loader', tool: 'terminal', success: 'check', approval: 'shield',
  denied: 'x', final: 'star', error: 'alert-triangle',
};
const eventColor: Record<AgentEvent['kind'], string> = {
  thinking: '#8ABEFF', tool: '#AF9CFF', success: '#62DABC', approval: '#FFCC83',
  denied: '#FF8A91', final: '#7BB6FF', error: '#FF8A91',
};
function I({ name, size = 18, color = C.text }: { name: IconName; size?: number; color?: string }) {
  return <Feather name={name} size={size} color={color} />;
}
function Badge({ label, color = C.blue }: { label: string; color?: string }) {
  return <View style={[s.badge, { borderColor: color + '55' }]}><View style={[s.badgeDot, { backgroundColor: color }]} /><Text style={[s.badgeText, { color }]}>{label}</Text></View>;
}
function EventRow({ event, last }: { event: AgentEvent; last: boolean }) {
  const color = eventColor[event.kind];
  return <View style={s.eventRow}><View style={s.timeline}><View style={[s.eventIcon, { borderColor: color + '66', backgroundColor: color + '1E' }]}><I name={eventIcon[event.kind]} size={14} color={color} /></View>{!last && <View style={s.timelineLine} />}</View>
    <View style={s.eventBody}><View style={s.eventHeading}><Text style={s.eventTitle}>{event.title}</Text><Text style={s.eventTime}>{new Date(event.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</Text></View>{!!event.detail && <Text style={s.eventDetail}>{event.detail}</Text>}</View>
  </View>;
}
function AppContent() {
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const [page, setPage] = useState<Page>('home');
  const [mode, setMode] = useState<'preview' | 'local'>('preview');
  const [endpoint, setEndpoint] = useState(defaultEndpoint);
  const [editedEndpoint, setEditedEndpoint] = useState(defaultEndpoint);
  const [pair, setPair] = useState('');
  const [editedPair, setEditedPair] = useState('');
  const [health, setHealth] = useState<Health | null>(null);
  const [run, setRun] = useState<AgentRun | null>(null);
  const [prompt, setPrompt] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [openFile, setOpenFile] = useState<{ name: string; content: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => { AsyncStorage.getItem('@nova/endpoint').then(x => { if (x) { setEndpoint(x); setEditedEndpoint(x); } }).catch(() => {}); }, []);
  useEffect(() => {
    if (!run?.id || mode !== 'local' || !['thinking', 'approval', 'resuming'].includes(run.status)) return;
    const timer = setInterval(() => getRun(endpoint, pair, run.id).then(setRun).catch(e => setNotice(e.message)), 850);
    return () => clearInterval(timer);
  }, [run?.id, run?.status, mode, endpoint, pair]);
  useEffect(() => {
    if (mode !== 'preview' || !run || run.status !== 'thinking') return;
    const a = setTimeout(() => setRun(prev => prev?.status === 'thinking' ? demoAdvance(prev, 1) : prev), 850);
    const b = setTimeout(() => setRun(prev => prev?.status === 'thinking' ? demoAdvance(prev, 2) : prev), 1750);
    const c = setTimeout(() => setRun(prev => prev?.status === 'thinking' ? demoAdvance(prev, 3) : prev), 2800);
    return () => { clearTimeout(a); clearTimeout(b); clearTimeout(c); };
  }, [run?.id, mode]);
  const active = run && ['thinking', 'approval', 'resuming'].includes(run.status);
  const modelLabel = mode === 'preview' ? 'INTERACTIVE PREVIEW' : health?.modelReady ? 'LOCAL MODEL ONLINE' : health?.online ? 'MODEL NOT READY' : 'LOCAL OFFLINE';
  const modelColor = mode === 'preview' ? '#C8A6FF' : health?.modelReady ? C.green : C.amber;
  const jump = (text: string) => { setPrompt(text); setPage('agent'); };
  async function connect() {
    setBusy(true); setNotice('');
    try {
      const url = editedEndpoint.trim().replace(/\/$/, '');
      if (!/^https?:\/\//.test(url)) throw new Error('请输入完整地址，例如 http://192.168.1.10:8787');
      const status = await checkHealth(url);
      const result = await getFiles(url, editedPair.trim());
      setEndpoint(url); setPair(editedPair.trim()); setHealth(status); setFiles(result.files);
      setMode('local'); await AsyncStorage.setItem('@nova/endpoint', url);
      setNotice(status.modelReady ? '已连接到本地模型和工作区' : '已连接服务端，但尚未找到指定的 Ollama 模型');
    } catch (e) { setNotice(e instanceof Error ? e.message : '连接失败'); }
    finally { setBusy(false); }
  }
  async function refreshFiles() {
    if (mode === 'preview') return;
    try { setFiles((await getFiles(endpoint, pair)).files); } catch (e) { setNotice(e instanceof Error ? e.message : '读取失败'); }
  }
  async function viewFile(name: string) {
    if (mode === 'preview') { setOpenFile({ name, content: '这是交互预览中的示例文档。连接你电脑上的本地服务后，这里会显示真实文件内容。' }); return; }
    try { setOpenFile(await getFile(endpoint, pair, name)); } catch (e) { setNotice(e instanceof Error ? e.message : '读取失败'); }
  }
  async function submit() {
    if (prompt.trim().length < 3) { setNotice('请至少输入 3 个字符。'); return; }
    setNotice(''); setBusy(true);
    try {
      setRun(mode === 'preview' ? demoStart(prompt.trim()) : await startRun(endpoint, pair, prompt.trim()));
      setPrompt('');
    } catch (e) { setNotice(e instanceof Error ? e.message : '任务启动失败'); }
    finally { setBusy(false); }
  }
  async function decide(approved: boolean) {
    if (!run) return;
    setBusy(true);
    try { setRun(mode === 'preview' ? demoDecide(run, approved) : await decideRun(endpoint, pair, run.id, approved)); if (approved) setTimeout(refreshFiles, 900); }
    catch (e) { setNotice(e instanceof Error ? e.message : '审批失败'); }
    finally { setBusy(false); }
  }
  async function cancel() {
    if (!run) return;
    try { setRun(mode === 'preview' ? { ...run, status: 'cancelled', pending: null } : await cancelRun(endpoint, pair, run.id)); }
    catch (e) { setNotice(e instanceof Error ? e.message : '停止失败'); }
  }
  const sidebar = <View style={s.sidebar}><View style={s.logoRow}><LinearGradient colors={['#75C5FF', '#507AFF']} style={s.logo}><Text style={s.logoN}>N</Text></LinearGradient><View><Text style={s.logoText}>NOVA</Text><Text style={s.logoCaption}>LOCAL AGENT STUDIO</Text></View></View>
    <Text style={s.navCaption}>WORKSPACE</Text>{nav.map(item => <Pressable key={item.id} onPress={() => { setPage(item.id); if (item.id === 'workspace') void refreshFiles(); }} style={[s.sideNav, page === item.id && s.sideNavActive]}><I name={item.icon} size={18} color={page === item.id ? C.blue : C.dim} /><Text style={[s.sideNavText, page === item.id && { color: C.text }]}>{item.title}</Text>{page === item.id && <View style={s.navAccent} />}</Pressable>)}
    <View style={s.sideBottom}><View style={s.divider} /><Badge label={modelLabel} color={modelColor} /><Text style={s.sideSmall}>{mode === 'preview' ? '交互预览 · 不修改真实文件' : `模型 ${health?.model ?? '未连接'}`}</Text></View>
  </View>;
  const runCard = run && <View style={s.runCard}><View style={s.runHead}><View><Text style={s.micro}>AGENT EXECUTION</Text><Text style={s.runPrompt}>{run.prompt}</Text></View><Badge label={run.status === 'completed' ? 'DONE' : run.status === 'approval' ? 'NEEDS APPROVAL' : run.status === 'failed' ? 'ERROR' : run.status === 'cancelled' ? 'STOPPED' : 'RUNNING'} color={run.status === 'completed' ? C.green : run.status === 'approval' ? C.amber : run.status === 'failed' ? C.red : C.blue} /></View>
    <View style={s.rule} />{run.events.map((event, i) => <EventRow key={event.id} event={event} last={i === run.events.length - 1} />)}
    {run.pending && <View style={s.approval}><View style={s.approvalHead}><I name="shield" color={C.amber} /><Text style={s.approvalTitle}>需要你的批准</Text></View><Text style={s.approvalPath}>写入 {run.pending.path}</Text><ScrollView style={s.previewCode}><Text style={s.previewCodeText}>{run.pending.preview}</Text></ScrollView><View style={s.approvalActions}><Pressable onPress={() => decide(false)} disabled={busy} style={s.ghostButton}><Text style={s.ghostText}>拒绝</Text></Pressable><Pressable onPress={() => decide(true)} disabled={busy} style={s.approveButton}><I name="check" size={15} color="#061624" /><Text style={s.approveText}>批准写入</Text></Pressable></View></View>}
    {active && run.status !== 'approval' && <Pressable onPress={cancel} style={s.stopButton}><I name="square" size={12} color={C.dim} /><Text style={s.stopText}>停止任务</Text></Pressable>}
  </View>;
  return <SafeAreaView style={s.root} edges={['top', 'bottom']}><StatusBar barStyle="light-content" backgroundColor={C.bg} /><View style={s.backGlow} /><View style={[s.layout, { maxWidth: desktop ? 1480 : 740 }]}>
    {desktop && sidebar}
    <View style={s.main}><View style={s.top}><View style={s.topBrand}>{!desktop && <LinearGradient colors={['#75C5FF', '#507AFF']} style={s.miniLogo}><Text style={s.miniN}>N</Text></LinearGradient>}<Text style={s.topTitle}>{desktop ? nav.find(x => x.id === page)?.title : 'NOVA'}</Text></View><Badge label={modelLabel} color={modelColor} /></View>
      {!!notice && <Pressable onPress={() => setNotice('')} style={s.notice}><I name="info" size={16} color={C.amber} /><Text style={s.noticeText}>{notice}</Text><I name="x" size={15} color={C.dim} /></Pressable>}
      <ScrollView key={page} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {page === 'home' && <><View style={s.overline}><View style={s.liveDot} /><Text style={s.overlineText}>AUTONOMOUS · PRIVATE · YOURS</Text></View>
          <View style={[s.hero, desktop && s.heroDesktop]}><View style={s.heroCopy}><Text style={s.heroKicker}>YOUR LOCAL INTELLIGENCE</Text><Text style={[s.heroTitle, desktop && { fontSize: 43, lineHeight: 53 }]}>想法交给你。{'\n'}<Text style={s.accentText}>执行交给 NOVA。</Text></Text><Text style={s.heroBody}>给出目标，让 Agent 自己规划、查找资料、调用工具。每一步都看得见；修改文件由你决定。</Text><Pressable onPress={() => setPage('agent')} style={s.heroAction}><Text style={s.heroActionText}>开启一次任务</Text><I name="arrow-up-right" size={19} color="#06111C" /></Pressable></View><View style={s.heroOrb}><Orb size={desktop ? 260 : 210} active={!!active} /></View></View>
          <View style={s.sectionHeading}><View><Text style={s.micro}>ONE PROMPT. MULTIPLE ACTIONS.</Text><Text style={s.sectionTitle}>让它替你走下一步</Text></View><I name="arrow-down-right" color={C.dim} /></View><View style={[s.cards, desktop && s.cardsDesktop]}>{prompts.map(item => <Pressable key={item.title} onPress={() => jump(item.text)} style={s.actionCard}><View style={[s.actionIcon, { backgroundColor: item.hue + '22' }]}><I name={item.icon} color={item.hue} size={21} /></View><Text style={s.actionTitle}>{item.title}</Text><Text style={s.actionSub}>{item.text}</Text><View style={s.actionArrow}><I name="arrow-up-right" size={17} color={item.hue} /></View></Pressable>)}</View>
          <View style={s.featureStrip}><I name="shield" color={C.green} size={19} /><View style={{ flex: 1 }}><Text style={s.featureTitle}>控制权一直在你手里</Text><Text style={s.featureText}>本地模型 · 可见的工具过程 · 文件写入审批</Text></View></View>
        </>}
        {page === 'agent' && <><View style={s.agentHeader}><View><Text style={s.micro}>MISSION CONTROL</Text><Text style={s.screenTitle}>给它一个目标。</Text><Text style={s.screenSub}>它会决定步骤，必要时调用工具，并把过程展示给你。</Text></View><Orb size={desktop ? 138 : 108} active={!!active} /></View>
          {!run ? <View style={s.emptyAgent}><View style={s.emptyLine}><I name="command" size={25} color={C.blue} /></View><Text style={s.emptyTitle}>Agent 等待指令</Text><Text style={s.emptyText}>从下方输入一个目标，或选择一个灵感开始。</Text>{prompts.map(item => <Pressable key={item.title} onPress={() => setPrompt(item.text)} style={s.suggestion}><I name={item.icon} color={item.hue} size={17} /><Text style={s.suggestionText}>{item.title}</Text><I name="arrow-up-right" color={C.dim} size={16} /></Pressable>)}</View> : runCard}
          {mode === 'preview' && <Text style={s.previewNote}>PREVIEW MODE · 上面的工具执行为交互演示。连接本地模型后可处理真实文件。</Text>}
        </>}
        {page === 'workspace' && <><Text style={s.micro}>LOCAL KNOWLEDGE</Text><Text style={s.screenTitle}>工作区</Text><Text style={s.screenSub}>Agent 只能访问你指定的本地文档目录。读取可见，写入需批准。</Text>
          <View style={s.workspaceTop}><View style={s.workspaceIcon}><I name="folder" color={C.blue} size={24} /></View><View style={{ flex: 1 }}><Text style={s.workspaceTitle}>{mode === 'preview' ? '示例工作区' : '我的本地工作区'}</Text><Text style={s.workspaceSub}>{mode === 'preview' ? '3 份演示资料' : `${files.length} 份 .md / .txt 文档`}</Text></View><Pressable onPress={refreshFiles}><I name="refresh-cw" color={C.dim} size={17} /></Pressable></View>
          {(mode === 'preview' ? ['product-brief.md', 'research-notes.md', 'roadmap.md'] : files).map((name, index) => <Pressable key={name} onPress={() => viewFile(name)} style={s.fileRow}><View style={s.fileIcon}><I name="file-text" color={index % 2 ? '#B7A0FF' : '#81BDFF'} /></View><View style={{ flex: 1 }}><Text style={s.fileName}>{name}</Text><Text style={s.fileSub}>LOCAL DOCUMENT · {name.endsWith('.md') ? 'MARKDOWN' : 'TEXT'}</Text></View><I name="chevron-right" size={18} color={C.dim} /></Pressable>)}
          {mode === 'local' && !files.length && <View style={s.emptyFiles}><Text style={s.emptyText}>暂无文件。把 .md 或 .txt 放进 data/workspace，或者让 Agent 创建一份。</Text></View>}
          {openFile && <View style={s.openFile}><View style={s.openFileHead}><Text style={s.openFileTitle}>{openFile.name}</Text><Pressable onPress={() => setOpenFile(null)}><I name="x" color={C.dim} /></Pressable></View><Text style={s.openFileText}>{openFile.content}</Text></View>}
        </>}
        {page === 'settings' && <><Text style={s.micro}>LOCAL CONTROL</Text><Text style={s.screenTitle}>连接你自己的 AI。</Text><Text style={s.screenSub}>模型在你的电脑上运行。手机和电脑共享同一个本地 Agent 工作区。</Text>
          <View style={s.settingsCard}><View style={s.settingsHeader}><I name="cpu" color={C.blue} size={22} /><View><Text style={s.settingsTitle}>运行模式</Text><Text style={s.settingsSub}>先体验，再接入真实 Ollama 模型</Text></View></View><View style={s.modeRow}><Pressable onPress={() => setMode('preview')} style={[s.modeButton, mode === 'preview' && s.modeActive]}><Text style={[s.modeText, mode === 'preview' && s.modeTextActive]}>交互预览</Text></Pressable><Pressable onPress={() => setMode('local')} style={[s.modeButton, mode === 'local' && s.modeActive]}><Text style={[s.modeText, mode === 'local' && s.modeTextActive]}>本地 Agent</Text></Pressable></View></View>
          <View style={s.settingsCard}><Text style={s.settingsTitle}>本地服务地址</Text><Text style={s.settingsSub}>电脑填 localhost；手机填电脑在同一 Wi-Fi 下的局域网 IP。</Text><TextInput value={editedEndpoint} onChangeText={setEditedEndpoint} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="http://192.168.1.10:8787" placeholderTextColor={C.dim} style={s.textField} /><Text style={[s.settingsTitle, { marginTop: 21 }]}>配对码</Text><Text style={s.settingsSub}>启动服务时显示在电脑终端；不会提交到云端。</Text><TextInput value={editedPair} onChangeText={setEditedPair} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="从终端复制配对码" placeholderTextColor={C.dim} style={s.textField} /><Pressable onPress={connect} disabled={busy} style={s.connectButton}>{busy ? <ActivityIndicator color="#07111D" /> : <><I name="link" color="#07111D" size={17} /><Text style={s.connectText}>连接本地 Agent</Text></>}</Pressable><View style={s.connectionLine}><View style={[s.badgeDot, { backgroundColor: health?.modelReady ? C.green : C.amber }]} /><Text style={s.connectionText}>{health?.modelReady ? `${health.model} 已就绪` : health?.online ? '服务已连接 · 模型尚未就绪' : '未连接到本地服务'}</Text></View></View>
          <View style={s.helpCard}><I name="info" color={C.blue} size={20} /><View style={{ flex: 1 }}><Text style={s.helpTitle}>为什么手机不能填 localhost？</Text><Text style={s.helpText}>localhost 总是指当前设备本身。手机要连接电脑运行的 Agent，需使用电脑的局域网地址；服务仍只在你的本地网络运行。</Text></View></View>
        </>}
      </ScrollView>
      {page === 'agent' && <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={s.composer}><View style={s.composerInput}><I name="terminal" color={C.blue} size={19} /><TextInput value={prompt} onChangeText={setPrompt} placeholder="交给 NOVA 一个目标…" placeholderTextColor={C.dim} style={s.promptInput} multiline maxLength={2000} /><Pressable onPress={submit} disabled={busy || !!active} style={[s.sendButton, (busy || !!active) && { opacity: .45 }]}><I name="arrow-up" size={18} color="#07111D" /></Pressable></View><Text style={s.composerHint}>{mode === 'preview' ? '交互预览 · 不会处理真实资料' : '本地运行 · 文件写入由你批准'}</Text></View></KeyboardAvoidingView>}
    </View>
    {desktop && <View style={s.rail}><Text style={s.railOverline}>SYSTEM STATUS</Text><View style={s.railPanel}><Orb size={142} active={!!active} /><Badge label={modelLabel} color={modelColor} /><Text style={s.railTitle}>{active ? '正在执行任务' : '随时准备开始'}</Text><Text style={s.railSub}>{mode === 'preview' ? '体验 Agent 如何思考、调用工具和请求审批。' : health?.modelReady ? '你的本地模型已就绪。' : '请先在设置中连接模型。'}</Text></View><Text style={s.railOverline}>CAPABILITIES</Text>{[['folder', '本地文档'], ['search', '搜索与阅读'], ['divide', '精确计算'], ['shield', '写入审批']].map(([icon, label]) => <View key={label} style={s.capability}><I name={icon as IconName} size={16} color={C.blue} /><Text style={s.capabilityText}>{label}</Text><View style={s.capabilityDot} /></View>)}<View style={s.railFoot}><I name="lock" size={13} color={C.green} /><Text style={s.railFootText}>DESIGNED FOR LOCAL CONTROL</Text></View></View>}
  </View>
  {!desktop && <View style={s.bottomNav}>{nav.map(item => <Pressable key={item.id} onPress={() => { setPage(item.id); if (item.id === 'workspace') void refreshFiles(); }} style={s.bottomItem}><View style={[s.bottomIcon, page === item.id && s.bottomIconActive]}><I name={item.icon} color={page === item.id ? C.blue : C.dim} size={20} /></View><Text style={[s.bottomLabel, page === item.id && { color: C.blue }]}>{item.title}</Text></Pressable>)}</View>}
  </SafeAreaView>;
}
export default function App() { return <SafeAreaProvider><AppContent /></SafeAreaProvider>; }
