import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoScenario } from './demo.mjs';

test('demo scenario starts at a healthy baseline with explicit simulation guardrails', () => {
  const demo=createDemoScenario();
  const ready=demo.snapshot();
  assert.equal(ready.enabled,false);
  assert.equal(ready.current.id,'baseline');
  assert.match(ready.description,/deterministic presentation/i);
  assert.equal(ready.guardrails.some(item=>/never pushes IOS/i.test(item)),true);

  const started=demo.start();
  assert.equal(started.enabled,true);
  assert.equal(started.current.id,'baseline');
  assert.equal(started.events[0].kind,'start');
});

test('demo scenario advances deterministically through the complete eight-stage story', () => {
  const demo=createDemoScenario();
  let state=demo.start();
  const ids=[state.current.id];
  while(state.stageIndex<state.stageCount-1){
    state=demo.advance();
    ids.push(state.current.id);
  }
  assert.deepEqual(ids,[
    'baseline',
    'threat-observed',
    'autopilot-prepared',
    'path-analysis',
    'response-ready',
    'human-approved',
    'verification',
    'resolved',
  ]);
  assert.equal(state.current.progress,100);
  assert.equal(state.current.verification.label,'DEMO SIMULATION');
  assert.ok(state.completedAt);
});

test('demo relationship and response stages never claim live execution', () => {
  const demo=createDemoScenario();
  const path=demo.jump('path-analysis');
  assert.deepEqual(path.current.relationshipPath,['ATTACKER-PC','CORE-SW','SERVER']);
  assert.match(path.current.evidence.join(' '),/not verified/i);

  const response=demo.jump('response-ready');
  assert.equal(response.current.recommendation.mode,'preview-only');
  assert.equal(response.current.recommendation.rollbackReady,true);

  const verification=demo.jump('verification');
  assert.match(verification.current.verification.detail,/presentation step/i);
  assert.match(verification.current.verification.detail,/does not claim/i);
});

test('demo reset clears presentation state without retaining synthetic events', () => {
  const demo=createDemoScenario();
  demo.start();
  demo.advance();
  const reset=demo.reset();
  assert.equal(reset.enabled,false);
  assert.equal(reset.current.id,'baseline');
  assert.equal(reset.events.length,0);
  assert.equal(reset.startedAt,null);
});
