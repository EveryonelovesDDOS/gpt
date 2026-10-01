import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PulseHalo, Reveal } from './AuroraMotion';
import type {
  AgentRun, DefensiveAction, DigitalTwin, Health, IncidentCase, IncidentTimeline,
  NetworkHealth, NetworkTopology, SecurityAnalysis, TelemetryChange,
} from './types';

export type MobilePage = 'home' | 'dashboard' | 'topology' | 'security' | 'agent' | 'settings';
type IconName = keyof typeof Feather.glyphMap;
type ThemeMode = 'light' | 'dark';

type Props = {
  page: MobilePage;
  setPage: (page: MobilePage) => void;
  live: boolean;
  network: NetworkHealth;
  topology: NetworkTopology | null;
  digitalTwin: DigitalTwin | null;
  security: SecurityAnalysis | null;
  incidents: IncidentTimeline | null;
  serverHealth: Health | null;
  actions: DefensiveAction[];
  incidentCases: IncidentCase[];
  changes: TelemetryChange[];
  themeMode: ThemeMode;
  onToggleTheme: () => void;
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
  onSimulatePlan: (id:string) => void;
  onMarkPlanApplied: (id:string) => void;
  onVerifyPlan: (id:string) => void;
  onRollbackPlan: (id:string) => void;
  notice: string;
  clearNotice: () => void;
};

const LIGHT = {
  bg:'#F3F6FA', surface:'#FFFFFF', surface2:'#F8FAFD', surface3:'#EEF3F8',
  ink:'#101828', text:'#344054', muted:'#667085', faint:'#98A2B3',
  line:'#E2E8F0', lineStrong:'#CAD5E2',
  mint:'#16B88F', mintSoft:'#E7F8F2', violet:'#6558F5', violetSoft:'#EFEDFF',
  blue:'#3B82F6', blueSoft:'#EAF3FF', coral:'#EF516F', coralSoft:'#FFF0F3',
  amber:'#DD9428', amberSoft:'#FFF6E6', nav:'rgba(255,255,255,.98)',
  shadow:'#64748B', heroA:'#111A2D', heroB:'#25345F', heroC:'#493B8E',
};
const DARK = {
  bg:'#0A101B', surface:'#111A29', surface2:'#151F30', surface3:'#1B273A',
  ink:'#F5F7FB', text:'#D3DBE8', muted:'#94A3B8', faint:'#6F8198',
  line:'#263449', lineStrong:'#34475F',
  mint:'#36D3A9', mintSoft:'#12362F', violet:'#9186FF', violetSoft:'#26234A',
  blue:'#69A6FF', blueSoft:'#182E4A', coral:'#FF6C87', coralSoft:'#421D29',
  amber:'#F1B354', amberSoft:'#3B2D17', nav:'rgba(12,18,30,.98)',
  shadow:'#000000', heroA:'#0B1324', heroB:'#18264B', heroC:'#352B70',
};
type Palette = typeof LIGHT;

