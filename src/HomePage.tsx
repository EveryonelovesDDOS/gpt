import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ContinuousDataFlow, PulseHalo, Reveal } from './AuroraMotion';
import { Orb } from './Orb';

type HomePageProps = {
  live: boolean;
  stats: {
    deviceCount: number;
    reachable: number;
    hostCount: number;
    alertCount: number;
    trustedCount: number;
    guestCount: number;
    protectedCount: number;
  };
  onEnter: () => void;
  onOpenFabric: () => void;
  onOpenDefend: () => void;
  onOpenAI: () => void;
  onOpenConnect: () => void;
};

type Tone = 'mint' | 'violet' | 'coral' | 'blue';

const toneMap: Record<Tone, { bg:string; icon:string; border:string }> = {
  mint: { bg:'#E2F8F0', icon:'#16B88F', border:'#BFEBDD' },
  violet: { bg:'#ECE9FF', icon:'#635BFF', border:'#D9D2FF' },
  coral: { bg:'#FFF0F3', icon:'#F04F6D', border:'#F7CBD6' },
  blue: { bg:'#EAF3FF', icon:'#3B82F6', border:'#CADFFF' },
};

function FeatureCard({ icon, title, desc, tone }: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  desc: string;
  tone: Tone;
}) {
  const t = toneMap[tone];
  return <View style={[s.featureCard,{borderColor:t.border}]}>
    <View style={[s.featureIcon,{backgroundColor:t.bg}]}>
      <Feather name={icon as any} size={18} color={t.icon} />
    </View>
    <Text style={s.featureTitle}>{title}</Text>
    <Text style={s.featureDesc}>{desc}</Text>
  </View>;
}

function StatTile({ label, value, hint, color }: {
  label:string;
  value:string|number;
  hint:string;
  color:string;
}) {
  return <View style={[s.statTile,{borderTopColor:color}]}>
    <Text style={s.statValue}>{value}</Text>
    <Text style={s.statLabel}>{label}</Text>
    <Text style={[s.statHint,{color}]}>{hint}</Text>
  </View>;
}

function FlowStep({ icon, title, desc, color }: {
  icon:keyof typeof Feather.glyphMap;
  title:string;
  desc:string;
  color:string;
}) {
  return <View style={s.flowStep}>
    <View style={[s.flowIcon,{backgroundColor:color+'18'}]}>
      <Feather name={icon as any} size={16} color={color} />
    </View>
    <Text style={s.flowStepTitle}>{title}</Text>
    <Text style={s.flowStepDesc}>{desc}</Text>
  </View>;
}

function EntryCard({ icon, title, desc, color, bg, onPress }: {
  icon:keyof typeof Feather.glyphMap;
  title:string;
  desc:string;
  color:string;
  bg:string;
  onPress:()=>void;
}) {
  return <Pressable onPress={onPress} style={s.entryCard}>
    <View style={[s.entryIcon,{backgroundColor:bg}]}>
      <Feather name={icon as any} size={18} color={color} />
    </View>
    <Text style={s.entryTitle}>{title}</Text>
    <Text style={s.entryDesc}>{desc}</Text>
    <View style={s.entryArrow}><Feather name="arrow-up-right" size={14} color={color} /></View>
  </Pressable>;
}

