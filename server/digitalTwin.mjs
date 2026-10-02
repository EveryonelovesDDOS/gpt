function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

function trustTier(zone, trust) {
  if (trust === 'critical' || ['SERVER','MANAGEMENT'].includes(zone)) return 'critical';
  if (trust === 'untrusted' || zone === 'GUEST') return 'untrusted';
  if (trust === 'sensitive' || zone === 'FINANCE') return 'sensitive';
  if (trust === 'trusted' || ['ADMIN','STAFF'].includes(zone)) return 'trusted';
  if (trust === 'external' || zone === 'PUBLIC') return 'external';
  return 'unknown';
}

export function createDigitalTwin({ networkClient }) {
  async function build() {
    const [topology, hosts, devices, security] = await Promise.all([
      networkClient.getTopology(),
      networkClient.getHosts(),
      networkClient.getNetworkDevices(),
      networkClient.getSecurityAnalysis(),
    ]);

    const hostByName = new Map(hosts.map(h => [normalizeName(h.name), h]));
    const deviceByName = new Map(devices.map(d => [normalizeName(d.name), d]));
    const nodes = topology.nodes.map(node => {
      const host = hostByName.get(normalizeName(node.label));
      const device = deviceByName.get(normalizeName(node.label));
      return {
        ...node,
        assetType: node.kind === 'device' ? 'infrastructure' : 'endpoint',
        trustTier: trustTier(node.zone, node.trust),
        interface: host?.connectedInterface || '',
        managementIp: device?.managementIp || '',
        macAddress: host?.macAddress || device?.macAddress || '',
        critical: ['SERVER','MANAGEMENT'].includes(node.zone),
        labThreatMarker: Boolean(host?.labThreatMarker),
      };
    });

    const links = topology.links.map(link => ({
      ...link,
      certainty: link.sourceType === 'controller' ? 'observed' : link.sourceType === 'known-lab' ? 'known-lab' : 'inferred',
    }));

    const zones = unique(nodes.map(node => node.zone)).map(zone => {
      const members = nodes.filter(node => node.zone === zone);
      return {
        id: `zone:${zone}`,
        name: zone,
        count: members.length,
        trustTier: members[0]?.trustTier || 'unknown',
        vlan: members.find(node => node.vlan)?.vlan ?? null,
        members: members.map(node => node.id),
      };
    });

    const relationships = links.map(link => {
      const source = nodes.find(node => node.id === link.source);
      const target = nodes.find(node => node.id === link.target);
      return {
        id: link.id,
        source: link.source,
        sourceLabel: source?.label || link.source,
        target: link.target,
        targetLabel: target?.label || link.target,
        label: link.label,
        certainty: link.certainty,
      };
    });

    const policy = [
      {
        id:'guest-server-isolation',
        sourceZone:'GUEST',
        targetZone:'SERVER',
        expectation:'isolated',
        verification:'not-verified',
        reason:'Packet Tracer controller inventory does not expose enough ACL/routing state to prove enforcement.',
      },
      {
        id:'guest-management-isolation',
        sourceZone:'GUEST',
        targetZone:'MANAGEMENT',
        expectation:'isolated',
        verification:'not-verified',
        reason:'Management-zone protection is a NEXUS policy expectation; live ACL enforcement is not exposed by the controller API.',
      },
    ];

    const twin = {
      generatedAt:new Date().toISOString(),
      nodes,
      links,
      zones,
      relationships,
      policy,
      securitySummary:{
        posture:security.posture,
        alertCount:security.alertCount,
        criticalCount:security.criticalCount,
        highCount:security.highCount,
      },
      confidence:{
        physicalTopology: topology.physicalAvailable ? 'controller' : 'partial',
        endpointAttachments: links.some(link => link.sourceType === 'controller') ? 'mixed' : 'inferred',
        policyEnforcement:'not-verified',
      },
    };
    return { ...twin, operations:operationsOverview(twin) };
  }

  function resolveNode(twin, value) {
    const q = normalizeName(value);
    if (!q) return null;
    return twin.nodes.find(node =>
      normalizeName(node.id) === q ||
      normalizeName(node.label) === q ||
      normalizeName(node.ip) === q ||
      normalizeName(node.managementIp) === q
    ) || twin.nodes.find(node => normalizeName(node.label).includes(q));
  }

  function adjacency(twin) {
    const map = new Map(twin.nodes.map(node => [node.id, []]));
    for (const link of twin.links) {
      if (!map.has(link.source)) map.set(link.source, []);
      if (!map.has(link.target)) map.set(link.target, []);
      map.get(link.source).push({ nodeId:link.target, link });
      map.get(link.target).push({ nodeId:link.source, link });
    }
    return map;
  }

  function components(twin, excludedId = '') {
    const graph=adjacency(twin);
    const allowed=twin.nodes.filter(node=>node.id!==excludedId).map(node=>node.id);
    const allowedSet=new Set(allowed);
    const seen=new Set();
    const groups=[];
    for(const id of allowed) {
      if(seen.has(id)) continue;
      const queue=[id];
      seen.add(id);
      const group=[];
      while(queue.length) {
        const current=queue.shift();
        group.push(current);
        for(const edge of graph.get(current)||[]) {
          if(edge.nodeId===excludedId || !allowedSet.has(edge.nodeId) || seen.has(edge.nodeId)) continue;
          seen.add(edge.nodeId);
          queue.push(edge.nodeId);
        }
      }
      groups.push(group);
    }
    return groups;
  }

  function pathExistsInTwin(twin, sourceId, targetId, excludedId = '') {
    if(!sourceId || !targetId || sourceId===excludedId || targetId===excludedId) return false;
    if(sourceId===targetId) return true;
    const graph=adjacency(twin);
    const queue=[sourceId];
    const seen=new Set([sourceId, excludedId].filter(Boolean));
    while(queue.length) {
      const current=queue.shift();
      for(const edge of graph.get(current)||[]) {
        if(seen.has(edge.nodeId)) continue;
        if(edge.nodeId===targetId) return true;
        seen.add(edge.nodeId);
        queue.push(edge.nodeId);
      }
    }
    return false;
  }

  function simplePaths(twin, sourceId, targetId, maxPaths=3, maxDepth=10) {
    const graph=adjacency(twin);
    const out=[];
    const stack=[{id:sourceId,path:[sourceId]}];
    while(stack.length && out.length<maxPaths) {
      const current=stack.pop();
      if(current.id===targetId) {
        out.push(current.path);
        continue;
      }
      if(current.path.length>=maxDepth) continue;
      const next=[...(graph.get(current.id)||[])].sort((a,b)=>String(a.nodeId).localeCompare(String(b.nodeId)));
      for(let i=next.length-1;i>=0;i--) {
        const edge=next[i];
        if(current.path.includes(edge.nodeId)) continue;
        stack.push({id:edge.nodeId,path:[...current.path,edge.nodeId]});
      }
    }
    return out;
  }

  function operationsOverview(twin) {
    const graph=adjacency(twin);
    const certaintyCounts={ observed:0, 'known-lab':0, inferred:0 };
    for(const link of twin.links) {
      const key=link.certainty || 'inferred';
      certaintyCounts[key]=(certaintyCounts[key]||0)+1;
    }

    const attention=twin.nodes.map(node=>{
      const degree=(graph.get(node.id)||[]).length;
      const weakLinks=(graph.get(node.id)||[]).filter(edge=>edge.link.certainty==='inferred').length;
      let score=0;
      const reasons=[];
      if(node.labThreatMarker) { score+=40; reasons.push('lab threat marker'); }
      if(node.trustTier==='untrusted') { score+=25; reasons.push('untrusted zone'); }
      if(node.critical) { score+=20; reasons.push('protected asset'); }
      if(node.trustTier==='external') { score+=10; reasons.push('external exposure'); }
      if(degree>=3) { const points=Math.min(15,degree*3); score+=points; reasons.push(`${degree} graph relationships`); }
      if(weakLinks) { score+=Math.min(15,weakLinks*5); reasons.push(`${weakLinks} inferred link(s)`); }
      return {
        id:node.id,
        label:node.label,
        zone:node.zone,
        trustTier:node.trustTier,
        critical:node.critical,
        degree,
        score:Math.min(100,score),
        reasons,
      };
    }).sort((a,b)=>b.score-a.score || b.degree-a.degree || a.label.localeCompare(b.label));

    const baseComponentCount=components(twin).length;
    const singlePointsOfFailure=twin.nodes.map(node=>{
      const groups=components(twin,node.id);
      const split=Math.max(0,groups.length-baseComponentCount);
      const separated=groups.length>1 ? groups.slice().sort((a,b)=>b.length-a.length).slice(1).flat() : [];
      return {
        id:node.id,
        label:node.label,
        zone:node.zone,
        componentIncrease:split,
        separatedAssets:separated.map(id=>twin.nodes.find(item=>item.id===id)?.label||id),
        criticalSeparated:separated.map(id=>twin.nodes.find(item=>item.id===id)).filter(Boolean).filter(item=>item.critical).map(item=>item.label),
      };
    }).filter(item=>item.componentIncrease>0).sort((a,b)=>b.componentIncrease-a.componentIncrease || b.separatedAssets.length-a.separatedAssets.length);

    const policyChecks=twin.policy.map(rule=>{
      const sources=twin.nodes.filter(node=>node.zone===rule.sourceZone);
      const targets=twin.nodes.filter(node=>node.zone===rule.targetZone);
      const relationshipPath=sources.some(source=>targets.some(target=>pathExistsInTwin(twin,source.id,target.id)));
      return {
        id:rule.id,
        sourceZone:rule.sourceZone,
        targetZone:rule.targetZone,
        expectation:rule.expectation,
        verification:rule.verification,
        relationshipPath,
        sourceAssets:sources.map(node=>node.label),
        targetAssets:targets.map(node=>node.label),
        assessment:relationshipPath
          ? 'A graph relationship exists between these zones. Enforcement remains unverified.'
          : 'No graph relationship was found between these zones in the current twin. Enforcement remains unverified.',
      };
    });

    return {
      attention,
      singlePointsOfFailure,
      policyChecks,
      confidenceAudit:{
        totalLinks:twin.links.length,
        observed:certaintyCounts.observed||0,
        knownLab:certaintyCounts['known-lab']||0,
        inferred:certaintyCounts.inferred||0,
        weakLinks:twin.links.filter(link=>link.certainty==='inferred').map(link=>({
          id:link.id,
          source:twin.nodes.find(node=>node.id===link.source)?.label||link.source,
          target:twin.nodes.find(node=>node.id===link.target)?.label||link.target,
          label:link.label,
        })),
      },
      note:'Operations analytics are graph-based decision support. They do not independently prove IP reachability, policy enforcement, traffic flow, compromise, or device failure.',
    };
  }

  async function failureImpact(assetQuery) {
    const twin=await build();
    const asset=resolveNode(twin,assetQuery);
    if(!asset) return { found:false, asset:assetQuery, generatedAt:new Date().toISOString() };

    const groups=components(twin,asset.id);
    const core=twin.nodes.find(node=>node.role==='core-switch' && node.id!==asset.id);
    let affectedIds=[];
    if(core) {
      const coreGroup=groups.find(group=>group.includes(core.id)) || [];
      const coreSet=new Set(coreGroup);
      affectedIds=twin.nodes.filter(node=>node.id!==asset.id&&!coreSet.has(node.id)).map(node=>node.id);
    } else {
      affectedIds=twin.nodes.filter(node=>node.id!==asset.id).map(node=>node.id);
    }
    const affected=affectedIds.map(id=>twin.nodes.find(node=>node.id===id)).filter(Boolean).map(node=>({
      id:node.id,label:node.label,zone:node.zone,critical:node.critical,trustTier:node.trustTier,
    }));
    const criticalAffected=affected.filter(node=>node.critical);
    const severity=criticalAffected.length || affected.length>=Math.ceil(Math.max(1,twin.nodes.length-1)/2) ? 'high'
      : affected.length ? 'medium' : 'low';

    return {
      found:true,
      asset:{id:asset.id,label:asset.label,zone:asset.zone,role:asset.role},
      scenario:'graph-node-unavailable',
      severity,
      components:groups.map((group,index)=>({
        id:`component-${index+1}`,
        assets:group.map(id=>twin.nodes.find(node=>node.id===id)?.label||id),
      })),
      affected,
      criticalAffected,
      note:'This is a what-if graph dependency simulation. It does not shut down the device or prove actual traffic loss.',
      generatedAt:new Date().toISOString(),
    };
  }

  async function resiliencePaths(sourceQuery,targetQuery,maxPaths=3) {
    const twin=await build();
    const source=resolveNode(twin,sourceQuery);
    const target=resolveNode(twin,targetQuery);
    if(!source || !target) return { found:false, source:sourceQuery, target:targetQuery, paths:[], generatedAt:new Date().toISOString() };
    const ids=simplePaths(twin,source.id,target.id,Math.max(1,Math.min(5,Number(maxPaths)||3)),Math.max(6,twin.nodes.length+2));
    const paths=ids.map((pathIds,index)=>({
      id:`relationship-path-${index+1}`,
      hops:pathIds.map(id=>twin.nodes.find(node=>node.id===id)?.label||id),
      length:Math.max(0,pathIds.length-1),
    }));
    return {
      found:paths.length>0,
      source:source.label,
      target:target.label,
      redundancy:paths.length>1?'multiple':paths.length===1?'single':'none',
      pathCount:paths.length,
      paths,
      note:'These are alternate graph relationship paths, not verified routing or packet-forwarding paths.',
      generatedAt:new Date().toISOString(),
    };
  }

  async function policyAudit() {
    const twin=await build();
    return {
      checks:twin.operations.policyChecks,
      confidence:twin.confidence.policyEnforcement,
      note:'Policy checks compare intended segmentation with graph relationships. Controller data does not prove ACL or routing enforcement.',
      generatedAt:new Date().toISOString(),
    };
  }

  async function path(sourceQuery, targetQuery) {
    const twin = await build();
    const source = resolveNode(twin, sourceQuery);
    const target = resolveNode(twin, targetQuery);
    if (!source || !target) {
      return {
        found:false,
        source:source?.label || sourceQuery,
        target:target?.label || targetQuery,
        reason:'One or both assets were not found in the current digital twin.',
        generatedAt:new Date().toISOString(),
      };
    }
    if (source.id === target.id) {
      return { found:true, source:source.label, target:target.label, hops:[{node:source,via:null}], relationshipPath:true, reachability:'self', certainty:'observed', generatedAt:new Date().toISOString() };
    }

    const graph = adjacency(twin);
    const queue=[source.id];
    const seen=new Set([source.id]);
    const prev=new Map();

    while(queue.length) {
      const current=queue.shift();
      if(current===target.id) break;
      for(const edge of graph.get(current)||[]) {
        if(seen.has(edge.nodeId)) continue;
        seen.add(edge.nodeId);
        prev.set(edge.nodeId,{from:current,link:edge.link});
        queue.push(edge.nodeId);
      }
    }

    if(!seen.has(target.id)) {
      return {
        found:false,
        source:source.label,
        target:target.label,
        reason:'No relationship path exists in the current NEXUS digital twin.',
        relationshipPath:false,
        reachability:'not-established',
        generatedAt:new Date().toISOString(),
      };
    }

    const ids=[target.id];
    let cursor=target.id;
    while(cursor!==source.id) {
      const step=prev.get(cursor);
      if(!step) break;
      cursor=step.from;
      ids.push(cursor);
    }
    ids.reverse();

    const hops=ids.map((id,index)=>{
      const node=twin.nodes.find(n=>n.id===id);
      if(index===0) return {node,via:null};
      const step=prev.get(id);
      return {node,via:step?.link || null};
    });
    const certainty=hops.slice(1).some(h=>h.via?.sourceType==='inferred') ? 'inferred'
      : hops.slice(1).some(h=>h.via?.sourceType==='known-lab') ? 'mixed'
      : 'observed';

    const policyMatch=twin.policy.find(rule => rule.sourceZone===source.zone && rule.targetZone===target.zone);
    return {
      found:true,
      source:source.label,
      target:target.label,
      hops,
      relationshipPath:true,
      reachability:'not-verified',
      certainty,
      policyExpectation:policyMatch || null,
      explanation: policyMatch
        ? `A relationship path exists, but NEXUS cannot prove IP reachability. Policy expects ${source.zone} → ${target.zone} traffic to be ${policyMatch.expectation}.`
        : 'A relationship path exists in the digital twin, but controller data does not prove routing, ACL, firewall or application-layer reachability.',
      generatedAt:new Date().toISOString(),
    };
  }

  async function blastRadius(assetQuery, depth=3) {
    const twin=await build();
    const asset=resolveNode(twin,assetQuery);
    if(!asset) return { found:false, asset:assetQuery, affected:[], reason:'Asset not found in the current digital twin.', generatedAt:new Date().toISOString() };

    const graph=adjacency(twin);
    const queue=[{id:asset.id,level:0}];
    const seen=new Set([asset.id]);
    const affected=[];

    while(queue.length) {
      const item=queue.shift();
      if(item.level>=depth) continue;
      for(const edge of graph.get(item.id)||[]) {
        if(seen.has(edge.nodeId)) continue;
        seen.add(edge.nodeId);
        const node=twin.nodes.find(n=>n.id===edge.nodeId);
        if(node) affected.push({
          id:node.id,
          label:node.label,
          zone:node.zone,
          trustTier:node.trustTier,
          critical:node.critical,
          distance:item.level+1,
          certainty:edge.link.sourceType==='controller'?'observed':edge.link.sourceType==='known-lab'?'known-lab':'inferred',
        });
        queue.push({id:edge.nodeId,level:item.level+1});
      }
    }

    return {
      found:true,
      asset:{ id:asset.id,label:asset.label,zone:asset.zone,trustTier:asset.trustTier },
      depth,
      affected,
      criticalAssets:affected.filter(item=>item.critical),
      note:'Blast radius describes graph dependency/adjacency in the current twin. It is not proof of traffic reachability or compromise propagation.',
      generatedAt:new Date().toISOString(),
    };
  }

  async function connectedTo(assetQuery) {
    const twin=await build();
    const asset=resolveNode(twin,assetQuery);
    if(!asset) return { found:false, asset:assetQuery, neighbors:[], generatedAt:new Date().toISOString() };
    const graph=adjacency(twin);
    const neighbors=(graph.get(asset.id)||[]).map(edge=>{
      const node=twin.nodes.find(n=>n.id===edge.nodeId);
      return {
        id:node?.id || edge.nodeId,
        label:node?.label || edge.nodeId,
        zone:node?.zone || 'UNKNOWN',
        role:node?.role || '',
        via:edge.link.label,
        certainty:edge.link.sourceType==='controller'?'observed':edge.link.sourceType==='known-lab'?'known-lab':'inferred',
      };
    });
    return { found:true, asset:{id:asset.id,label:asset.label,zone:asset.zone}, neighbors, generatedAt:new Date().toISOString() };
  }

  return { build, path, blastRadius, connectedTo, failureImpact, resiliencePaths, policyAudit };
}