function makeStyles(T:Palette) {
  return StyleSheet.create({
    root:{flex:1,backgroundColor:T.bg},
    header:{height:70,paddingHorizontal:15,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:T.nav,borderBottomWidth:1,borderBottomColor:T.line},
    brandRow:{flexDirection:'row',alignItems:'center',gap:9},logo:{width:38,height:38,borderRadius:13,alignItems:'center',justifyContent:'center'},logoText:{color:'#FFFFFF',fontSize:20,fontWeight:'900'},brand:{color:T.ink,fontSize:16,fontWeight:'900',letterSpacing:1.7},brandSub:{color:T.faint,fontSize:6.2,fontWeight:'800',letterSpacing:.9,marginTop:2},
    headerActions:{flexDirection:'row',alignItems:'center',gap:7},roundButton:{width:36,height:36,borderRadius:12,backgroundColor:T.surface2,borderWidth:1,borderColor:T.line,alignItems:'center',justifyContent:'center'},livePill:{height:34,borderRadius:17,paddingHorizontal:9,flexDirection:'row',alignItems:'center',gap:5,borderWidth:1,borderColor:T.line},liveText:{fontSize:7,fontWeight:'900',letterSpacing:.7},
    notice:{marginHorizontal:13,marginTop:9,borderWidth:1,borderColor:T.amber+'77',backgroundColor:T.amberSoft,borderRadius:13,padding:10,flexDirection:'row',alignItems:'center',gap:8},noticeText:{flex:1,color:T.text,fontSize:8.5,lineHeight:13},
    scroll:{flex:1},scrollContent:{padding:14,paddingBottom:104},page:{gap:16},
    sectionHead:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',gap:12},eyebrow:{color:T.mint,fontSize:7.5,fontWeight:'900',letterSpacing:1.4},sectionTitle:{color:T.ink,fontSize:23,lineHeight:28,fontWeight:'900',letterSpacing:-.5,marginTop:4},sectionAction:{color:T.violet,fontSize:8,fontWeight:'900'},
    hero:{borderRadius:27,padding:20,minHeight:382,overflow:'hidden',borderWidth:1,borderColor:T.line},heroGlowA:{position:'absolute',width:230,height:230,borderRadius:130,backgroundColor:T.mint,opacity:.13,right:-90,top:-80},heroGlowB:{position:'absolute',width:250,height:250,borderRadius:145,backgroundColor:T.violet,opacity:.17,left:-115,bottom:-125},
    heroTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},heroKicker:{color:'#B6F1E0',fontSize:7,fontWeight:'900',letterSpacing:1.25},heroBadge:{backgroundColor:'rgba(255,255,255,.11)',paddingHorizontal:9,paddingVertical:5,borderRadius:10},heroBadgeText:{color:'#FFFFFF',fontSize:6.5,fontWeight:'900',letterSpacing:.7},
    heroTitle:{color:'#FFFFFF',fontSize:35,lineHeight:39,fontWeight:'900',letterSpacing:-1.15,marginTop:27},heroCopy:{color:'#C9D4E6',fontSize:11.2,lineHeight:17,marginTop:10,maxWidth:310},heroActions:{flexDirection:'row',gap:8,marginTop:18},heroButton:{height:42,borderRadius:13,paddingHorizontal:13,flexDirection:'row',alignItems:'center',gap:7},heroButtonText:{fontSize:8.5,fontWeight:'900'},
    heroPulse:{marginTop:26,paddingTop:18,borderTopWidth:1,borderTopColor:'rgba(255,255,255,.13)',flexDirection:'row',alignItems:'center',gap:13},healthRing:{width:62,height:62,borderRadius:31,borderWidth:4,borderColor:'#49D8B5',alignItems:'center',justifyContent:'center'},healthNumber:{color:'#FFFFFF',fontSize:18,fontWeight:'900'},healthLabel:{color:'#A7EBD9',fontSize:5.5,fontWeight:'900',letterSpacing:.8},heroPulseTitle:{color:'#FFFFFF',fontSize:10.5,fontWeight:'900'},heroPulseSub:{color:'#AAB8CC',fontSize:8.2,lineHeight:12.5,marginTop:4},
    grid2:{flexDirection:'row',flexWrap:'wrap',gap:9},stat:{width:'48.6%',borderRadius:18,padding:13,backgroundColor:T.surface,borderWidth:1,borderColor:T.line,shadowColor:T.shadow,shadowOpacity:.05,shadowRadius:12,shadowOffset:{width:0,height:6}},statIcon:{width:32,height:32,borderRadius:11,alignItems:'center',justifyContent:'center'},statValue:{color:T.ink,fontSize:22,fontWeight:'900',marginTop:11},statLabel:{color:T.muted,fontSize:8.5,marginTop:3},
    card:{backgroundColor:T.surface,borderRadius:20,borderWidth:1,borderColor:T.line,padding:14},cardFlat:{backgroundColor:T.surface,borderRadius:17,borderWidth:1,borderColor:T.line,padding:12},
    changeRow:{flexDirection:'row',gap:10,alignItems:'center'},changeIcon:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center'},changeTitleRow:{flexDirection:'row',justifyContent:'space-between',gap:8},changeTitle:{color:T.ink,fontSize:9.5,fontWeight:'900',flex:1},changeTime:{color:T.faint,fontSize:6.8},changeDetail:{color:T.muted,fontSize:8,lineHeight:12.5,marginTop:3},
    priority:{flexDirection:'row',gap:10,alignItems:'center',backgroundColor:T.surface,borderRadius:18,borderWidth:1,borderColor:T.coral+'55',padding:13},priorityIcon:{width:38,height:38,borderRadius:12,backgroundColor:T.coralSoft,alignItems:'center',justifyContent:'center'},priorityTitle:{color:T.ink,fontSize:9.8,fontWeight:'900'},priorityMeta:{color:T.coral,fontSize:6.3,fontWeight:'900'},priorityText:{color:T.muted,fontSize:8,lineHeight:12.5,marginTop:3},
    shortcut:{width:'48.6%',minHeight:123,backgroundColor:T.surface,borderWidth:1,borderColor:T.line,borderRadius:19,padding:13},shortcutIcon:{width:35,height:35,borderRadius:12,alignItems:'center',justifyContent:'center'},shortcutTitle:{color:T.ink,fontSize:10.5,fontWeight:'900',marginTop:11},shortcutText:{color:T.muted,fontSize:7.8,marginTop:4},shortcutArrow:{position:'absolute',right:12,top:12},
    healthCard:{backgroundColor:T.surface,borderWidth:1,borderColor:T.line,borderRadius:21,padding:17},healthBig:{color:T.ink,fontSize:33,fontWeight:'900'},muted:{color:T.muted,fontSize:8.5},badge:{borderRadius:12,paddingHorizontal:9,paddingVertical:6,flexDirection:'row',alignItems:'center',gap:5},progressTrack:{height:6,backgroundColor:T.surface3,borderRadius:6,overflow:'hidden',marginTop:16},progressFill:{height:'100%',backgroundColor:T.mint,borderRadius:6},
    zoneRow:{paddingVertical:11},zoneHead:{flexDirection:'row',alignItems:'center',gap:8},zoneDot:{width:7,height:7,borderRadius:7},zoneName:{flex:1,color:T.text,fontSize:9,fontWeight:'800'},zoneCount:{color:T.ink,fontSize:9.5,fontWeight:'900'},zoneTrack:{height:5,backgroundColor:T.surface3,borderRadius:5,overflow:'hidden',marginTop:7},zoneFill:{height:'100%',borderRadius:5},
    deviceRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:11},divider:{borderBottomWidth:1,borderBottomColor:T.line},deviceIcon:{width:37,height:37,borderRadius:12,alignItems:'center',justifyContent:'center'},deviceName:{color:T.ink,fontSize:9.5,fontWeight:'900'},deviceMeta:{color:T.muted,fontSize:7.8,marginTop:3},statusDot:{width:7,height:7,borderRadius:7},
    fabricCard:{backgroundColor:T.surface,borderRadius:23,borderWidth:1,borderColor:T.line,padding:17,alignItems:'center'},fabricNode:{width:'84%',backgroundColor:T.surface2,borderRadius:17,padding:12,flexDirection:'row',alignItems:'center',gap:9,borderWidth:1,borderColor:T.line},fabricNodeIcon:{width:39,height:39,borderRadius:12,alignItems:'center',justifyContent:'center'},fabricName:{color:T.ink,fontSize:10.5,fontWeight:'900'},fabricIp:{color:T.muted,fontSize:8,marginLeft:'auto'},flowPath:{height:76,width:38,alignItems:'center',overflow:'hidden'},flowLine:{position:'absolute',width:2,height:'100%',backgroundColor:T.lineStrong},packet:{position:'absolute',width:9,height:9,borderRadius:9},modeButton:{height:32,borderRadius:11,paddingHorizontal:9,backgroundColor:T.surface,borderWidth:1,borderColor:T.line,flexDirection:'row',alignItems:'center',gap:5},modeText:{color:T.text,fontSize:7.5,fontWeight:'900'},
    micro:{color:T.muted,fontSize:7,fontWeight:'900',letterSpacing:1.25},hostList:{gap:8},hostRow:{backgroundColor:T.surface,borderRadius:15,borderWidth:1,borderColor:T.line,padding:11,flexDirection:'row',alignItems:'center',gap:9},hostIcon:{width:35,height:35,borderRadius:11,alignItems:'center',justifyContent:'center'},hostName:{color:T.ink,fontSize:9.5,fontWeight:'900'},hostMeta:{color:T.muted,fontSize:7.7,marginTop:3},vlanPill:{borderRadius:9,paddingHorizontal:7,paddingVertical:5},vlanText:{fontSize:6.5,fontWeight:'900'},
    twinHero:{backgroundColor:T.surface,borderWidth:1,borderColor:T.violet+'55',borderRadius:21,padding:15},twinTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'},twinTitle:{color:T.ink,fontSize:15,fontWeight:'900',marginTop:4},twinMeta:{color:T.muted,fontSize:8,lineHeight:13,marginTop:6},twinStats:{flexDirection:'row',gap:8,marginTop:12},twinStat:{flex:1,backgroundColor:T.surface2,borderRadius:13,padding:9,borderWidth:1,borderColor:T.line},twinStatValue:{color:T.ink,fontSize:15,fontWeight:'900'},twinStatLabel:{color:T.muted,fontSize:6.5,marginTop:2},zoneChips:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:11},zoneChip:{borderRadius:999,borderWidth:1,borderColor:T.line,paddingHorizontal:8,paddingVertical:6,backgroundColor:T.surface2},zoneChipText:{color:T.text,fontSize:6.8,fontWeight:'800'},confidence:{marginTop:11,borderTopWidth:1,borderTopColor:T.line,paddingTop:10},confidenceText:{color:T.muted,fontSize:7.5,lineHeight:12},
    posture:{borderRadius:23,padding:18,overflow:'hidden'},postureKicker:{color:'#D3F7EC',fontSize:7,fontWeight:'900',letterSpacing:1.2},postureTitle:{color:'#FFFFFF',fontSize:29,fontWeight:'900',marginTop:7},postureText:{color:'#D1DAE7',fontSize:8.5,lineHeight:13.5,marginTop:5},
    alertRow:{flexDirection:'row',gap:10,paddingVertical:11},alertIcon:{width:37,height:37,borderRadius:12,alignItems:'center',justifyContent:'center'},alertTitleRow:{flexDirection:'row',gap:7},alertTitle:{color:T.ink,fontSize:9.5,fontWeight:'900',flex:1},alertSeverity:{fontSize:6.2,fontWeight:'900'},alertText:{color:T.muted,fontSize:8,lineHeight:12.5,marginTop:3},investigate:{alignSelf:'flex-start',marginTop:7,borderRadius:10,backgroundColor:T.violetSoft,paddingHorizontal:9,paddingVertical:7,flexDirection:'row',alignItems:'center',gap:5},investigateText:{color:T.violet,fontSize:7,fontWeight:'900'},
    caseCard:{backgroundColor:T.surface,borderWidth:1,borderColor:T.violet+'55',borderRadius:21,padding:14},caseHead:{flexDirection:'row',gap:9},caseKicker:{color:T.coral,fontSize:6.4,fontWeight:'900',letterSpacing:.9},caseTitle:{color:T.ink,fontSize:15,fontWeight:'900',marginTop:4},caseAssessment:{color:T.text,fontSize:8.5,lineHeight:14,marginTop:9},caseState:{borderRadius:12,paddingHorizontal:8,paddingVertical:6,backgroundColor:T.coralSoft},caseStateText:{color:T.coral,fontSize:6,fontWeight:'900'},evidenceList:{marginTop:9},evidenceRow:{flexDirection:'row',gap:8,minHeight:46},evidenceRail:{width:13,alignItems:'center'},evidenceDot:{width:7,height:7,borderRadius:7,marginTop:3},evidenceStem:{width:1,flex:1,backgroundColor:T.line,marginTop:3},evidenceLabel:{color:T.muted,fontSize:6.3,fontWeight:'900'},evidenceValue:{color:T.ink,fontSize:8.8,fontWeight:'800',marginTop:2},evidenceSource:{color:T.faint,fontSize:6.8,marginTop:2},
    pathRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:9},pathNode:{flex:1,alignItems:'center',maxWidth:94},pathIcon:{width:31,height:31,borderRadius:10,alignItems:'center',justifyContent:'center'},pathLabel:{color:T.ink,fontSize:7.2,fontWeight:'900',marginTop:4,textAlign:'center'},pathCert:{color:T.faint,fontSize:5.6,marginTop:2,textAlign:'center'},
    recommendation:{minHeight:45,borderRadius:13,borderWidth:1,borderColor:T.line,backgroundColor:T.surface2,paddingHorizontal:9,flexDirection:'row',alignItems:'center',gap:8,marginTop:6},recommendNo:{width:26,height:26,borderRadius:8,backgroundColor:T.violetSoft,alignItems:'center',justifyContent:'center'},recommendNoText:{color:T.violet,fontSize:7.5,fontWeight:'900'},recommendText:{flex:1,color:T.text,fontSize:8,fontWeight:'800'},
    closeCase:{height:40,borderRadius:12,backgroundColor:T.mintSoft,marginTop:11,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},closeCaseText:{color:T.mint,fontSize:7.8,fontWeight:'900'},
    planList:{gap:10},plan:{backgroundColor:T.surface,borderWidth:1,borderColor:T.line,borderRadius:18,padding:13},planTop:{flexDirection:'row',gap:8},planKicker:{color:T.amber,fontSize:6.1,fontWeight:'900'},planTitle:{color:T.ink,fontSize:10,fontWeight:'900',marginTop:3},planStatus:{color:T.muted,fontSize:6,fontWeight:'900'},planSummary:{color:T.muted,fontSize:8,lineHeight:12.5,marginTop:7},codeBox:{backgroundColor:'#0D1B31',borderRadius:11,padding:9,marginTop:9},codeLine:{color:'#C2F3E4',fontSize:7,lineHeight:11.5,fontFamily:'monospace'},rollbackLabel:{color:T.mint,fontSize:6.2,fontWeight:'900',marginTop:7},planButtons:{flexDirection:'row',gap:7,marginTop:10},planButton:{flex:1,minHeight:37,borderRadius:10,alignItems:'center',justifyContent:'center',paddingHorizontal:6,borderWidth:1,borderColor:T.line},planButtonPrimary:{backgroundColor:T.mint,borderColor:T.mint},planButtonViolet:{backgroundColor:T.violetSoft,borderColor:T.violet+'55'},planButtonDanger:{backgroundColor:T.coralSoft,borderColor:T.coral+'55'},planButtonText:{color:T.text,fontSize:6.7,fontWeight:'900',textAlign:'center'},planButtonPrimaryText:{color:'#0E2520'},verificationBox:{marginTop:9,borderRadius:12,backgroundColor:T.surface2,borderWidth:1,borderColor:T.line,padding:9},verificationTitle:{color:T.ink,fontSize:7.5,fontWeight:'900'},verificationText:{color:T.muted,fontSize:7.4,lineHeight:11.5,marginTop:4},lifecycle:{marginTop:10,gap:6},lifeRow:{flexDirection:'row',gap:7,alignItems:'flex-start'},lifeDot:{width:7,height:7,borderRadius:7,backgroundColor:T.violet,marginTop:3},lifeText:{color:T.muted,fontSize:7.2,lineHeight:11,flex:1},
    aiHero:{borderRadius:23,padding:19,overflow:'hidden'},aiOrb:{width:56,height:56,borderRadius:28,borderWidth:1,borderColor:'rgba(255,255,255,.18)',alignItems:'center',justifyContent:'center'},aiOrbInner:{width:43,height:43,borderRadius:22,backgroundColor:'#6F61F6',alignItems:'center',justifyContent:'center'},aiOrbText:{color:'#FFFFFF',fontSize:19,fontWeight:'900'},aiTitle:{color:'#FFFFFF',fontSize:24,lineHeight:28,fontWeight:'900',marginTop:16},aiText:{color:'#CBC7DE',fontSize:9.5,lineHeight:15,marginTop:6},modelRow:{flexDirection:'row',alignItems:'center',gap:6,marginTop:14},modelText:{color:'#C7C1FF',fontSize:7,fontWeight:'800'},
    contextPill:{height:29,borderRadius:14,paddingHorizontal:8,flexDirection:'row',alignItems:'center',gap:5,borderWidth:1,borderColor:T.line},contextText:{color:T.muted,fontSize:6.2,fontWeight:'900'},composer:{minHeight:60,maxHeight:120,backgroundColor:T.surface,borderWidth:1,borderColor:T.lineStrong,borderRadius:18,padding:7,flexDirection:'row',alignItems:'flex-end',gap:7},composerInput:{flex:1,minHeight:43,maxHeight:104,paddingHorizontal:7,paddingVertical:9,color:T.ink,fontSize:10,lineHeight:15},send:{width:43,height:43,borderRadius:14,backgroundColor:T.ink,alignItems:'center',justifyContent:'center'},chips:{gap:7,paddingRight:10},chip:{borderWidth:1,borderColor:T.line,backgroundColor:T.surface,borderRadius:999,paddingHorizontal:10,paddingVertical:8},chipText:{color:T.text,fontSize:7.6,fontWeight:'800'},
    runCard:{backgroundColor:T.surface,borderRadius:20,borderWidth:1,borderColor:T.line,padding:13},runHead:{flexDirection:'row',gap:9},runLabel:{color:T.violet,fontSize:6.3,fontWeight:'900',letterSpacing:1},runPrompt:{color:T.ink,fontSize:11.5,fontWeight:'900',lineHeight:16,marginTop:4},runState:{height:24,borderRadius:12,paddingHorizontal:8,justifyContent:'center'},runStateText:{fontSize:5.9,fontWeight:'900'},thinking:{marginTop:11,borderRadius:12,backgroundColor:T.violetSoft,padding:9,flexDirection:'row',alignItems:'center',gap:7},thinkingDot:{width:7,height:7,borderRadius:7,backgroundColor:T.violet},thinkingText:{color:T.text,fontSize:7.8,fontWeight:'800'},
    evidenceSummary:{marginTop:12,gap:7},agentEvidence:{flexDirection:'row',gap:7,alignItems:'flex-start'},checkBox:{width:19,height:19,borderRadius:7,backgroundColor:T.mintSoft,alignItems:'center',justifyContent:'center'},agentEvidenceText:{color:T.text,fontSize:7.8,lineHeight:12.5,flex:1},traceToggle:{marginTop:12,minHeight:40,borderRadius:12,borderWidth:1,borderColor:T.line,backgroundColor:T.surface2,paddingHorizontal:10,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},traceToggleText:{color:T.text,fontSize:7.8,fontWeight:'900'},traceRow:{flexDirection:'row',gap:8,minHeight:40},traceRail:{width:12,alignItems:'center'},traceDot:{width:7,height:7,borderRadius:7,marginTop:3},traceStem:{width:1,flex:1,backgroundColor:T.line,marginTop:3},traceTitle:{color:T.text,fontSize:8,fontWeight:'900'},traceDetail:{color:T.muted,fontSize:7.2,lineHeight:11.5,marginTop:2},
    answer:{marginTop:13,borderRadius:16,backgroundColor:T.violetSoft,borderWidth:1,borderColor:T.violet+'44',padding:11},answerHead:{flexDirection:'row',alignItems:'center',gap:8},answerLogo:{width:32,height:32,borderRadius:11,backgroundColor:T.violet,alignItems:'center',justifyContent:'center'},answerLogoText:{color:'#FFFFFF',fontSize:13,fontWeight:'900'},answerKicker:{color:T.violet,fontSize:6.3,fontWeight:'900',letterSpacing:.9},answerMeta:{color:T.faint,fontSize:6.3,marginTop:2},answerSections:{gap:8,marginTop:10},answerSection:{backgroundColor:T.surface,borderRadius:12,borderWidth:1,borderColor:T.line,padding:9},answerSectionHead:{flexDirection:'row',alignItems:'center',gap:6},answerSectionIcon:{width:25,height:25,borderRadius:8,alignItems:'center',justifyContent:'center'},answerSectionLabel:{fontSize:6.4,fontWeight:'900',letterSpacing:.7},answerSectionText:{color:T.text,fontSize:8.3,lineHeight:13.5,marginTop:6},followups:{marginTop:10,gap:6},followup:{borderRadius:11,borderWidth:1,borderColor:T.line,backgroundColor:T.surface,padding:9,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},followupText:{color:T.text,fontSize:7.6,fontWeight:'800',flex:1},aiEmpty:{backgroundColor:T.surface,borderWidth:1,borderColor:T.line,borderRadius:18,padding:22,alignItems:'center'},aiEmptyIcon:{width:46,height:46,borderRadius:15,backgroundColor:T.violetSoft,alignItems:'center',justifyContent:'center'},aiEmptyTitle:{color:T.ink,fontSize:10.5,fontWeight:'900',marginTop:9},aiEmptyText:{color:T.muted,fontSize:8,lineHeight:12.5,textAlign:'center',marginTop:4,maxWidth:280},
    connectionHero:{borderRadius:22,padding:17,borderWidth:1,borderColor:T.line,backgroundColor:T.surface},connectionIcon:{width:45,height:45,borderRadius:14,alignItems:'center',justifyContent:'center'},connectionTitle:{color:T.ink,fontSize:16,fontWeight:'900',marginTop:12},connectionText:{color:T.muted,fontSize:8.5,lineHeight:13.5,marginTop:5},connectionState:{alignSelf:'flex-start',marginTop:11,borderRadius:11,paddingHorizontal:9,paddingVertical:6,flexDirection:'row',alignItems:'center',gap:5},fieldLabel:{color:T.text,fontSize:8,fontWeight:'900',marginBottom:6,marginTop:7},inputWrap:{height:47,borderWidth:1,borderColor:T.lineStrong,borderRadius:13,backgroundColor:T.surface2,paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:8},input:{flex:1,color:T.ink,fontSize:9.5},connectButton:{height:47,borderRadius:13,backgroundColor:T.mint,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,marginTop:14},connectButtonText:{color:'#0D2821',fontSize:8.5,fontWeight:'900'},tip:{backgroundColor:T.surface,borderWidth:1,borderColor:T.line,borderRadius:15,padding:11,flexDirection:'row',gap:9},tipIcon:{width:35,height:35,borderRadius:11,alignItems:'center',justifyContent:'center'},tipTitle:{color:T.ink,fontSize:9,fontWeight:'900'},tipText:{color:T.muted,fontSize:7.7,lineHeight:12.5,marginTop:3},
    nav:{height:74,backgroundColor:T.nav,borderTopWidth:1,borderTopColor:T.line,flexDirection:'row',paddingHorizontal:7,paddingTop:7,shadowColor:T.shadow,shadowOpacity:.08,shadowRadius:14,shadowOffset:{width:0,height:-6}},navItem:{flex:1,alignItems:'center',gap:3},navIcon:{width:38,height:34,borderRadius:12,alignItems:'center',justifyContent:'center'},navIconActive:{backgroundColor:T.mintSoft},navText:{color:T.muted,fontSize:6.5,fontWeight:'800'},navTextActive:{color:T.ink,fontWeight:'900'},
  });
}

