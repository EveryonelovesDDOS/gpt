import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Share, StatusBar, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { complete, isThisWeek, isToday, Plan, remaining, State, starter, uid } from './src/model';
import { demoDraft, Draft, generateDraft, makePlan } from './src/planner';
import { clear, load, save } from './src/storage';
import { C, s } from './src/styles';

type Tab = '今天' | '专注' | '回顾' | '我的';
type IconName = keyof typeof Feather.glyphMap;
const tabs: { label: Tab; icon: IconName }[] = [
  { label: '今天', icon: 'home' }, { label: '专注', icon: 'circle' },
  { label: '回顾', icon: 'bar-chart-2' }, { label: '我的', icon: 'user' },
];
const categories = {
  工作: { icon: 'briefcase', bg: '#EDE9FF', color: '#6855CB' },
  生活: { icon: 'coffee', bg: '#FFEDE5', color: '#DC8866' },
  学习: { icon: 'book-open', bg: '#DFF5EB', color: '#3B9A73' },
  其他: { icon: 'star', bg: '#E9EFFB', color: '#6C8CC6' },
} as const;
function Icon({ name, size = 20, color = C.ink }: { name: IconName; size?: number; color?: string }) {
  return <Feather name={name} size={size} color={color} />;
}
function Section({ title, right }: { title: string; right?: string }) {
  return <View style={s.sectionHead}><Text style={s.sectionTitle}>{title}</Text><Text style={s.sectionRight}>{right}</Text></View>;
}
function Primary({ label, onPress, icon, disabled = false }: { label: string; onPress: () => void; icon?: IconName; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.primary, disabled && { opacity: .5 }]}>
    <Text style={s.primaryText}>{label}</Text>{icon && <Icon name={icon} size={18} color="white" />}
  </Pressable>;
}
function PlanCard({ plan, toggle, focus }: { plan: Plan; toggle: (id: string) => void; focus: () => void }) {
  const cat = categories[plan.category];
  return <View style={s.planCard}>
    <View style={s.planTop}><View style={[s.categoryIcon, { backgroundColor: cat.bg }]}><Icon name={cat.icon} size={19} color={cat.color} /></View>
      <View style={{ flex: 1 }}><Text style={s.planTitle}>{plan.title}</Text><Text style={s.planMeta}>{plan.category} · {plan.minutes} 分钟 · {plan.source === 'ai' ? 'AI 整理' : '演示整理'}</Text></View>
      {complete(plan) && <Icon name="check-circle" color="#52B990" size={20} />}
    </View>
    <Text style={s.planSummary}>{plan.summary}</Text><View style={s.divider} />
    {plan.steps.map((step, index) => <Pressable key={step.id} accessibilityRole="checkbox" accessibilityState={{ checked: step.done }} onPress={() => toggle(step.id)} style={s.stepRow}>
      <View style={[s.checkbox, step.done && s.checkboxDone]}>{step.done && <Icon name="check" size={12} color="white" />}</View>
      <Text style={[s.stepText, step.done && s.strike]}>{step.title}</Text>
      {index === 0 && !step.done && <Text style={s.startTag}>从这里开始</Text>}
    </Pressable>)}
    {!complete(plan) && <Pressable onPress={focus} style={s.focusLink}><Icon name="play" size={13} color={C.purple} /><Text style={s.focusLinkText}>开始专注 →</Text></Pressable>}
  </View>;
}
function MainApp() {
  const [state, setState] = useState<State>(starter);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('今天');
  const [capture, setCapture] = useState(false);
  const [raw, setRaw] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [source, setSource] = useState<Plan['source']>('demo');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);

  useEffect(() => { load().then(setState).catch(() => Alert.alert('读取失败', '暂时无法读取本机数据。')).finally(() => setReady(true)); }, []);
  useEffect(() => { if (ready) save(state).catch(() => Alert.alert('保存失败', '请检查设备存储空间。')); }, [state, ready]);
  const plans = state.plans;
  const active = plans.filter(p => !complete(p));
  const finished = plans.filter(complete);
  const current = active.find(p => p.id === selectedId) ?? active[0];
  const todayCount = plans.filter(p => isToday(p.createdAt)).length;
  const weekSessions = state.sessions.filter(x => isThisWeek(x.endedAt));
  const focusMinutes = weekSessions.reduce((n, x) => n + x.minutes, 0);
  const weekCompleted = finished.filter(p => isThisWeek(p.completedAt ?? p.createdAt)).length;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setSeconds(n => Math.max(0, n - 1)), 1000);
    return () => clearInterval(timer);
  }, [running]);
  useEffect(() => {
    if (seconds !== 0 || !running || !current) return;
    setRunning(false); setSessionDone(true);
    setState(prev => ({ ...prev, sessions: [{ id: uid(), planId: current.id, minutes: current.minutes, endedAt: new Date().toISOString() }, ...prev.sessions] }));
  }, [seconds, running, current?.id]);
  function toggle(planId: string, stepId: string) {
    setState(prev => ({ ...prev, plans: prev.plans.map(p => {
      if (p.id !== planId) return p;
      const steps = p.steps.map(x => x.id === stepId ? { ...x, done: !x.done } : x);
      return { ...p, steps, completedAt: steps.every(x => x.done) ? (p.completedAt ?? new Date().toISOString()) : undefined };
    }) }));
  }
  function resetCapture() { setCapture(false); setRaw(''); setDraft(null); setError(''); setBusy(false); }
  async function organize(mode: Plan['source']) {
    if (raw.trim().length < 5) { setError('至少写 5 个字，描述你脑中的那件事。'); return; }
    if (raw.length > 1200) { setError('最多输入 1200 个字符。'); return; }
    setBusy(true); setError('');
    try { setDraft(mode === 'ai' ? await generateDraft(raw.trim()) : demoDraft(raw.trim())); setSource(mode); }
    catch (e) { setError(e instanceof Error ? e.message : '整理失败，请重试'); }
    finally { setBusy(false); }
  }
  function addPlan() {
    if (!draft?.title.trim() || draft.steps.some(x => !x.trim())) { setError('请填写标题和每一步的内容。'); return; }
    const plan = makePlan(raw, draft, source);
    setState(prev => ({ ...prev, plans: [plan, ...prev.plans] }));
    resetCapture(); setTab('今天');
  }
  function focusOn(plan: Plan) { setSelectedId(plan.id); setSeconds(plan.minutes * 60); setRunning(false); setSessionDone(false); setTab('专注'); }
  async function exportData() {
    try { await Share.share({ title: '片刻 · 我的数据', message: JSON.stringify({ exportedAt: new Date().toISOString(), ...state }, null, 2) }); }
    catch { Alert.alert('导出失败', '暂时无法打开系统分享菜单。'); }
  }
  function deleteData() {
    Alert.alert('清除所有数据？', '已保存的整理和专注记录会从这台设备删除，无法撤销。', [
      { text: '取消', style: 'cancel' },
      { text: '全部清除', style: 'destructive', onPress: async () => { try { await clear(); setState({ plans: [], sessions: [] }); setRunning(false); setSeconds(25 * 60); setSelectedId(null); } catch { Alert.alert('清除失败', '请稍后重试。'); } } },
    ]);
  }
  const greeting = new Date().getHours() < 11 ? '早上好' : new Date().getHours() < 18 ? '下午好' : '晚上好';
  const day = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date());
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - 6 + index);
    const count = state.sessions.filter(x => { const d = new Date(x.endedAt); return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate(); }).reduce((n, x) => n + x.minutes, 0);
    return { name: ['日', '一', '二', '三', '四', '五', '六'][date.getDay()], count };
  }), [state.sessions]);
  if (!ready) return <View style={s.loading}><ActivityIndicator color={C.purple} /></View>;
  return <SafeAreaView style={s.safe} edges={['top', 'bottom']}><StatusBar barStyle="dark-content" backgroundColor={C.bg} /><View style={s.shell}>
    <ScrollView key={tab} showsVerticalScrollIndicator={false} contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      {tab === '今天' && <>
        <View style={s.topBar}><View style={s.brand}><View style={s.brandMark}><Icon name="aperture" size={20} color="white" /></View><Text style={s.brandText}>片刻 <Text style={{ fontWeight: '400' }}>PIANKE</Text></Text></View><View style={s.avatar}><Icon name="smile" size={20} color={C.purple} /></View></View>
        <Text style={s.date}>{day} · {greeting}</Text><Text style={s.headline}>慢一点，<Text style={{ color: C.purple }}>也能向前。</Text></Text>
        <LinearGradient colors={['#7564F1', '#5144C9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          <View style={s.heroOrbit} /><View style={s.heroOrbit2} /><View style={s.heroPill}><Icon name="star" size={13} color="#E9E2FF" /><Text style={s.heroPillText}>AI 思绪整理</Text></View>
          <Text style={s.heroTitle}>脑袋太满了？{'\n'}先把事情放下来。</Text><Text style={s.heroSub}>写下来，让 AI 帮你找到第一步。</Text>
          <Pressable onPress={() => setCapture(true)} style={s.heroButton}><Text style={s.heroButtonText}>开始整理</Text><Icon name="arrow-up-right" size={17} color={C.purple} /></Pressable>
        </LinearGradient>
        <View style={s.statGrid}><View style={s.statCard}><View style={[s.statIcon, { backgroundColor: '#EEEAFE' }]}><Icon name="layers" color={C.purple} size={18} /></View><Text style={s.statNum}>{todayCount}<Text style={s.statUnit}> 件</Text></Text><Text style={s.statLabel}>今天已整理</Text></View>
          <View style={s.statCard}><View style={[s.statIcon, { backgroundColor: '#E0F5E9' }]}><Icon name="check" color="#4AAE82" size={18} /></View><Text style={s.statNum}>{finished.length}<Text style={s.statUnit}> 件</Text></Text><Text style={s.statLabel}>累计完成</Text></View></View>
        <Section title="进行中的事" right={`${active.length} 件待完成`} />
        {active.length === 0 ? <View style={s.empty}><View style={s.emptyIcon}><Icon name="wind" size={25} color={C.purple} /></View><Text style={s.emptyTitle}>给脑袋留一点空白</Text><Text style={s.emptyBody}>想到什么，就从上面的入口写下来。{'\n'}一次只做一件事。</Text></View> : active.map(p => <PlanCard key={p.id} plan={p} toggle={id => toggle(p.id, id)} focus={() => focusOn(p)} />)}
        {finished.length > 0 && <><Section title="已经做到的" right={`${finished.length} 件`} />{finished.slice(0, 3).map(p => <PlanCard key={p.id} plan={p} toggle={id => toggle(p.id, id)} focus={() => focusOn(p)} />)}</>}
      </>}
      {tab === '专注' && <>
        <View style={s.simpleTop}><Text style={s.eyebrow}>FOCUS MODE</Text><Text style={s.screenTitle}>把注意力，<Text style={{ color: C.purple }}>还给当下。</Text></Text><Text style={s.screenSub}>选一件事，给它一段不被打扰的时间。</Text></View>
        {active.length === 0 ? <View style={s.empty}><View style={s.emptyIcon}><Icon name="target" size={26} color={C.purple} /></View><Text style={s.emptyTitle}>还没有待完成的事</Text><Text style={s.emptyBody}>整理一个想法，再来这里专注完成。</Text><Pressable onPress={() => setCapture(true)} style={s.textButton}><Text style={s.textButtonLabel}>整理一个想法 →</Text></Pressable></View> : <>
          <View style={s.focusCard}><Text style={s.focusOverline}>正在专注于</Text><Text style={s.focusTitle}>{current?.title}</Text><View style={s.timerRing}><Text style={s.timer}>{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</Text><Text style={s.timerHint}>{sessionDone ? '这一段时间属于你 ✓' : running ? '保持节奏，慢慢来' : '准备好了就开始'}</Text></View>
            <View style={s.timerButtons}><Pressable onPress={() => { setRunning(false); setSeconds((current?.minutes ?? 25) * 60); setSessionDone(false); }} style={s.resetButton}><Icon name="rotate-ccw" size={18} color={C.purple} /></Pressable>
              <Pressable onPress={() => { if (seconds === 0) { setSeconds((current?.minutes ?? 25) * 60); setSessionDone(false); } setRunning(!running); }} style={s.playButton}><Icon name={running ? 'pause' : 'play'} size={22} color="white" /><Text style={s.playText}>{running ? '暂停' : sessionDone ? '再来一次' : '开始专注'}</Text></Pressable></View>
          </View><Section title="选择专注的事" right={`${active.length} 个选择`} />
          {active.map(p => <Pressable key={p.id} onPress={() => focusOn(p)} style={[s.selectCard, current?.id === p.id && s.selectCardActive]}><View style={[s.categoryIcon, { backgroundColor: categories[p.category].bg }]}><Icon name={categories[p.category].icon} size={18} color={categories[p.category].color} /></View><View style={{ flex: 1 }}><Text style={s.selectTitle} numberOfLines={1}>{p.title}</Text><Text style={s.planMeta}>还剩 {remaining(p)} 步 · {p.minutes} 分钟</Text></View><Icon name={current?.id === p.id ? 'check-circle' : 'circle'} color={C.purple} size={20} /></Pressable>)}
        </>}
      </>}
      {tab === '回顾' && <>
        <View style={s.simpleTop}><Text style={s.eyebrow}>YOUR PROGRESS</Text><Text style={s.screenTitle}>每一步，<Text style={{ color: C.purple }}>都算数。</Text></Text><Text style={s.screenSub}>看见自己已经走过的路。</Text></View>
        <LinearGradient colors={['#6656DF', '#8975F5']} style={s.insightHero}><View><Text style={s.insightLabel}>本周专注时长</Text><Text style={s.insightNum}>{focusMinutes}<Text style={s.insightUnit}> 分钟</Text></Text><Text style={s.insightFoot}>你为重要的事留出的时间</Text></View><Icon name="sun" size={58} color="#C7BBFF" /></LinearGradient>
        <View style={s.statGrid}><View style={s.statCard}><Text style={s.statNum}>{weekCompleted}</Text><Text style={s.statLabel}>本周完成</Text></View><View style={s.statCard}><Text style={s.statNum}>{weekSessions.length}</Text><Text style={s.statLabel}>本周专注次数</Text></View></View>
        <Section title="最近 7 天" right="专注分钟" /><View style={s.chartCard}><View style={s.chart}>{days.map((d, i) => <View key={i} style={s.barGroup}><Text style={s.barValue}>{d.count || ''}</Text><View style={[s.bar, { height: Math.max(6, d.count ? 18 + d.count / Math.max(1, ...days.map(x => x.count)) * 92 : 6), backgroundColor: i === 6 ? C.purple : '#DAD5FB' }]} /><Text style={s.barLabel}>{d.name}</Text></View>)}</View>{focusMinutes === 0 && <Text style={s.chartNote}>完成一次专注，这里就会出现你的节奏。</Text>}</View>
        <View style={s.quoteCard}><Icon name="heart" size={20} color={C.coral} /><Text style={s.quote}>进步不一定很快，{'\n'}但每一次开始都很珍贵。</Text></View>
      </>}
      {tab === '我的' && <>
        <View style={s.simpleTop}><Text style={s.eyebrow}>YOUR SPACE</Text><Text style={s.screenTitle}>你的空间，<Text style={{ color: C.purple }}>由你掌控。</Text></Text><Text style={s.screenSub}>思绪和记录保存在这台设备上。</Text></View>
        <View style={s.settingsCard}><View style={s.settingRow}><View style={[s.settingIcon, { backgroundColor: C.lilac }]}><Icon name="cpu" color={C.purple} size={19} /></View><View style={{ flex: 1 }}><Text style={s.settingTitle}>AI 服务</Text><Text style={s.settingSub}>{process.env.EXPO_PUBLIC_API_URL ? '已配置，可使用 AI 整理' : '未配置，可使用演示整理'}</Text></View><View style={[s.statusDot, { backgroundColor: process.env.EXPO_PUBLIC_API_URL ? '#55BA8A' : C.coral }]} /></View><View style={s.divider} />
          <Pressable onPress={exportData} style={s.settingRow}><View style={[s.settingIcon, { backgroundColor: '#E6F6EE' }]}><Icon name="share-2" color="#41A878" size={19} /></View><View style={{ flex: 1 }}><Text style={s.settingTitle}>导出我的数据</Text><Text style={s.settingSub}>通过系统分享 JSON 文本</Text></View><Icon name="chevron-right" color={C.muted} size={18} /></Pressable><View style={s.divider} />
          <Pressable onPress={deleteData} style={s.settingRow}><View style={[s.settingIcon, { backgroundColor: '#FFF0EA' }]}><Icon name="trash-2" color="#E2826C" size={19} /></View><View style={{ flex: 1 }}><Text style={s.settingTitle}>清除本机数据</Text><Text style={s.settingSub}>删除所有整理和专注记录</Text></View><Icon name="chevron-right" color={C.muted} size={18} /></Pressable></View>
        <View style={s.privacyCard}><Icon name="lock" color={C.purple} size={19} /><View style={{ flex: 1 }}><Text style={s.privacyTitle}>你的隐私，我们认真对待</Text><Text style={s.privacyText}>整理记录默认仅存于设备。使用 AI 整理时，你输入的文字会发送到你配置的服务端和 AI 提供方；演示整理完全在设备上完成。</Text></View></View><Text style={s.version}>片刻 PIANKE · v1.0.0</Text>
      </>}
    </ScrollView>
    <View style={s.nav}>{tabs.map(item => <Pressable key={item.label} onPress={() => setTab(item.label)} style={s.navItem}><View style={[s.navIcon, tab === item.label && s.navIconActive]}><Icon name={item.icon} color={tab === item.label ? C.purple : '#A3A1B0'} size={21} /></View><Text style={[s.navLabel, tab === item.label && s.navLabelActive]}>{item.label}</Text></Pressable>)}</View>
  </View>
  <Modal visible={capture} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetCapture}>
    <SafeAreaView style={s.modalSafe} edges={['top', 'bottom']}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={s.modalHead}><Pressable onPress={resetCapture} hitSlop={12}><Icon name="x" size={23} /></Pressable><Text style={s.modalHeadTitle}>思绪整理</Text><View style={{ width: 23 }} /></View>
      <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!draft ? <><Text style={s.eyebrow}>LET IT OUT</Text><Text style={s.modalTitle}>想到什么，{'\n'}就写下来。</Text><Text style={s.modalIntro}>不需要有条理，也不需要一次讲清楚。</Text><TextInput multiline maxLength={1200} value={raw} onChangeText={setRaw} placeholder="比如：下周要交报告，还有几封邮件没回，感觉不知道先做哪个……" placeholderTextColor="#A5A4B1" style={s.input} textAlignVertical="top" /><Text style={s.counter}>{raw.length}/1200</Text>
          {!!error && <Text style={s.error}>{error}</Text>}<Primary label={busy ? '正在整理…' : '用 AI 找到第一步'} onPress={() => organize('ai')} icon="arrow-right" disabled={busy} /><Pressable disabled={busy} onPress={() => organize('demo')} style={s.demoButton}><Text style={s.demoText}>先用演示整理体验</Text></Pressable><View style={s.modalTip}><Icon name="info" size={16} color={C.muted} /><Text style={s.modalTipText}>演示模式使用固定规则；AI 模式需要配置服务端。</Text></View>
        </> : <><Text style={s.eyebrow}>{source === 'ai' ? 'AI PLAN' : 'DEMO PLAN'}</Text><Text style={s.modalTitle}>从这一步{'\n'}开始就好。</Text><Text style={s.modalIntro}>可以修改标题和每一步，保存后随时勾选。</Text><Text style={s.fieldLabel}>这件事</Text><TextInput value={draft.title} maxLength={80} onChangeText={v => setDraft({ ...draft, title: v })} style={s.editInput} /><Text style={s.fieldLabel}>行动步骤</Text>
          {draft.steps.map((step, i) => <View key={i} style={s.editStep}><View style={s.stepNumber}><Text style={s.stepNumberText}>{i + 1}</Text></View><TextInput value={step} maxLength={100} multiline onChangeText={v => setDraft({ ...draft, steps: draft.steps.map((x, index) => index === i ? v : x) })} style={s.editStepInput} /></View>)}<View style={s.planInfo}><Icon name="clock" size={16} color={C.purple} /><Text style={s.planInfoText}>建议专注 {draft.minutes} 分钟 · {draft.category}</Text></View>
          {!!error && <Text style={s.error}>{error}</Text>}<Primary label="保存到今天" onPress={addPlan} icon="check" /><Pressable onPress={() => { setDraft(null); setError(''); }} style={s.demoButton}><Text style={s.demoText}>返回修改原文</Text></Pressable>
        </>}
      </ScrollView>
    </KeyboardAvoidingView></SafeAreaView>
  </Modal>
  </SafeAreaView>;
}
export default function App() { return <SafeAreaProvider><MainApp /></SafeAreaProvider>; }