export function HomePage({
  live,
  stats,
  onEnter,
  onOpenFabric,
  onOpenDefend,
  onOpenAI,
  onOpenConnect,
}: HomePageProps) {
  return <View style={s.root}>
    <Reveal delay={0}>
      <LinearGradient colors={['#FFFFFF','#F5F8FF']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.hero}>
        <View style={s.heroBlobMint} />
        <View style={s.heroBlobViolet} />
        <View style={s.heroBlobBlue} />

        <View style={s.heroGrid}>
          <View style={s.heroLeft}>
            <View style={s.kickerRow}>
              <View style={s.kickerDot} />
              <Text style={s.kicker}>LOCAL-FIRST NETWORK EXPERIENCE</Text>
            </View>

            <Text style={s.heroTitle}>
              See the fabric.{"\n"}
              <Text style={s.heroTitleAccent}>Control the risk.</Text>{"\n"}
              Operate with NEXUS.
            </Text>

            <Text style={s.heroText}>
              NEXUS turns Packet Tracer telemetry into a live command experience — topology,
              trust zones, security posture and AI-assisted investigation in one place.
            </Text>

            <View style={s.heroActions}>
              <Pressable onPress={onEnter} style={s.primaryBtn}>
                <Text style={s.primaryBtnText}>ENTER COMMAND CENTER</Text>
                <Feather name="arrow-up-right" size={15} color="#08231C" />
              </Pressable>
              <Pressable onPress={onOpenFabric} style={s.secondaryBtn}>
                <Feather name="share-2" size={15} color="#5449E8" />
                <Text style={s.secondaryBtnText}>EXPLORE FABRIC</Text>
              </Pressable>
            </View>

            <View style={s.heroMiniStats}>
              <View style={s.miniChip}>
                {live ? <PulseHalo color="#16B88F" /> : <View style={s.previewDot} />}
                <Text style={s.miniChipText}>{live ? 'LIVE TELEMETRY ONLINE' : 'PREVIEW MODE'}</Text>
              </View>
              <View style={s.miniChip}>
                <Feather name="server" size={14} color="#3B82F6" />
                <Text style={s.miniChipText}>{stats.deviceCount} devices discovered</Text>
              </View>
              <View style={s.miniChip}>
                <Feather name="shield" size={14} color="#F04F6D" />
                <Text style={s.miniChipText}>{stats.alertCount} active signals</Text>
              </View>
            </View>
          </View>

          <View style={s.heroRight}>
            <View style={s.orbCard}>
              <View style={s.orbCardTop}>
                <View>
                  <Text style={s.orbCardLabel}>NETWORK PULSE</Text>
                  <Text style={s.orbCardTitle}>Your lab is alive.</Text>
                </View>
                <View style={s.liveBadge}>
                  <View style={[s.liveDot,{backgroundColor:live?'#16B88F':'#94A3B8'}]} />
                  <Text style={s.liveBadgeText}>{live?'LIVE':'PREVIEW'}</Text>
                </View>
              </View>
              <View style={s.orbWrap}><Orb size={220} active={live} /></View>
              <View style={s.pulseStats}>
                <View style={s.pulseStat}>
                  <Text style={s.pulseStatValue}>{stats.reachable}/{stats.deviceCount}</Text>
                  <Text style={s.pulseStatLabel}>devices reachable</Text>
                </View>
                <View style={s.pulseDivider} />
                <View style={s.pulseStat}>
                  <Text style={[s.pulseStatValue,{color:stats.alertCount?'#F04F6D':'#16B88F'}]}>{stats.alertCount}</Text>
                  <Text style={s.pulseStatLabel}>alert signals</Text>
                </View>
              </View>
            </View>

            <View style={s.previewShelf}>
              <View style={s.previewCard}>
                <Text style={s.previewEyebrow}>FABRIC</Text>
                <Text style={s.previewTitle}>Trust zones</Text>
                <Text style={s.previewDesc}>See where endpoints live and how the lab is segmented.</Text>
              </View>
              <View style={s.previewCard}>
                <Text style={[s.previewEyebrow,{color:'#635BFF'}]}>NEXUS AI</Text>
                <Text style={s.previewTitle}>Evidence-aware</Text>
                <Text style={s.previewDesc}>Ask the network directly and reason over live context.</Text>
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>
    </Reveal>

    <Reveal delay={90}>
      <ContinuousDataFlow
        label="LIVE PACKET FLOW"
        sublabel="Packet Tracer controller → fabric → trust-zone context"
      />
    </Reveal>

    <Reveal delay={150}>
      <View style={s.section}>
        <Text style={s.sectionEyebrow}>WHAT NEXUS DOES</Text>
        <Text style={s.sectionTitle}>One workspace, multiple angles.</Text>
        <Text style={s.sectionLead}>Move from raw lab telemetry to an operator-ready view without losing the underlying evidence.</Text>
        <View style={s.featureGrid}>
          <FeatureCard icon="share-2" title="Live topology" desc="Understand the router, core switch, host placement and trust-zone relationships in one view." tone="mint" />
          <FeatureCard icon="shield" title="Defensive visibility" desc="Surface guest-zone context, active lab signals and reversible defensive response plans." tone="coral" />
          <FeatureCard icon="command" title="NEXUS AI" desc="Investigate in plain language with tool-backed answers that separate observations from inference." tone="violet" />
          <FeatureCard icon="link" title="Local connection" desc="Connect to Packet Tracer locally and keep the demo fast, private and self-contained." tone="blue" />
        </View>
      </View>
    </Reveal>

    <Reveal delay={220}>
      <View style={s.section}>
        <Text style={s.sectionEyebrow}>LIVE SNAPSHOT</Text>
        <Text style={s.sectionTitle}>Your lab, summarised at a glance.</Text>
        <View style={s.statsGrid}>
          <StatTile label="Trusted endpoints" value={stats.trustedCount} hint="ADMIN · FINANCE · STAFF" color="#16B88F" />
          <StatTile label="Guest / untrusted" value={stats.guestCount} hint="Trace suspicious context" color="#F04F6D" />
          <StatTile label="Protected services" value={stats.protectedCount} hint="SERVER · PUBLIC · MGMT" color="#635BFF" />
          <StatTile label="Observed hosts" value={stats.hostCount} hint="Live endpoint inventory" color="#3B82F6" />
        </View>
      </View>
    </Reveal>

    <Reveal delay={290}>
      <View style={s.section}>
        <Text style={s.sectionEyebrow}>HOW IT WORKS</Text>
        <Text style={s.sectionTitle}>From lab topology to operator action.</Text>
        <View style={s.flowWrap}>
          <FlowStep icon="box" title="Packet Tracer Lab" desc="Router, switch, VLANs and endpoints form the simulated environment." color="#16B88F" />
          <View style={s.flowArrow}><Feather name="arrow-right" size={18} color="#A0AEC0" /></View>
          <FlowStep icon="radio" title="Controller / API" desc="NEXUS reads local telemetry for inventory, reachability and host context." color="#3B82F6" />
          <View style={s.flowArrow}><Feather name="arrow-right" size={18} color="#A0AEC0" /></View>
          <FlowStep icon="cpu" title="NEXUS Engine" desc="Data becomes fabric, security and AI-friendly operational context." color="#635BFF" />
          <View style={s.flowArrow}><Feather name="arrow-right" size={18} color="#A0AEC0" /></View>
          <FlowStep icon="zap" title="Operator Action" desc="Investigate, trace and prepare response decisions with less friction." color="#F04F6D" />
        </View>
      </View>
    </Reveal>

    <Reveal delay={360}>
      <View style={s.section}>
        <Text style={s.sectionEyebrow}>START ANYWHERE</Text>
        <Text style={s.sectionTitle}>Jump straight into the right workflow.</Text>
        <View style={s.entryGrid}>
          <EntryCard icon="grid" title="Overview" desc="Review the command-center summary and live operational picture." color="#16B88F" bg="#E2F8F0" onPress={onEnter} />
          <EntryCard icon="share-2" title="Fabric" desc="Inspect trust zones, backbone relationships and endpoint placement." color="#3B82F6" bg="#EAF3FF" onPress={onOpenFabric} />
          <EntryCard icon="shield" title="Defend" desc="Review signals, incident history and containment planning." color="#F04F6D" bg="#FFF0F3" onPress={onOpenDefend} />
          <EntryCard icon="command" title="NEXUS AI" desc="Ask the network directly and investigate with live context." color="#635BFF" bg="#ECE9FF" onPress={onOpenAI} />
          <EntryCard icon="link" title="Connect" desc="Configure local gateway access and bring telemetry online." color="#D98A1D" bg="#FFF6E8" onPress={onOpenConnect} />
        </View>
      </View>
    </Reveal>

    <Reveal delay={430}>
      <LinearGradient colors={['#FFFFFF','#F4F7FF']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.finalCta}>
        <View style={s.finalCtaCopy}>
          <Text style={s.sectionEyebrow}>READY TO ENTER?</Text>
          <Text style={s.finalCtaTitle}>Launch the command center and start operating with NEXUS.</Text>
          <Text style={s.finalCtaText}>Built for local control, live Packet Tracer demos and clearer operator storytelling.</Text>
        </View>
        <View style={s.finalCtaActions}>
          <Pressable onPress={onEnter} style={s.primaryBtn}>
            <Text style={s.primaryBtnText}>ENTER COMMAND CENTER</Text>
            <Feather name="arrow-up-right" size={15} color="#08231C" />
          </Pressable>
          <Pressable onPress={onOpenAI} style={s.secondaryBtn}>
            <Feather name="command" size={15} color="#5449E8" />
            <Text style={s.secondaryBtnText}>OPEN NEXUS AI</Text>
          </Pressable>
        </View>
      </LinearGradient>
    </Reveal>
  </View>;
}