const ThemeContext = createContext<{T:Palette;s:ReturnType<typeof makeStyles>;dark:boolean}>({T:LIGHT,s:makeStyles(LIGHT),dark:false});
const useTheme = () => useContext(ThemeContext);

function Icon({name,size=18,color}:{name:IconName;size?:number;color?:string}) {
  const {T}=useTheme();
  return <Feather name={name} size={size} color={color || T.ink}/>;
}
function SectionHead({eyebrow,title,action}:{eyebrow:string;title:string;action?:React.ReactNode}) {
  const {s}=useTheme();
  return <View style={s.sectionHead}><View style={{flex:1}}><Text style={s.eyebrow}>{eyebrow}</Text><Text style={s.sectionTitle}>{title}</Text></View>{action}</View>;
}
function cleanMarkup(text:string) {
  return String(text||'').replace(/^#{1,6}\s*/gm,'').replace(/\*\*(.*?)\*\*/g,'$1').replace(/__(.*?)__/g,'$1').replace(/`([^`]+)`/g,'$1').trim();
}
function operatorSections(text:string) {
  const labels=['OBSERVED','INFERRED','RISK','NEXT CHECKS','CONFIDENCE'];
  const result:{label:string;body:string}[]=[];
  let current={label:'NEXUS RESPONSE',body:''};
  for(const raw of String(text||'').split('\n')) {
    const candidate=raw.trim().toUpperCase().replace(/[:#*]/g,'').trim();
    const label=labels.find(x=>x===candidate);
    if(label){ if(current.body.trim()) result.push({...current,body:cleanMarkup(current.body)}); current={label,body:''}; }
    else current.body += (current.body?'\n':'') + raw;
  }
  if(current.body.trim()) result.push({...current,body:cleanMarkup(current.body)});
  return result;
}
function severityColor(T:Palette,value:string) { return ['critical','high'].includes(value)?T.coral:['warning','medium'].includes(value)?T.amber:T.mint; }

function Header({live,themeMode,onToggleTheme,onConnect,onRefresh}:{live:boolean;themeMode:ThemeMode;onToggleTheme:()=>void;onConnect:()=>void;onRefresh:()=>void}) {
  const {T,s}=useTheme();
  return <View style={s.header}>
    <View style={s.brandRow}>
      <LinearGradient colors={[T.mint,T.violet]} start={{x:0,y:0}} end={{x:1,y:1}} style={s.logo}><Text style={s.logoText}>N</Text></LinearGradient>
      <View><Text style={s.brand}>NEXUS</Text><Text style={s.brandSub}>V10 · DIGITAL TWIN</Text></View>
    </View>
    <View style={s.headerActions}>
      <Pressable onPress={onRefresh} style={[s.livePill,{backgroundColor:live?T.mintSoft:T.surface2}]}>
        {live?<PulseHalo color={T.mint}/>:<View style={[s.statusDot,{backgroundColor:T.faint}]}/>}
        <Text style={[s.liveText,{color:live?T.mint:T.muted}]}>{live?'LIVE':'PREVIEW'}</Text>
      </Pressable>
      <Pressable onPress={onToggleTheme} style={s.roundButton}><Icon name={themeMode==='dark'?'sun':'moon'} size={16} color={themeMode==='dark'?'#F6D36A':T.text}/></Pressable>
      <Pressable onPress={onConnect} style={s.roundButton}><Icon name="link-2" size={16} color={T.text}/></Pressable>
    </View>
  </View>;
}

function Stat({icon,value,label,tone}:{icon:IconName;value:string|number;label:string;tone:'mint'|'violet'|'blue'|'coral'}) {
  const {T,s}=useTheme();
  const color=tone==='mint'?T.mint:tone==='violet'?T.violet:tone==='blue'?T.blue:T.coral;
  const bg=tone==='mint'?T.mintSoft:tone==='violet'?T.violetSoft:tone==='blue'?T.blueSoft:T.coralSoft;
  return <View style={s.stat}><View style={[s.statIcon,{backgroundColor:bg}]}><Icon name={icon} size={16} color={color}/></View><Text style={s.statValue}>{value}</Text><Text style={s.statLabel}>{label}</Text></View>;
}
function ChangeCard({change}:{change:TelemetryChange}) {
  const {T,s}=useTheme(); const color=severityColor(T,change.severity);
  return <View style={[s.cardFlat,s.changeRow]}><View style={[s.changeIcon,{backgroundColor:color+'1E'}]}><Icon name={change.type.includes('resolved')?'check-circle':change.type.includes('host')?'monitor':'activity'} size={16} color={color}/></View><View style={{flex:1}}><View style={s.changeTitleRow}><Text style={s.changeTitle}>{change.title}</Text><Text style={s.changeTime}>{new Date(change.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</Text></View><Text style={s.changeDetail}>{change.detail}</Text></View></View>;
}

function Home({live,network,topology,security,changes,digitalTwin,setPage}:{live:boolean;network:NetworkHealth;topology:NetworkTopology|null;security:SecurityAnalysis|null;changes:TelemetryChange[];digitalTwin:DigitalTwin|null;setPage:(p:MobilePage)=>void}) {
  const {T,s}=useTheme();
  const hosts=topology?.nodes.filter(n=>n.kind==='host')||[]; const alerts=security?.alertCount||0; const topAlert=security?.alerts?.[0];
  const latest=changes.find(x=>x.type!=='baseline')||changes[0];
  const score=Math.max(24,Math.min(100,Math.round((network.reachableCount/Math.max(network.deviceCount,1))*76+(alerts?8:24))));
  return <View style={s.page}>
    <Reveal><LinearGradient colors={[T.heroA,T.heroB,T.heroC]} start={{x:0,y:0}} end={{x:1,y:1}} style={s.hero}>
      <View style={s.heroGlowA}/><View style={s.heroGlowB}/><View style={s.heroTop}><Text style={s.heroKicker}>AUTONOMOUS · LOCAL · HUMAN CONTROLLED</Text><View style={s.heroBadge}><Text style={s.heroBadgeText}>{live?'SYNCED':'DEMO'}</Text></View></View>
      <Text style={s.heroTitle}>See the network.{"\n"}Understand the change.</Text>
      <Text style={s.heroCopy}>NEXUS combines live Packet Tracer evidence, a digital twin and local AI into one incident-ready operating picture.</Text>
      <View style={s.heroActions}><Pressable onPress={()=>setPage('agent')} style={[s.heroButton,{backgroundColor:T.mint}]}><Icon name="command" size={15} color="#10231E"/><Text style={[s.heroButtonText,{color:'#10231E'}]}>ASK NEXUS</Text></Pressable><Pressable onPress={()=>setPage('topology')} style={[s.heroButton,{backgroundColor:'#FFFFFF'}]}><Icon name="share-2" size={15} color="#172033"/><Text style={[s.heroButtonText,{color:'#172033'}]}>DIGITAL TWIN</Text></Pressable></View>
      <View style={s.heroPulse}><View style={s.healthRing}><Text style={s.healthNumber}>{score}</Text><Text style={s.healthLabel}>HEALTH</Text></View><View style={{flex:1}}><Text style={s.heroPulseTitle}>{network.allReachable?'Infrastructure reachable':'Connectivity needs review'}</Text><Text style={s.heroPulseSub}>{network.reachableCount}/{network.deviceCount} devices · {hosts.length} endpoints · {alerts} signals · {digitalTwin?.links.length||0} relationships</Text></View></View>
    </LinearGradient></Reveal>

    <View style={s.grid2}><Stat icon="server" value={network.deviceCount} label="Infrastructure" tone="blue"/><Stat icon="monitor" value={hosts.length} label="Endpoints" tone="violet"/><Stat icon="git-branch" value={digitalTwin?.links.length||0} label="Twin links" tone="mint"/><Stat icon="shield" value={alerts} label="Signals" tone="coral"/></View>

    <SectionHead eyebrow="LIVE CHANGE" title="What just changed"/>
    {latest?<ChangeCard change={latest}/>:<View style={s.cardFlat}><Text style={[s.changeTitle,{color:T.mint}]}>Baseline established</Text><Text style={s.changeDetail}>NEXUS will surface device, host, segment and security changes here.</Text></View>}

    <SectionHead eyebrow="PRIORITY" title="What needs attention" action={<Pressable onPress={()=>setPage('security')}><Text style={s.sectionAction}>View all</Text></Pressable>}/>
    {topAlert?<Pressable onPress={()=>setPage('security')} style={s.priority}><View style={s.priorityIcon}><Icon name="alert-triangle" size={17} color={T.coral}/></View><View style={{flex:1}}><View style={s.changeTitleRow}><Text style={s.priorityTitle}>{topAlert.title}</Text><Text style={s.priorityMeta}>{topAlert.severity.toUpperCase()}</Text></View><Text style={s.priorityText}>{topAlert.detail}</Text></View><Icon name="chevron-right" size={17} color={T.faint}/></Pressable>:<View style={s.cardFlat}><Text style={[s.changeTitle,{color:T.mint}]}>No urgent signal</Text><Text style={s.changeDetail}>Current NEXUS heuristics are quiet.</Text></View>}

    <SectionHead eyebrow="WORKSPACES" title="Jump back in"/>
    <View style={s.grid2}>{[
      ['grid','Overview','Health & recent changes','dashboard',T.blue,T.blueSoft],
      ['share-2','Fabric','Digital twin & trust zones','topology',T.mint,T.mintSoft],
      ['shield','Defend','Incidents & verified response','security',T.coral,T.coralSoft],
      ['command','NEXUS AI','Ask topology-aware questions','agent',T.violet,T.violetSoft],
    ].map(([icon,title,sub,target,color,bg])=><Pressable key={String(title)} onPress={()=>setPage(target as MobilePage)} style={s.shortcut}><View style={[s.shortcutIcon,{backgroundColor:String(bg)}]}><Icon name={icon as IconName} size={17} color={String(color)}/></View><Text style={s.shortcutTitle}>{title}</Text><Text style={s.shortcutText}>{sub}</Text><View style={s.shortcutArrow}><Icon name="arrow-up-right" size={14} color={String(color)}/></View></Pressable>)}</View>
  </View>;
}

function Overview({network,topology,security,changes}:{network:NetworkHealth;topology:NetworkTopology|null;security:SecurityAnalysis|null;changes:TelemetryChange[]}) {
  const {T,s}=useTheme(); const hosts=topology?.nodes.filter(n=>n.kind==='host')||[];
  const zones=[
    {name:'Trusted',count:hosts.filter(n=>['ADMIN','STAFF'].includes(n.zone)).length,color:T.mint},
    {name:'Sensitive',count:hosts.filter(n=>n.zone==='FINANCE').length,color:T.amber},
    {name:'Guest',count:hosts.filter(n=>n.zone==='GUEST').length,color:T.coral},
    {name:'Protected',count:hosts.filter(n=>['SERVER','MANAGEMENT'].includes(n.zone)).length,color:T.violet},
  ];
  return <View style={s.page}>
    <SectionHead eyebrow="OVERVIEW" title="Network health"/>
    <View style={s.healthCard}><Text style={s.healthBig}>{network.reachableCount}/{network.deviceCount}</Text><Text style={s.muted}>Infrastructure reachable</Text><View style={[s.badge,{position:'absolute',right:15,top:15,backgroundColor:network.allReachable?T.mintSoft:T.amberSoft}]}><Icon name={network.allReachable?'check-circle':'alert-circle'} size={14} color={network.allReachable?T.mint:T.amber}/><Text style={[s.sectionAction,{color:network.allReachable?T.mint:T.amber}]}>{network.allReachable?'HEALTHY':'REVIEW'}</Text></View><View style={s.progressTrack}><View style={[s.progressFill,{width:(Math.min(100,network.reachableCount/Math.max(network.deviceCount,1)*100)+'%') as any}]}/></View></View>
    <View style={s.grid2}><Stat icon="monitor" value={hosts.length} label="Observed hosts" tone="violet"/><Stat icon="shield" value={security?.alertCount||0} label="Active signals" tone="coral"/><Stat icon="alert-octagon" value={security?.criticalCount||0} label="Critical" tone="coral"/><Stat icon="wifi" value={network.controllerOnline?'On':'Off'} label="Controller" tone="mint"/></View>
    <SectionHead eyebrow="LIVE TELEMETRY" title="Recent changes"/><View style={{gap:8}}>{changes.length?changes.slice(0,4).map(c=><ChangeCard key={c.id} change={c}/>):<View style={s.cardFlat}><Text style={s.changeTitle}>No change events yet</Text><Text style={s.changeDetail}>Change detection will populate after the live baseline moves.</Text></View>}</View>
    <SectionHead eyebrow="SEGMENTATION" title="Trust zones"/><View style={s.card}>{zones.map(z=><View key={z.name} style={s.zoneRow}><View style={s.zoneHead}><View style={[s.zoneDot,{backgroundColor:z.color}]}/><Text style={s.zoneName}>{z.name}</Text><Text style={s.zoneCount}>{z.count}</Text></View><View style={s.zoneTrack}><View style={[s.zoneFill,{backgroundColor:z.color,width:(Math.max(8,z.count/Math.max(hosts.length,1)*100)+'%') as any}]}/></View></View>)}</View>
    <SectionHead eyebrow="INFRASTRUCTURE" title="Discovered devices"/><View style={s.card}>{network.devices.map((d,i)=><View key={d.id} style={[s.deviceRow,i<network.devices.length-1&&s.divider]}><View style={[s.deviceIcon,{backgroundColor:d.role==='core-switch'?T.mintSoft:T.violetSoft}]}><Icon name={d.role==='core-switch'?'cpu':'radio'} size={16} color={d.role==='core-switch'?T.mint:T.violet}/></View><View style={{flex:1}}><Text style={s.deviceName}>{d.name}</Text><Text style={s.deviceMeta}>{d.managementIp} · {d.interfaces} interfaces</Text></View><View style={[s.statusDot,{backgroundColor:d.status==='online'?T.mint:T.coral}]}/></View>)}</View>
  </View>;
}

function TwinSummary({digitalTwin}:{digitalTwin:DigitalTwin|null}) {
  const {T,s}=useTheme();
  if(!digitalTwin) return <View style={s.twinHero}><Text style={s.twinTitle}>Digital twin waiting for live data</Text><Text style={s.twinMeta}>Connect the lab to build asset, relationship and trust-zone context.</Text></View>;
  return <View style={s.twinHero}>
    <View style={s.twinTop}><View><Text style={s.eyebrow}>NETWORK DIGITAL TWIN</Text><Text style={s.twinTitle}>Relationship intelligence</Text></View><View style={[s.badge,{backgroundColor:T.violetSoft}]}><Icon name="git-branch" size={13} color={T.violet}/><Text style={[s.sectionAction,{color:T.violet}]}>LIVE MODEL</Text></View></View>
    <Text style={s.twinMeta}>NEXUS distinguishes controller observations, known lab relationships and inferred links instead of treating every graph edge as verified reachability.</Text>
    <View style={s.twinStats}><View style={s.twinStat}><Text style={s.twinStatValue}>{digitalTwin.nodes.length}</Text><Text style={s.twinStatLabel}>ASSETS</Text></View><View style={s.twinStat}><Text style={s.twinStatValue}>{digitalTwin.links.length}</Text><Text style={s.twinStatLabel}>RELATIONSHIPS</Text></View><View style={s.twinStat}><Text style={s.twinStatValue}>{digitalTwin.zones.length}</Text><Text style={s.twinStatLabel}>ZONES</Text></View></View>
    <View style={s.zoneChips}>{digitalTwin.zones.map(z=><View key={z.id} style={s.zoneChip}><Text style={s.zoneChipText}>{z.name}{z.vlan? ` · VLAN ${z.vlan}`:''} · {z.count}</Text></View>)}</View>
    <View style={s.confidence}><Text style={s.confidenceText}>Physical topology: {digitalTwin.confidence.physicalTopology} · Endpoint attachments: {digitalTwin.confidence.endpointAttachments} · Policy enforcement: {digitalTwin.confidence.policyEnforcement}</Text></View>
  </View>;
}

type TwinIntent =
  | { type:'focus'; asset:string; nonce:number }
  | { type:'path'; source:string; target:string; nonce:number }
  | { type:'blast'; asset:string; nonce:number }
  | null;

function InteractiveTwinGraph({digitalTwin,intent}:{digitalTwin:DigitalTwin|null;intent:TwinIntent}) {
  const {T,s}=useTheme();
  const [width,setWidth]=useState(340);
  const [selected,setSelected]=useState('');
  const [mode,setMode]=useState<'focus'|'neighbors'|'path'|'blast'>('focus');
  const [pathTarget,setPathTarget]=useState('SERVER');

  const nodes=digitalTwin?.nodes || [];
  const links=digitalTwin?.links || [];

  const positions=useMemo(()=>{
    const map=new Map<string,{x:number;y:number}>();
    const edge=nodes.find(n=>n.role==='edge-router');
    const core=nodes.find(n=>n.role==='core-switch');
    if(edge) map.set(edge.id,{x:.5,y:.10});
    if(core) map.set(core.id,{x:.5,y:.32});
    const endpoints=nodes.filter(n=>n.id!==edge?.id&&n.id!==core?.id);
    endpoints.forEach((node,index)=>{
      const perRow=4;
      const row=Math.floor(index/perRow);
      const col=index%perRow;
      const count=Math.min(perRow,endpoints.length-row*perRow);
      const x=count===1?.5:(col+1)/(count+1);
      map.set(node.id,{x,y:.61+row*.24});
    });
    nodes.forEach((node,index)=>{if(!map.has(node.id))map.set(node.id,{x:(index%3+1)/4,y:.55+Math.floor(index/3)*.2});});
    return map;
  },[nodes]);

  const resolve=(value:string)=>nodes.find(n=>n.id===value||n.label.toLowerCase()===value.toLowerCase()||n.ip===value) || nodes.find(n=>n.label.toLowerCase().includes(value.toLowerCase()));

  const adjacency=useMemo(()=>{
    const map=new Map<string,{id:string;link:(typeof links)[number]}[]>();
    nodes.forEach(n=>map.set(n.id,[]));
    links.forEach(link=>{
      map.get(link.source)?.push({id:link.target,link});
      map.get(link.target)?.push({id:link.source,link});
    });
    return map;
  },[nodes,links]);

  const findPath=(sourceId:string,targetId:string)=>{
    if(!sourceId||!targetId)return [] as string[];
    const queue=[sourceId], seen=new Set([sourceId]), prev=new Map<string,string>();
    while(queue.length){
      const current=queue.shift()!;
      if(current===targetId)break;
      for(const edge of adjacency.get(current)||[]){
        if(seen.has(edge.id))continue;
        seen.add(edge.id); prev.set(edge.id,current); queue.push(edge.id);
      }
    }
    if(!seen.has(targetId))return [];
    const out=[targetId]; let cursor=targetId;
    while(cursor!==sourceId){const p=prev.get(cursor);if(!p)break;cursor=p;out.push(cursor);}
    return out.reverse();
  };

  useEffect(()=>{
    if(!intent||!digitalTwin)return;
    if(intent.type==='focus'){
      const node=resolve(intent.asset); if(node){setSelected(node.id);setMode('focus');}
    }
    if(intent.type==='blast'){
      const node=resolve(intent.asset); if(node){setSelected(node.id);setMode('blast');}
    }
    if(intent.type==='path'){
      const source=resolve(intent.source); const target=resolve(intent.target);
      if(source){setSelected(source.id);setMode('path');setPathTarget(target?.label||intent.target);}
    }
  },[intent?.nonce,digitalTwin?.generatedAt]);

  useEffect(()=>{
    if(!selected&&nodes.length){
      const marker=nodes.find(n=>n.labThreatMarker);
      setSelected(marker?.id || nodes.find(n=>n.role==='core-switch')?.id || nodes[0].id);
    }
  },[nodes.length]);

  const selectedNode=nodes.find(n=>n.id===selected)||null;
  const targetNode=resolve(pathTarget);
  const pathIds=mode==='path'&&selectedNode&&targetNode?findPath(selectedNode.id,targetNode.id):[];
  const highlightIds=useMemo(()=>{
    const ids=new Set<string>();
    if(!selectedNode)return ids;
    ids.add(selectedNode.id);
    if(mode==='neighbors') for(const edge of adjacency.get(selectedNode.id)||[]) ids.add(edge.id);
    if(mode==='path') pathIds.forEach(id=>ids.add(id));
    if(mode==='blast'){
      const queue=[{id:selectedNode.id,depth:0}],seen=new Set([selectedNode.id]);
      while(queue.length){
        const item=queue.shift()!;
        if(item.depth>=2)continue;
        for(const edge of adjacency.get(item.id)||[]){
          if(seen.has(edge.id))continue;
          seen.add(edge.id);ids.add(edge.id);queue.push({id:edge.id,depth:item.depth+1});
        }
      }
    }
    return ids;
  },[selectedNode?.id,mode,pathIds.join('|'),adjacency]);

  const activeLink=(link:(typeof links)[number])=>{
    if(mode==='focus')return link.source===selectedNode?.id||link.target===selectedNode?.id;
    return highlightIds.has(link.source)&&highlightIds.has(link.target);
  };
  const canvasHeight=nodes.length>6?430:390;
  const nodeW=82,nodeH=48;

  const modeText=selectedNode ? (
    mode==='focus' ? `${selectedNode.label} selected · tap another asset to inspect it.` :
    mode==='neighbors' ? `${selectedNode.label} has ${adjacency.get(selectedNode.id)?.length||0} direct graph relationship(s).` :
    mode==='blast' ? `Blast-radius view highlights graph-adjacent assets within 2 hops. This is not proof of compromise propagation.` :
    pathIds.length ? `Relationship path: ${pathIds.map(id=>nodes.find(n=>n.id===id)?.label).filter(Boolean).join(' → ')}. IP reachability remains unverified.` : `No graph relationship path found to ${pathTarget}.`
  ) : 'Select an asset to inspect the digital twin.';

  if(!digitalTwin) return <View style={s.twinGraphCard}><Text style={s.twinTitle}>Interactive twin waiting for live data</Text><Text style={s.twinMeta}>Connect the local lab to render asset relationships.</Text></View>;

  return <View style={s.twinGraphCard}>
    <View style={s.twinGraphHead}><View><Text style={s.eyebrow}>INTERACTIVE GRAPH</Text><Text style={s.twinTitle}>Tap an asset to inspect it</Text></View><View style={[s.badge,{backgroundColor:T.mintSoft}]}><View style={[s.statusDot,{backgroundColor:T.mint}]}/><Text style={[s.sectionAction,{color:T.mint}]}>LIVE</Text></View></View>
    <View onLayout={e=>setWidth(Math.max(280,e.nativeEvent.layout.width))} style={[s.graphCanvas,{height:canvasHeight}]}>
      {links.map(link=>{
        const a=positions.get(link.source),b=positions.get(link.target); if(!a||!b)return null;
        const x1=a.x*width,y1=a.y*canvasHeight,x2=b.x*width,y2=b.y*canvasHeight;
        const dx=x2-x1,dy=y2-y1,dist=Math.sqrt(dx*dx+dy*dy),angle=Math.atan2(dy,dx)*180/Math.PI;
        const active=activeLink(link);
        const lineColor=active?T.violet:T.lineStrong;
        const style=link.certainty==='observed'?'solid':link.certainty==='known-lab'?'dashed':'dotted';
        return <View key={link.id} style={[s.graphLine,{left:(x1+x2)/2-dist/2,top:(y1+y2)/2,width:dist,borderTopColor:lineColor,borderTopWidth:active?2.5:1.3,borderStyle:style as any,opacity:active?1:.58,transform:[{rotateZ:`${angle}deg`}]}]}/>;
      })}
      {nodes.map(node=>{
        const p=positions.get(node.id)!; const active=highlightIds.has(node.id)||node.id===selectedNode?.id;
        const danger=node.labThreatMarker||node.trustTier==='untrusted'; const critical=node.critical;
        const color=danger?T.coral:critical?T.violet:node.kind==='device'?T.blue:T.mint;
        const bg=danger?T.coralSoft:critical?T.violetSoft:node.kind==='device'?T.blueSoft:T.mintSoft;
        return <Pressable key={node.id} onPress={()=>{setSelected(node.id);setMode('focus');}} style={({pressed})=>[
          s.graphNode,{left:p.x*width-nodeW/2,top:p.y*canvasHeight-nodeH/2,width:nodeW,minHeight:nodeH,borderColor:active?color:T.line,backgroundColor:active?bg:T.surface,opacity:pressed?.86:1},
        ]}>
          <View style={[s.graphNodeDot,{backgroundColor:color}]}/><Text style={s.graphNodeLabel} numberOfLines={1}>{node.label}</Text><Text style={s.graphNodeMeta} numberOfLines={1}>{node.zone}{node.vlan?` · V${node.vlan}`:''}</Text>
        </Pressable>;
      })}
    </View>

    <View style={s.graphLegend}>
      {[['Observed','solid',T.mint],['Known lab','dashed',T.blue],['Inferred','dotted',T.faint]].map(([label,style,color])=><View key={String(label)} style={s.graphLegendItem}><View style={[s.graphLegendLine,{borderTopColor:String(color),borderStyle:style as any}]}/><Text style={s.graphLegendText}>{label}</Text></View>)}
    </View>

    {selectedNode&&<View style={s.assetInspector}>
      <View style={s.assetInspectorHead}><View style={{flex:1}}><Text style={s.micro}>SELECTED ASSET</Text><Text style={s.assetTitle}>{selectedNode.label}</Text><Text style={s.assetMeta}>{selectedNode.ip||selectedNode.managementIp||'No IP'} · {selectedNode.zone} · {selectedNode.trustTier}</Text></View>{selectedNode.critical&&<View style={[s.badge,{backgroundColor:T.violetSoft}]}><Icon name="shield" size={12} color={T.violet}/><Text style={[s.sectionAction,{color:T.violet}]}>PROTECTED</Text></View>}</View>
      <View style={s.assetFacts}><View style={s.assetFact}><Text style={s.assetFactLabel}>TYPE</Text><Text style={s.assetFactValue}>{selectedNode.assetType}</Text></View><View style={s.assetFact}><Text style={s.assetFactLabel}>INTERFACE</Text><Text style={s.assetFactValue}>{selectedNode.interface||'n/a'}</Text></View><View style={s.assetFact}><Text style={s.assetFactLabel}>TRUST</Text><Text style={s.assetFactValue}>{selectedNode.trustTier}</Text></View></View>
      <View style={s.graphControls}><Pressable onPress={()=>setMode('neighbors')} style={[s.graphControl,mode==='neighbors'&&{backgroundColor:T.mintSoft,borderColor:T.mint+'55'}]}><Icon name="share-2" size={12} color={T.mint}/><Text style={s.graphControlText}>Neighbors</Text></Pressable><Pressable onPress={()=>{setPathTarget(selectedNode.label==='SERVER'?'ATTACKER-PC':'SERVER');setMode('path');}} style={[s.graphControl,mode==='path'&&{backgroundColor:T.violetSoft,borderColor:T.violet+'55'}]}><Icon name="git-branch" size={12} color={T.violet}/><Text style={s.graphControlText}>{selectedNode.label==='SERVER'?'Path to ATTACKER':'Path to SERVER'}</Text></Pressable><Pressable onPress={()=>setMode('blast')} style={[s.graphControl,mode==='blast'&&{backgroundColor:T.amberSoft,borderColor:T.amber+'55'}]}><Icon name="radio" size={12} color={T.amber}/><Text style={s.graphControlText}>Blast radius</Text></Pressable></View>
      <View style={s.graphInsight}><Icon name="info" size={13} color={T.blue}/><Text style={s.graphInsightText}>{modeText}</Text></View>
    </View>}
  </View>;
}

function Fabric({topology,digitalTwin,incidentMode,setIncidentMode,intent}:{topology:NetworkTopology|null;digitalTwin:DigitalTwin|null;incidentMode:boolean;setIncidentMode:(v:boolean)=>void;intent:TwinIntent}) {
  const {T,s}=useTheme(); const hosts=topology?.nodes.filter(n=>n.kind==='host')||[];
  return <View style={s.page}>
    <SectionHead eyebrow="FABRIC" title="Interactive digital twin" action={<Pressable onPress={()=>setIncidentMode(!incidentMode)} style={s.modeButton}><Icon name="zap" size={12} color={incidentMode?T.coral:T.text}/><Text style={[s.modeText,incidentMode&&{color:T.coral}]}>{incidentMode?'Incident focus':'Trace mode'}</Text></Pressable>}/>
    <TwinSummary digitalTwin={digitalTwin}/>
    <InteractiveTwinGraph digitalTwin={digitalTwin} intent={intent}/>
    <Text style={s.micro}>ENDPOINT INVENTORY</Text><View style={s.hostList}>{hosts.map(h=>{const danger=h.role==='attacker'||h.zone==='GUEST';const service=['SERVER','PUBLIC','MANAGEMENT'].includes(h.zone);const color=danger?T.coral:service?T.violet:T.mint;const bg=danger?T.coralSoft:service?T.violetSoft:T.mintSoft;return <View key={h.id} style={[s.hostRow,danger&&incidentMode&&{borderColor:T.coral+'66'}]}><View style={[s.hostIcon,{backgroundColor:bg}]}><Icon name={danger?'alert-triangle':'monitor'} size={15} color={color}/></View><View style={{flex:1}}><Text style={s.hostName}>{h.label}</Text><Text style={s.hostMeta}>{h.ip} · {h.zone} · {h.trust||'unknown'}</Text></View>{!!h.vlan&&<View style={[s.vlanPill,{backgroundColor:bg}]}><Text style={[s.vlanText,{color}]}>VLAN {h.vlan}</Text></View>}</View>})}</View>
  </View>;
}

function IncidentWorkspace({item,onCreatePlan,onClose}:{item:IncidentCase;onCreatePlan:(kind:string,caseId?:string)=>void;onClose:(id:string)=>void}) {
  const {T,s}=useTheme();
  return <View style={s.caseCard}>
    <View style={s.caseHead}><View style={{flex:1}}><Text style={s.caseKicker}>{item.severity.toUpperCase()} INCIDENT</Text><Text style={s.caseTitle}>{item.title}</Text></View><View style={s.caseState}><Text style={s.caseStateText}>{item.status.toUpperCase()}</Text></View></View>
    <Text style={s.caseAssessment}>{item.assessment}</Text>
    {item.autopilot?.autoOpened&&<View style={s.autopilotCard}>
      <View style={s.autopilotHead}><View style={s.autopilotIcon}><Icon name="zap" size={14} color={T.violet}/></View><View style={{flex:1}}><Text style={s.autopilotKicker}>INCIDENT AUTOPILOT</Text><Text style={s.autopilotTitle}>Investigation prepared automatically</Text></View><View style={[s.badge,{backgroundColor:T.mintSoft}]}><Text style={[s.sectionAction,{color:T.mint}]}>ASSISTIVE</Text></View></View>
      <Text style={s.autopilotText}>{item.autopilot.reason}</Text>
      {!!item.autopilot.recentChanges?.length&&<View style={s.autopilotChanges}><Text style={s.micro}>RECENT CONTEXT</Text>{item.autopilot.recentChanges.slice(0,3).map(change=><View key={change.id} style={s.autopilotChange}><View style={[s.statusDot,{backgroundColor:severityColor(T,change.severity)}]}/><Text style={s.autopilotChangeText}>{change.title}</Text></View>)}</View>}
      <View style={s.autopilotGuard}><Icon name="user-check" size={12} color={T.mint}/><Text style={s.autopilotGuardText}>Autopilot may collect evidence and prepare next steps. Approval and execution remain human-controlled.</Text></View>
    </View>}
    <Text style={s.micro}>EVIDENCE</Text><View style={s.evidenceList}>{item.evidence.map((e,i)=><View key={e.label+i} style={s.evidenceRow}><View style={s.evidenceRail}><View style={[s.evidenceDot,{backgroundColor:e.certainty==='observed'?T.mint:e.certainty==='heuristic'?T.violet:T.faint}]}/>{i<item.evidence.length-1&&<View style={s.evidenceStem}/>}</View><View style={{flex:1}}><Text style={s.evidenceLabel}>{e.label}</Text><Text style={s.evidenceValue}>{e.value}</Text><Text style={s.evidenceSource}>{e.source} · {e.certainty}</Text></View></View>)}</View>
    <Text style={s.micro}>VERIFICATION PATH</Text><View style={s.pathRow}>{item.path.map((p,i)=><React.Fragment key={p.label+i}><View style={s.pathNode}><View style={[s.pathIcon,{backgroundColor:p.kind==='source'?T.coralSoft:p.kind==='fabric'?T.mintSoft:T.violetSoft}]}><Icon name={p.kind==='source'?'alert-triangle':p.kind==='fabric'?'cpu':'shield'} size={13} color={p.kind==='source'?T.coral:p.kind==='fabric'?T.mint:T.violet}/></View><Text style={s.pathLabel}>{p.label}</Text><Text style={s.pathCert}>{p.certainty}</Text></View>{i<item.path.length-1&&<Icon name="arrow-right" size={12} color={T.faint}/>}</React.Fragment>)}</View>
    <Text style={[s.micro,{marginTop:13}]}>SAFE NEXT ACTIONS</Text>{item.recommendations.map(r=><Pressable key={r.kind} onPress={()=>onCreatePlan(r.kind,item.id)} style={s.recommendation}><View style={s.recommendNo}><Text style={s.recommendNoText}>{r.priority}</Text></View><Text style={s.recommendText}>{r.label}</Text><Icon name="arrow-up-right" size={13} color={T.violet}/></Pressable>)}
    {item.status!=='closed'&&<Pressable onPress={()=>onClose(item.id)} style={s.closeCase}><Icon name="check-circle" size={14} color={T.mint}/><Text style={s.closeCaseText}>Close investigation</Text></Pressable>}
  </View>;
}

function PlanCard({a,onDecide,onSimulate,onApplied,onVerify,onRollback}:{a:DefensiveAction;onDecide:(id:string,approved:boolean)=>void;onSimulate:(id:string)=>void;onApplied:(id:string)=>void;onVerify:(id:string)=>void;onRollback:(id:string)=>void}) {
  const {T,s}=useTheme();
  const canSimulate=['approved-preview','simulated','verification-pending','verification-limited','verification-failed','verified'].includes(a.status);
  const canApply=['approved-preview','simulated','verification-failed','verification-limited'].includes(a.status);
  const canVerify=!!a.approved;
  return <View style={s.plan}>
    <View style={s.planTop}><View style={{flex:1}}><Text style={s.planKicker}>{a.risk.toUpperCase()} RISK · HUMAN IN THE LOOP</Text><Text style={s.planTitle}>{a.title}</Text></View><Text style={s.planStatus}>{a.status.toUpperCase()}</Text></View>
    <Text style={s.planSummary}>{a.summary}</Text>
    <View style={s.codeBox}>{a.commands.slice(0,4).map((line,i)=><Text key={i} style={s.codeLine}>{line}</Text>)}</View>
    <Text style={s.rollbackLabel}>ROLLBACK READY · {a.rollback.length} command(s)</Text>
    {a.simulation&&<View style={s.verificationBox}><Text style={s.verificationTitle}>SIMULATION · {a.simulation.result.toUpperCase()}</Text><Text style={s.verificationText}>{a.simulation.expected.outcome}</Text><Text style={s.verificationText}>{a.simulation.limitation}</Text></View>}
    {a.verification&&<View style={[s.verificationBox,{borderColor:a.status==='verified'?T.mint+'66':a.status==='verification-failed'?T.coral+'66':T.amber+'66'}]}><Text style={s.verificationTitle}>LIVE VERIFICATION · {a.verification.outcome.toUpperCase()}</Text><Text style={s.verificationText}>{a.verification.detail}</Text></View>}
    {!!a.lifecycle?.length&&<View style={s.lifecycle}>{a.lifecycle.slice(-4).map((e,i)=><View key={e.at+i} style={s.lifeRow}><View style={s.lifeDot}/><Text style={s.lifeText}>{e.step.toUpperCase()} · {e.detail}</Text></View>)}</View>}
    {a.status==='pending'&&<View style={s.planButtons}><Pressable onPress={()=>onDecide(a.id,false)} style={[s.planButton,s.planButtonDanger]}><Text style={s.planButtonText}>REJECT</Text></Pressable><Pressable onPress={()=>onDecide(a.id,true)} style={[s.planButton,s.planButtonPrimary]}><Text style={[s.planButtonText,s.planButtonPrimaryText]}>APPROVE PREVIEW</Text></Pressable></View>}
    {!!a.approved&&<View style={s.planButtons}><Pressable disabled={!canSimulate} onPress={()=>onSimulate(a.id)} style={[s.planButton,s.planButtonViolet,!canSimulate&&{opacity:.4}]}><Text style={s.planButtonText}>SIMULATE</Text></Pressable><Pressable disabled={!canApply} onPress={()=>onApplied(a.id)} style={[s.planButton,!canApply&&{opacity:.4}]}><Text style={s.planButtonText}>I APPLIED IT</Text></Pressable></View>}
    {!!a.approved&&<View style={s.planButtons}><Pressable disabled={!canVerify} onPress={()=>onVerify(a.id)} style={[s.planButton,s.planButtonPrimary,!canVerify&&{opacity:.4}]}><Text style={[s.planButtonText,s.planButtonPrimaryText]}>VERIFY LIVE</Text></Pressable><Pressable onPress={()=>onRollback(a.id)} style={[s.planButton,s.planButtonDanger]}><Text style={s.planButtonText}>ROLLBACK PLAN</Text></Pressable></View>}
  </View>;
}

function Defend({security,cases,actions,onCreatePlan,onDecide,onOpenIncident,onCloseIncident,onSimulate,onApplied,onVerify,onRollback}:{security:SecurityAnalysis|null;cases:IncidentCase[];actions:DefensiveAction[];onCreatePlan:(k:string,c?:string)=>void;onDecide:(id:string,a:boolean)=>void;onOpenIncident:(id:string)=>void;onCloseIncident:(id:string)=>void;onSimulate:(id:string)=>void;onApplied:(id:string)=>void;onVerify:(id:string)=>void;onRollback:(id:string)=>void}) {
  const {T,s}=useTheme(); const posture=security?.posture||'normal'; const active=cases.find(x=>x.status!=='closed')||cases[0];
  return <View style={s.page}>
    <SectionHead eyebrow="DEFEND" title="Incident response" action={<View style={[s.badge,{backgroundColor:T.violetSoft}]}><Icon name="zap" size={12} color={T.violet}/><Text style={[s.sectionAction,{color:T.violet}]}>AUTOPILOT ON</Text></View>}/>
    <LinearGradient colors={posture==='critical'?['#3B1722','#70283D']:posture==='warning'?['#332816','#665029']:['#0E3229','#17624E']} style={s.posture}><Text style={s.postureKicker}>CURRENT SECURITY POSTURE</Text><Text style={s.postureTitle}>{posture.toUpperCase()}</Text><Text style={s.postureText}>{security?.alertCount||0} active signals · {security?.criticalCount||0} critical · {security?.hostCount||0} observed hosts</Text></LinearGradient>
    {active&&<><SectionHead eyebrow="INCIDENT WORKSPACE" title={active.status==='closed'?'Latest investigation':'Investigation in progress'}/><IncidentWorkspace item={active} onCreatePlan={onCreatePlan} onClose={onCloseIncident}/></>}
    <SectionHead eyebrow="DETECTION FEED" title="Active signals"/><View style={s.card}>{(security?.alerts||[]).length?security!.alerts.map((a,i)=><View key={a.id} style={[s.alertRow,i<(security?.alerts.length||0)-1&&s.divider]}><View style={[s.alertIcon,{backgroundColor:a.severity==='critical'?T.coralSoft:T.amberSoft}]}><Icon name={a.severity==='critical'?'alert-octagon':'alert-triangle'} size={16} color={a.severity==='critical'?T.coral:T.amber}/></View><View style={{flex:1}}><View style={s.alertTitleRow}><Text style={s.alertTitle}>{a.title}</Text><Text style={[s.alertSeverity,{color:a.severity==='critical'?T.coral:T.amber}]}>{a.severity.toUpperCase()}</Text></View><Text style={s.alertText}>{a.detail}</Text><Pressable onPress={()=>onOpenIncident(a.id)} style={s.investigate}><Icon name={cases.some(item=>item.alertId===a.id&&item.status!=='closed')?'zap':'search'} size={12} color={T.violet}/><Text style={s.investigateText}>{cases.some(item=>item.alertId===a.id&&item.status!=='closed')?'Open prepared workspace':'Investigate with NEXUS'}</Text></Pressable></View></View>):<Text style={s.muted}>Detection feed is quiet.</Text>}</View>
    <SectionHead eyebrow="VERIFIED ACTION LOOP" title="Human-approved response"/>
    {actions.length?<View style={s.planList}>{actions.slice(0,4).map(a=><PlanCard key={a.id} a={a} onDecide={onDecide} onSimulate={onSimulate} onApplied={onApplied} onVerify={onVerify} onRollback={onRollback}/>)}</View>:<View style={s.cardFlat}><Text style={s.changeTitle}>No response plan yet</Text><Text style={s.changeDetail}>Open an incident and select a safe next action. NEXUS will prepare commands, rollback, simulation and live verification steps.</Text></View>}
  </View>;
}

function AnswerSections({text}:{text:string}) {
  const {T,s}=useTheme(); const sections=operatorSections(text); const icons:Record<string,IconName>={OBSERVED:'eye',INFERRED:'git-merge',RISK:'alert-triangle','NEXT CHECKS':'check-square',CONFIDENCE:'target','NEXUS RESPONSE':'command'};
  return <View style={s.answerSections}>{sections.map((part,i)=>{const risk=part.label==='RISK';const confidence=part.label==='CONFIDENCE';const color=risk?T.coral:confidence?T.blue:T.violet;return <View key={part.label+i} style={[s.answerSection,risk&&{borderColor:T.coral+'55'},confidence&&{borderColor:T.blue+'55'}]}><View style={s.answerSectionHead}><View style={[s.answerSectionIcon,{backgroundColor:risk?T.coralSoft:confidence?T.blueSoft:T.violetSoft}]}><Icon name={icons[part.label]||'command'} size={13} color={color}/></View><Text style={[s.answerSectionLabel,{color}]}>{part.label}</Text></View><Text style={s.answerSectionText}>{part.body}</Text></View>})}</View>;
}

function Agent({live,serverHealth,busy,prompt,setPrompt,run,onSubmit,onAction}:{live:boolean;serverHealth:Health|null;busy:boolean;prompt:string;setPrompt:(v:string)=>void;run:AgentRun|null;onSubmit:()=>void;onAction:(action:NonNullable<AgentRun['actions']>[number])=>void}) {
  const {T,s}=useTheme(); const [trace,setTrace]=useState(false); const working=!!run&&['thinking','resuming'].includes(run.status);
  const quick=['Review my network health','Can ATTACKER-PC reach SERVER?','What is connected to CORE-SW?','Show the blast radius of CORE-SW'];
  const tone=(value:string)=>value==='danger'?T.coral:value==='amber'?T.amber:value==='mint'?T.mint:value==='violet'?T.violet:T.blue;
  return <View style={s.page}>
    <SectionHead eyebrow="NEXUS AI" title="Topology-aware assistant" action={<View style={[s.contextPill,{backgroundColor:live?T.mintSoft:T.surface2}]}><View style={[s.statusDot,{backgroundColor:live?T.mint:T.faint}]}/><Text style={s.contextText}>{live?'LIVE CONTEXT':'NO CONTEXT'}</Text></View>}/>
    <LinearGradient colors={['#171B2D','#29234B','#403176']} style={s.aiHero}><View style={s.aiOrb}><View style={s.aiOrbInner}><Text style={s.aiOrbText}>N</Text></View></View><Text style={s.aiTitle}>Ask the network,{"\n"}not just the model.</Text><Text style={s.aiText}>NEXUS preloads the right graph tool for common path, adjacency and blast-radius questions, then turns the result into evidence and operator actions.</Text><View style={s.modelRow}><Icon name="cpu" size={12} color="#C9C3FF"/><Text style={s.modelText}>{serverHealth?.model||'Local model'} · {serverHealth?.modelReady?'ready':'auto fallback'}</Text></View></LinearGradient>
    <View style={s.composer}><TextInput value={prompt} onChangeText={setPrompt} multiline placeholder="Ask about health, reachability, paths, blast radius…" placeholderTextColor={T.faint} style={s.composerInput}/><Pressable onPress={onSubmit} disabled={busy||prompt.trim().length<3} style={[s.send,(busy||prompt.trim().length<3)&&{opacity:.45}]}><Icon name={busy?'loader':'arrow-up'} size={17} color={T.bg}/></Pressable></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>{quick.map(q=><Pressable key={q} onPress={()=>setPrompt(q)} style={s.chip}><Text style={s.chipText}>{q}</Text></Pressable>)}</ScrollView>
    {run?<View style={s.runCard}>
      <View style={s.runHead}><View style={{flex:1}}><Text style={s.runLabel}>CURRENT INVESTIGATION</Text><Text style={s.runPrompt}>{run.prompt}</Text></View><View style={[s.runState,{backgroundColor:run.status==='completed'?T.mintSoft:run.status==='failed'?T.coralSoft:T.violetSoft}]}><Text style={[s.runStateText,{color:run.status==='completed'?T.mint:run.status==='failed'?T.coral:T.violet}]}>{run.status.toUpperCase()}</Text></View></View>
      {working&&<View style={s.thinking}><View style={s.thinkingDot}/><Text style={s.thinkingText}>Selecting tools and correlating live evidence…</Text></View>}
      {!!run.evidence?.length&&<View style={s.evidenceSummary}><Text style={s.micro}>EVIDENCE USED</Text>{run.evidence.slice(-5).map((e,i)=><View key={e.tool+i} style={s.agentEvidence}><View style={s.checkBox}><Icon name="check" size={10} color={T.mint}/></View><Text style={s.agentEvidenceText}>{e.summary}</Text></View>)}</View>}
      {!!run.events.length&&<Pressable onPress={()=>setTrace(!trace)} style={s.traceToggle}><View style={{flexDirection:'row',alignItems:'center',gap:6}}><Icon name="activity" size={13} color={T.violet}/><Text style={s.traceToggleText}>{trace?'Hide':'Show'} investigation trace</Text></View><Icon name={trace?'chevron-up':'chevron-down'} size={14} color={T.muted}/></Pressable>}
      {trace&&<View style={{marginTop:9}}>{run.events.map((e,i)=><View key={e.id} style={s.traceRow}><View style={s.traceRail}><View style={[s.traceDot,{backgroundColor:e.kind==='error'?T.coral:e.kind==='success'||e.kind==='final'?T.mint:T.violet}]}/>{i<run.events.length-1&&<View style={s.traceStem}/>}</View><View style={{flex:1}}><Text style={s.traceTitle}>{e.title}</Text>{!!e.detail&&<Text style={s.traceDetail}>{cleanMarkup(e.detail)}</Text>}</View></View>)}</View>}
      {!!run.answer&&<View style={s.answer}>
        <View style={s.answerHead}><View style={s.answerLogo}><Text style={s.answerLogoText}>N</Text></View><View><Text style={s.answerKicker}>NEXUS ASSESSMENT</Text><Text style={s.answerMeta}>Evidence-aware · digital-twin assisted</Text></View></View>
        <AnswerSections text={run.answer}/>
        {!!run.actions?.length&&<View style={s.actionCards}><Text style={s.micro}>OPERATOR ACTIONS</Text>{run.actions.map(action=>{const color=tone(action.tone);return <Pressable key={action.id} onPress={()=>onAction(action)} style={[s.actionCard,{borderColor:color+'55'}]}><View style={[s.actionCardIcon,{backgroundColor:color+'1A'}]}><Icon name={(action.icon||'arrow-up-right') as IconName} size={14} color={color}/></View><View style={{flex:1}}><Text style={s.actionCardTitle}>{action.label}</Text><Text style={s.actionCardText}>{action.description}</Text></View><Icon name="chevron-right" size={14} color={T.faint}/></Pressable>})}</View>}
        {!!run.followUps?.length&&<View style={s.followups}><Text style={s.micro}>CONTINUE INVESTIGATION</Text>{run.followUps.map(q=><Pressable key={q} onPress={()=>setPrompt(q)} style={s.followup}><Text style={s.followupText}>{q}</Text><Icon name="arrow-up-right" size={13} color={T.violet}/></Pressable>)}</View>}
      </View>}
      {!!run.error&&<View style={[s.cardFlat,{marginTop:10,borderColor:T.coral+'55'}]}><Text style={[s.changeTitle,{color:T.coral}]}>Investigation interrupted</Text><Text style={s.changeDetail}>{run.error}</Text></View>}
    </View>:<View style={s.aiEmpty}><View style={s.aiEmptyIcon}><Icon name="command" size={22} color={T.violet}/></View><Text style={s.aiEmptyTitle}>Ready for a network question</Text><Text style={s.aiEmptyText}>Try a path, connection or blast-radius question. NEXUS will automatically select the matching digital-twin tool when the request is clear.</Text></View>}
  </View>;
}

function Connect({live,editEndpoint,setEditEndpoint,editPair,setEditPair,onConnect,busy,serverHealth}:{live:boolean;editEndpoint:string;setEditEndpoint:(v:string)=>void;editPair:string;setEditPair:(v:string)=>void;onConnect:()=>void;busy:boolean;serverHealth:Health|null}) {
  const {T,s}=useTheme();
  return <View style={s.page}><SectionHead eyebrow="CONNECT" title="Local lab session"/><View style={s.connectionHero}><View style={[s.connectionIcon,{backgroundColor:live?T.mintSoft:T.surface3}]}><Icon name="radio" size={21} color={live?T.mint:T.muted}/></View><Text style={s.connectionTitle}>{live?'Packet Tracer is live':'Ready to connect'}</Text><Text style={s.connectionText}>{live?'Controller telemetry and the digital twin are available to NEXUS.':'Use 10.0.2.2 from the Android emulator to reach the Windows NEXUS server.'}</Text><View style={[s.connectionState,{backgroundColor:live?T.mintSoft:T.surface3}]}><View style={[s.statusDot,{backgroundColor:live?T.mint:T.faint}]}/><Text style={[s.contextText,{color:live?T.mint:T.muted}]}>{live?'CONNECTED':'OFFLINE'}</Text></View></View>
    <View style={s.card}><Text style={s.fieldLabel}>Gateway address</Text><View style={s.inputWrap}><Icon name="globe" size={15} color={T.muted}/><TextInput value={editEndpoint} onChangeText={setEditEndpoint} autoCapitalize="none" style={s.input} placeholder="http://10.0.2.2:8787" placeholderTextColor={T.faint}/></View><Text style={s.fieldLabel}>Pairing code</Text><View style={s.inputWrap}><Icon name="key" size={15} color={T.muted}/><TextInput value={editPair} onChangeText={setEditPair} autoCapitalize="none" secureTextEntry style={s.input} placeholder="Enter pairing code" placeholderTextColor={T.faint}/></View><Pressable onPress={onConnect} disabled={busy} style={[s.connectButton,busy&&{opacity:.55}]}><Icon name="link-2" size={15} color="#0D2821"/><Text style={s.connectButtonText}>{busy?'CONNECTING…':live?'RECONNECT LAB':'CONNECT LIVE LAB'}</Text></Pressable></View>
    <View style={s.tip}><View style={[s.tipIcon,{backgroundColor:T.blueSoft}]}><Icon name="smartphone" size={15} color={T.blue}/></View><View style={{flex:1}}><Text style={s.tipTitle}>Android emulator</Text><Text style={s.tipText}>Use http://10.0.2.2:8787 to reach the NEXUS server on your Windows host.</Text></View></View>
    <View style={s.tip}><View style={[s.tipIcon,{backgroundColor:T.violetSoft}]}><Icon name="cpu" size={15} color={T.violet}/></View><View style={{flex:1}}><Text style={s.tipTitle}>Local intelligence</Text><Text style={s.tipText}>{serverHealth?.model||'Auto-select'} · {serverHealth?.modelReady?'ready':'fallback available'} · data stays on the local NEXUS stack.</Text></View></View>
  </View>;
}

const nav:{id:MobilePage;label:string;icon:IconName}[]=[
  {id:'home',label:'Home',icon:'home'},{id:'dashboard',label:'Overview',icon:'grid'},{id:'topology',label:'Fabric',icon:'share-2'},{id:'security',label:'Defend',icon:'shield'},{id:'agent',label:'AI',icon:'command'},
];

function Experience(props:Props) {
  const {T,s}=useTheme();
  const {page,setPage,live,network,topology,digitalTwin,security,serverHealth,actions,incidentCases,changes,themeMode,onToggleTheme,incidentMode,setIncidentMode,busy,prompt,setPrompt,run,editEndpoint,setEditEndpoint,editPair,setEditPair,onConnect,onRefresh,onSubmit,onCreatePlan,onDecidePlan,onOpenIncident,onCloseIncident,onSimulatePlan,onMarkPlanApplied,onVerifyPlan,onRollbackPlan,notice,clearNotice}=props;
  const scrollRef=useRef<ScrollView>(null);
  useEffect(()=>{if(page!=='agent'||!run)return;const t=setTimeout(()=>scrollRef.current?.scrollToEnd({animated:true}),180);return()=>clearTimeout(t);},[page,run?.status,run?.answer,run?.events.length]);
  return <SafeAreaView style={s.root} edges={['top','bottom']}>
    <Header live={live} themeMode={themeMode} onToggleTheme={onToggleTheme} onConnect={()=>setPage('settings')} onRefresh={onRefresh}/>
    {!!notice&&<Pressable onPress={clearNotice} style={s.notice}><Icon name="info" size={13} color={T.amber}/><Text style={s.noticeText} numberOfLines={2}>{notice}</Text><Icon name="x" size={13} color={T.muted}/></Pressable>}
    <ScrollView ref={scrollRef} style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
      {page==='home'&&<Home live={live} network={network} topology={topology} security={security} changes={changes} digitalTwin={digitalTwin} setPage={setPage}/>}
      {page==='dashboard'&&<Overview network={network} topology={topology} security={security} changes={changes}/>}
      {page==='topology'&&<Fabric topology={topology} digitalTwin={digitalTwin} incidentMode={incidentMode} setIncidentMode={setIncidentMode}/>}
      {page==='security'&&<Defend security={security} cases={incidentCases} actions={actions} onCreatePlan={onCreatePlan} onDecide={onDecidePlan} onOpenIncident={onOpenIncident} onCloseIncident={onCloseIncident} onSimulate={onSimulatePlan} onApplied={onMarkPlanApplied} onVerify={onVerifyPlan} onRollback={onRollbackPlan}/>}
      {page==='agent'&&<Agent live={live} serverHealth={serverHealth} busy={busy} prompt={prompt} setPrompt={setPrompt} run={run} onSubmit={onSubmit}/>}
      {page==='settings'&&<Connect live={live} editEndpoint={editEndpoint} setEditEndpoint={setEditEndpoint} editPair={editPair} setEditPair={setEditPair} onConnect={onConnect} busy={busy} serverHealth={serverHealth}/>}
    </ScrollView>
    <View style={s.nav}>{nav.map(item=>{const active=page===item.id;return <Pressable key={item.id} onPress={()=>setPage(item.id)} style={s.navItem}><View style={[s.navIcon,active&&s.navIconActive]}><Icon name={item.icon} size={17} color={active?T.ink:T.muted}/></View><Text style={[s.navText,active&&s.navTextActive]}>{item.label}</Text></Pressable>})}</View>
  </SafeAreaView>;
}

export function MobileExperience(props:Props) {
  const dark=props.themeMode==='dark';
  const T=dark?DARK:LIGHT;
  const s=useMemo(()=>makeStyles(T),[dark]);
  return <ThemeContext.Provider value={{T,s,dark}}><Experience {...props}/></ThemeContext.Provider>;
}
