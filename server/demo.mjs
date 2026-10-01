import { randomUUID } from 'node:crypto';

const nowIso = () => new Date().toISOString();

const stages = [
  {
    id:'baseline',
    order:0,
    title:'Healthy baseline',
    kicker:'01 · BASELINE',
    summary:'NEXUS establishes a known-good operating picture before the scenario begins.',
    page:'dashboard',
    tone:'mint',
    evidence:[
      '2/2 infrastructure devices reachable',
      'Trust zones mapped in the digital twin',
      'No demo incident is active',
    ],
  },
  {
    id:'threat-observed',
    order:1,
    title:'ATTACKER-PC appears',
    kicker:'02 · LIVE CHANGE',
    summary:'A synthetic presentation signal marks ATTACKER-PC as newly observed in the GUEST zone.',
    page:'dashboard',
    tone:'coral',
    evidence:[
      'ATTACKER-PC · 192.168.40.66',
      'GUEST · VLAN 40 · untrusted',
      'Demo signal only — not proof of malicious activity',
    ],
  },
  {
    id:'autopilot-prepared',
    order:2,
    title:'Autopilot prepares investigation',
    kicker:'03 · INCIDENT AUTOPILOT',
    summary:'Assistive Autopilot opens an investigation workspace, collects evidence and keeps approval human-controlled.',
    page:'security',
    tone:'violet',
    evidence:[
      'Signal correlated with host inventory',
      'Recent changes attached to the case',
      'Containment remains approval-gated',
    ],
  },
  {
    id:'path-analysis',
    order:3,
    title:'Digital Twin traces exposure',
    kicker:'04 · RELATIONSHIP ANALYSIS',
    summary:'NEXUS highlights ATTACKER-PC → CORE-SW → SERVER as a graph relationship while keeping IP reachability unverified.',
    page:'topology',
    tone:'blue',
    evidence:[
      'Relationship path represented in the twin',
      'SERVER identified as a protected asset',
      'IP reachability remains not verified',
    ],
  },
  {
    id:'response-ready',
    order:4,
    title:'Containment plan prepared',
    kicker:'05 · RESPONSE PLAN',
    summary:'NEXUS prepares a reversible quarantine preview and rollback steps without executing IOS configuration.',
    page:'security',
    tone:'amber',
    evidence:[
      'Target attachment: FastEthernet0/4',
      'Shutdown preview prepared',
      'Rollback: no shutdown',
    ],
  },
  {
    id:'human-approved',
    order:5,
    title:'Operator approves simulation',
    kicker:'06 · HUMAN CONTROL',
    summary:'The presentation advances through a simulated approval checkpoint. No network command is pushed by NEXUS.',
    page:'security',
    tone:'violet',
    evidence:[
      'Approval attributed to the operator',
      'Execution mode remains preview / simulated',
      'Rollback stays ready',
    ],
  },
  {
    id:'verification',
    order:6,
    title:'NEXUS verifies the expected outcome',
    kicker:'07 · VERIFICATION',
    summary:'The demo shows the verification stage and clearly labels the result as simulated presentation evidence.',
    page:'security',
    tone:'mint',
    evidence:[
      'Expected host visibility checked',
      'Post-change state compared with baseline',
      'Presentation result is synthetic, not controller proof',
    ],
  },
  {
    id:'resolved',
    order:7,
    title:'Incident story resolved',
    kicker:'08 · RESOLUTION',
    summary:'The guided scenario closes with a clean audit trail from baseline through investigation, approval and verification.',
    page:'home',
    tone:'mint',
    evidence:[
      'Timeline complete',
      'Human decision point recorded',
      'No hidden or automatic configuration execution',
    ],
  },
];

function stagePayload(index) {
  const stage=stages[Math.max(0,Math.min(index,stages.length-1))];
  return {
    ...stage,
    progress:Math.round(((stage.order+1)/stages.length)*100),
    relationshipPath:stage.order>=3 ? ['ATTACKER-PC','CORE-SW','SERVER'] : [],
    highlightedAssets:stage.order>=3 ? ['ATTACKER-PC','CORE-SW','SERVER'] : stage.order>=1 ? ['ATTACKER-PC'] : [],
    recommendation:stage.order>=4 ? {
      title:'Quarantine ATTACKER-PC switch port',
      target:'FastEthernet0/4',
      mode:'preview-only',
      rollbackReady:true,
    } : null,
    verification:stage.order>=6 ? {
      result:stage.order>=7 ? 'resolved-demo' : 'simulated-support',
      label:'DEMO SIMULATION',
      detail:'This presentation step demonstrates the verification workflow. It does not claim that Packet Tracer forwarding state changed.',
    } : null,
  };
}

export function createDemoScenario() {
  let enabled=false;
  let index=0;
  let startedAt=null;
  let completedAt=null;
  let events=[];

  const append=(kind,title,detail='')=>{
    const item={id:randomUUID(),at:nowIso(),kind,title,detail};
    events=[item,...events].slice(0,30);
    return item;
  };

  function snapshot() {
    return {
      enabled,
      mode:'presentation-simulation',
      scenarioId:'attacker-containment-v1',
      title:'ATTACKER-PC Containment Story',
      description:'A deterministic presentation scenario that demonstrates NEXUS change detection, assistive investigation, digital-twin analysis, human approval and verification without pretending to alter the live network.',
      startedAt,
      completedAt,
      current:stagePayload(index),
      stageIndex:index,
      stageCount:stages.length,
      stages:stages.map(stage=>({
        id:stage.id,
        order:stage.order,
        title:stage.title,
        kicker:stage.kicker,
        page:stage.page,
        tone:stage.tone,
        state:stage.order<index?'complete':stage.order===index?(enabled?'active':'ready'):'upcoming',
      })),
      events,
      guardrails:[
        'Demo Mode never pushes IOS configuration.',
        'Synthetic demo evidence is labelled separately from live controller evidence.',
        'Human approval remains visible in the story.',
      ],
      generatedAt:nowIso(),
    };
  }

  function start() {
    enabled=true;
    index=0;
    startedAt=nowIso();
    completedAt=null;
    events=[];
    append('start','Demo scenario started','Healthy baseline established for the presentation story.');
    return snapshot();
  }

  function advance() {
    if(!enabled) start();
    if(index < stages.length-1) {
      index++;
      const stage=stagePayload(index);
      append('stage',stage.title,stage.summary);
      if(index===stages.length-1) completedAt=nowIso();
    }
    return snapshot();
  }

  function previous() {
    if(!enabled) return snapshot();
    index=Math.max(0,index-1);
    completedAt=index===stages.length-1?completedAt:null;
    append('rewind','Demo moved back',`Returned to ${stagePayload(index).title}.`);
    return snapshot();
  }

  function reset() {
    enabled=false;
    index=0;
    startedAt=null;
    completedAt=null;
    events=[];
    return snapshot();
  }

  function jump(stageId) {
    const next=stages.findIndex(stage=>stage.id===stageId);
    if(next<0) throw new Error('Unknown demo stage');
    if(!enabled) {
      enabled=true;
      startedAt=nowIso();
    }
    index=next;
    completedAt=index===stages.length-1?nowIso():null;
    const stage=stagePayload(index);
    append('jump',stage.title,'Operator selected this presentation stage.');
    return snapshot();
  }

  return { snapshot, start, advance, previous, reset, jump };
}