const s = StyleSheet.create({
  root:{gap:20,paddingBottom:12},
  hero:{borderWidth:1,borderColor:'#C9D6E6',borderRadius:30,padding:28,overflow:'hidden',backgroundColor:'#FFFFFF',shadowColor:'#66758C',shadowOpacity:.08,shadowRadius:22,shadowOffset:{width:0,height:10}},
  heroBlobMint:{position:'absolute',width:320,height:320,borderRadius:200,backgroundColor:'#D9F7EE',top:-100,right:-70,opacity:.86},
  heroBlobViolet:{position:'absolute',width:300,height:300,borderRadius:190,backgroundColor:'#E7E3FF',bottom:-120,left:-50,opacity:.78},
  heroBlobBlue:{position:'absolute',width:230,height:230,borderRadius:160,backgroundColor:'#E5F1FF',top:100,left:'45%' as any,opacity:.64},
  heroGrid:{flexDirection:'row',flexWrap:'wrap',gap:22},heroLeft:{flex:1.25,minWidth:320,justifyContent:'center'},heroRight:{flex:.95,minWidth:300,gap:14},
  kickerRow:{flexDirection:'row',alignItems:'center',gap:8},kickerDot:{width:8,height:8,borderRadius:8,backgroundColor:'#16B88F'},kicker:{color:'#128A6B',fontSize:10,fontWeight:'900',letterSpacing:1.4},
  heroTitle:{marginTop:18,color:'#0F1B2D',fontSize:46,lineHeight:51,fontWeight:'900',maxWidth:690,letterSpacing:-1.1},heroTitleAccent:{color:'#635BFF'},
  heroText:{marginTop:18,color:'#465871',fontSize:15,lineHeight:25,maxWidth:720},
  heroActions:{flexDirection:'row',flexWrap:'wrap',gap:12,marginTop:24},
  primaryBtn:{minHeight:48,paddingHorizontal:18,borderRadius:14,backgroundColor:'#25C39B',flexDirection:'row',alignItems:'center',gap:10,justifyContent:'center',borderWidth:1,borderColor:'#1EAF8A',shadowColor:'#16B88F',shadowOpacity:.14,shadowRadius:12},
  primaryBtnText:{color:'#08231C',fontSize:10.5,fontWeight:'900',letterSpacing:.55},
  secondaryBtn:{minHeight:48,paddingHorizontal:18,borderRadius:14,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#C8D4E3',flexDirection:'row',alignItems:'center',gap:10,justifyContent:'center'},
  secondaryBtnText:{color:'#5449E8',fontSize:10.5,fontWeight:'900',letterSpacing:.5},
  heroMiniStats:{marginTop:20,flexDirection:'row',flexWrap:'wrap',gap:10},miniChip:{minHeight:38,borderRadius:999,paddingHorizontal:12,paddingVertical:7,borderWidth:1,borderColor:'#D4DFEA',backgroundColor:'rgba(255,255,255,.88)',flexDirection:'row',alignItems:'center',gap:8},miniChipText:{color:'#44546B',fontSize:9.5,fontWeight:'800'},previewDot:{width:8,height:8,borderRadius:8,backgroundColor:'#94A3B8'},
  orbCard:{borderWidth:1,borderColor:'#CBD7E6',backgroundColor:'rgba(255,255,255,.94)',borderRadius:24,padding:18,shadowColor:'#66758C',shadowOpacity:.08,shadowRadius:18,shadowOffset:{width:0,height:10}},
  orbCardTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'},orbCardLabel:{color:'#159674',fontSize:9,fontWeight:'900',letterSpacing:1.2},orbCardTitle:{color:'#0F1B2D',fontSize:17,fontWeight:'900',marginTop:4},
  liveBadge:{paddingHorizontal:10,paddingVertical:7,borderRadius:999,borderWidth:1,borderColor:'#CFE4DB',backgroundColor:'#F2FCF8',flexDirection:'row',alignItems:'center',gap:7},liveDot:{width:7,height:7,borderRadius:7},liveBadgeText:{color:'#159674',fontSize:8,fontWeight:'900',letterSpacing:.7},
  orbWrap:{height:250,alignItems:'center',justifyContent:'center'},pulseStats:{flexDirection:'row',borderTopWidth:1,borderTopColor:'#E1E8F1',paddingTop:14,alignItems:'center'},pulseStat:{flex:1,alignItems:'center'},pulseDivider:{width:1,alignSelf:'stretch',backgroundColor:'#E1E8F1'},pulseStatValue:{color:'#0F1B2D',fontSize:20,fontWeight:'900'},pulseStatLabel:{marginTop:4,color:'#708098',fontSize:9},
  previewShelf:{flexDirection:'row',gap:12},previewCard:{flex:1,minHeight:120,borderWidth:1,borderColor:'#D4DEE9',borderRadius:18,backgroundColor:'rgba(255,255,255,.9)',padding:14},previewEyebrow:{color:'#159674',fontSize:8,fontWeight:'900',letterSpacing:1.1},previewTitle:{marginTop:8,color:'#0F1B2D',fontSize:14,fontWeight:'900'},previewDesc:{marginTop:6,color:'#607086',fontSize:9.5,lineHeight:15},
  section:{gap:14},sectionEyebrow:{color:'#128A6B',fontSize:9,fontWeight:'900',letterSpacing:1.4},sectionTitle:{marginTop:5,color:'#0F1B2D',fontSize:31,lineHeight:36,fontWeight:'900'},sectionLead:{color:'#5E6F84',fontSize:11,lineHeight:18,maxWidth:800,marginTop:-4},
  featureGrid:{flexDirection:'row',flexWrap:'wrap',gap:14},featureCard:{flexGrow:1,flexBasis:250,minWidth:220,borderWidth:1,backgroundColor:'rgba(255,255,255,.95)',borderRadius:22,padding:18,shadowColor:'#66758C',shadowOpacity:.05,shadowRadius:14,shadowOffset:{width:0,height:8}},featureIcon:{width:42,height:42,borderRadius:14,alignItems:'center',justifyContent:'center'},featureTitle:{marginTop:14,color:'#0F1B2D',fontSize:14,fontWeight:'900'},featureDesc:{marginTop:8,color:'#586A81',fontSize:10,lineHeight:16},
  statsGrid:{flexDirection:'row',flexWrap:'wrap',gap:14},statTile:{flexGrow:1,flexBasis:220,minWidth:210,borderWidth:1,borderTopWidth:3,borderColor:'#D6E0EB',backgroundColor:'rgba(255,255,255,.95)',borderRadius:20,padding:18},statValue:{color:'#0F1B2D',fontSize:28,fontWeight:'900'},statLabel:{marginTop:6,color:'#1F3047',fontSize:11,fontWeight:'900'},statHint:{marginTop:8,fontSize:8.8,fontWeight:'800'},
  flowWrap:{flexDirection:'row',flexWrap:'wrap',gap:12,alignItems:'stretch'},flowStep:{flex:1,minWidth:190,borderWidth:1,borderColor:'#D8E1EC',backgroundColor:'rgba(255,255,255,.95)',borderRadius:20,padding:16},flowIcon:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center'},flowStepTitle:{marginTop:12,color:'#0F1B2D',fontSize:13,fontWeight:'900'},flowStepDesc:{marginTop:7,color:'#607086',fontSize:9.5,lineHeight:15},flowArrow:{width:34,alignItems:'center',justifyContent:'center'},
  entryGrid:{flexDirection:'row',flexWrap:'wrap',gap:14},entryCard:{position:'relative',flexGrow:1,flexBasis:210,minWidth:190,borderWidth:1,borderColor:'#D6E0EB',backgroundColor:'rgba(255,255,255,.96)',borderRadius:20,padding:16,shadowColor:'#66758C',shadowOpacity:.04,shadowRadius:12,shadowOffset:{width:0,height:7}},entryIcon:{width:42,height:42,borderRadius:14,alignItems:'center',justifyContent:'center'},entryTitle:{marginTop:12,color:'#0F1B2D',fontSize:13,fontWeight:'900'},entryDesc:{marginTop:6,color:'#62748B',fontSize:9.5,lineHeight:15,paddingRight:20},entryArrow:{position:'absolute',right:14,top:14},
  finalCta:{borderWidth:1,borderColor:'#CBD7E6',borderRadius:28,padding:24,flexDirection:'row',flexWrap:'wrap',gap:18,alignItems:'center',justifyContent:'space-between',shadowColor:'#66758C',shadowOpacity:.06,shadowRadius:18,shadowOffset:{width:0,height:8}},finalCtaCopy:{flex:1,minWidth:280},finalCtaTitle:{marginTop:6,color:'#0F1B2D',fontSize:27,lineHeight:32,fontWeight:'900',maxWidth:720},finalCtaText:{marginTop:10,color:'#5B6C82',fontSize:10.5,lineHeight:17,maxWidth:700},finalCtaActions:{flexDirection:'row',flexWrap:'wrap',gap:12,alignItems:'center'},
});
