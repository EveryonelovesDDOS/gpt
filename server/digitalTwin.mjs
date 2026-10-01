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

    return {
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

  return { build, path, blastRadius, connectedTo };
}
