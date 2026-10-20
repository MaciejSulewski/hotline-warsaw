'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadHW } = require('./helpers/load');

// ---- Node with no AudioContext: everything is a silent no-op ------------------
test('no-op mode: nothing throws without AudioContext', () => {
  const HW = loadHW();
  assert.equal(HW.synth.init(), false);
  assert.equal(HW.synth.init(), false);
  assert.doesNotThrow(() => HW.sfx.play('shot'));
  assert.doesNotThrow(() => HW.sfx.onEvents([{ type: 'shot' }, { type: 'bogus' }]));
  assert.doesNotThrow(() => HW.music.start({ root: 'A', progression: [0, 5, 3, 4] }));
  assert.doesNotThrow(() => HW.music.muffle(true));
  assert.doesNotThrow(() => HW.music.stop());
});
test('mute flag works without a context', () => {
  const HW = loadHW();
  assert.equal(HW.synth.isMuted(), false);
  HW.synth.setMuted(true);
  assert.equal(HW.synth.isMuted(), true);
});
test('init returns false when the constructor throws', () => {
  const HW = loadHW({ AudioContext: function () { throw new Error('blocked'); } });
  assert.equal(HW.synth.init(), false);
  assert.doesNotThrow(() => HW.sfx.play('death'));
});

// ---- Fake AudioContext ---------------------------------------------------------
function makeFake() {
  const log = { osc: 0, gain: 0, filter: 0, source: 0, buffer: 0 };
  const param = (v) => ({
    value: v,
    setValueAtTime(x) { this.value = x; return this; },
    linearRampToValueAtTime(x) { return this; },
    exponentialRampToValueAtTime(x) { return this; },
    setTargetAtTime(x) { this.value = x; return this; },
  });
  const node = () => ({ connect(n) { return n; }, disconnect() {}, start() {}, stop() {} });
  class FakeCtx {
    constructor() { this.currentTime = 0; this.sampleRate = 8000; this.destination = node(); this.state = 'running'; log.ctx = this; }
    resume() { return Promise.resolve(); }
    createGain() { log.gain++; return Object.assign(node(), { gain: param(1) }); }
    createOscillator() { log.osc++; return Object.assign(node(), { type: 'sine', frequency: param(440) }); }
    createBiquadFilter() { log.filter++; return Object.assign(node(), { type: 'lowpass', frequency: param(350), Q: param(1) }); }
    createBuffer(ch, len) { log.buffer++; return { getChannelData: () => new Float32Array(len) }; }
    createBufferSource() { log.source++; return Object.assign(node(), { buffer: null }); }
  }
  return { FakeCtx, log };
}

test('fake AudioContext: init builds master gain at 0.6 and is idempotent', () => {
  const { FakeCtx, log } = makeFake();
  const HW = loadHW({ AudioContext: FakeCtx });
  assert.equal(HW.synth.init(), true);
  assert.equal(HW.synth.init(), true);
  assert.ok(HW.synth.ctx());
  assert.equal(HW.synth.master().gain.value, 0.6);
  assert.equal(log.ctx, HW.synth.ctx());
});
test('fake AudioContext: sfx.play creates nodes; unknown names ignored', () => {
  const { FakeCtx, log } = makeFake();
  const HW = loadHW({ AudioContext: FakeCtx });
  HW.synth.init();
  const before = log.gain + log.osc + log.source;
  HW.sfx.play('nope');
  assert.equal(log.gain + log.osc + log.source, before);
  for (const n of ['shot', 'shotgun', 'melee', 'swing', 'door', 'death', 'kill', 'pickup', 'click', 'ring']) {
    const b = log.gain + log.osc + log.source;
    HW.sfx.play(n);
    assert.ok(log.gain + log.osc + log.source > b, n + ' made no nodes');
  }
});
test('fake AudioContext: onEvents maps types, shotgun variant', () => {
  const { FakeCtx, log } = makeFake();
  const HW = loadHW({ AudioContext: FakeCtx });
  HW.synth.init();
  const played = [];
  const orig = HW.sfx.play;
  HW.sfx.play = (n) => played.push(n);
  // onEvents must call through the public play so it can be observed
  HW.sfx.onEvents([{ type: 'shot', weapon: 'pistol' }, { type: 'shot', weapon: 'shotgun' }, { type: 'knockdown' },
    { type: 'swing' }, { type: 'melee' }, { type: 'door' }, { type: 'death' }, { type: 'kill' },
    { type: 'pickup' }, { type: 'click' }, { type: 'floor' }]);
  assert.deepEqual(played, ['shot', 'shotgun', 'melee', 'swing', 'melee', 'door', 'death', 'kill', 'pickup', 'click']);
  HW.sfx.play = orig;
});
test('fake AudioContext: setMuted zeroes master gain, unmute restores', () => {
  const { FakeCtx } = makeFake();
  const HW = loadHW({ AudioContext: FakeCtx });
  HW.synth.init();
  HW.synth.setMuted(true);
  assert.equal(HW.synth.isMuted(), true);
  assert.equal(HW.synth.master().gain.value, 0);
  HW.synth.setMuted(false);
  assert.equal(HW.synth.master().gain.value, 0.6);
});
test('fake AudioContext: music schedules notes on a timer; stop and muffle are safe', () => {
  const { FakeCtx, log } = makeFake();
  const timers = [];
  const HW = loadHW({
    AudioContext: FakeCtx,
    setInterval: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearInterval: (id) => { timers[id - 1] = null; },
  });
  HW.synth.init();
  HW.music.start({ root: 'A', progression: [0, 5, 3, 4] });
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, 25);
  const osc0 = log.osc;
  timers[0].fn();
  assert.ok(log.osc > osc0, 'first tick scheduled notes');
  const osc1 = log.osc;
  for (let i = 0; i < 40; i++) { log.ctx.currentTime += 0.05; timers[0].fn(); }
  assert.ok(log.osc > osc1, 'later tick scheduled more');
  HW.music.start({ root: 'D', progression: [0, 3] }); // already running: no second timer
  assert.equal(timers.filter(Boolean).length, 1);
  assert.doesNotThrow(() => HW.music.muffle(true));
  assert.doesNotThrow(() => HW.music.muffle(false));
  HW.music.stop();
  assert.equal(timers.filter(Boolean).length, 0);
});

// ---- main.js wiring --------------------------------------------------------------
test('main: first gesture starts audio once, M toggles mute', () => {
  const { FakeCtx } = makeFake();
  const gl = {};
  const env = {
    AudioContext: FakeCtx,
    setInterval: () => 1, clearInterval: () => {},
    document: { getElementById: () => null, createElement: () => canvas },
  };
  // Reuse the presentation harness style: minimal canvas + window stubs.
  var canvas; const ctx2d = new Proxy({}, { get: () => () => {}, set: () => true });
  canvas = { width: 0, height: 0, style: {}, addEventListener() {}, getContext: () => ctx2d, getBoundingClientRect: () => ({ left: 0, top: 0, width: 480, height: 270 }) };
  env.document.getElementById = () => canvas;
  env.addEventListener = (t, fn) => { (gl[t] = gl[t] || []).push(fn); };
  env.innerWidth = 960; env.innerHeight = 540;
  env.requestAnimationFrame = () => 1;
  env.performance = { now: () => 0 };
  const HW = loadHW(env);
  assert.equal(HW.synth.ctx(), null);
  gl.pointerdown[0]({});
  gl.keydown.forEach((f) => f({ code: 'KeyA' }));
  assert.ok(HW.synth.ctx());
  HW.synth.setMuted(!HW.synth.isMuted());
  assert.equal(HW.synth.master().gain.value, 0);
});

test('main: audio retries resume() on each gesture until the context is running', () => {
  const { FakeCtx } = makeFake();
  let resumes = 0;
  class Suspended extends FakeCtx {
    constructor() { super(); this.state = 'suspended'; }
    resume() { resumes++; return { then() {} }; }
  }
  const gl = {};
  const ctx2d = new Proxy({}, { get: () => () => {}, set: () => true });
  const canvas = { width: 0, height: 0, style: {}, addEventListener() {}, getContext: () => ctx2d, getBoundingClientRect: () => ({ left: 0, top: 0, width: 480, height: 270 }) };
  const HW = loadHW({
    AudioContext: Suspended,
    setInterval: () => 1, clearInterval: () => {},
    document: { getElementById: () => canvas, createElement: () => canvas },
    addEventListener: (t, fn) => { (gl[t] = gl[t] || []).push(fn); },
    removeEventListener: () => {},
    innerWidth: 960, innerHeight: 540,
    requestAnimationFrame: () => 1,
    performance: { now: () => 0 },
  });
  const gesture = () => gl.pointerdown[0]({});
  gesture();
  assert.ok(HW.synth.ctx());
  const r1 = resumes;
  assert.ok(r1 >= 1);
  gesture();
  assert.ok(resumes > r1, 'second gesture resumed again');
  HW.synth.ctx().state = 'running';
  gesture();
  const r2 = resumes;
  gesture();
  gl.keydown.forEach((f) => f({ code: 'KeyA' }));
  assert.equal(resumes, r2, 'no more resume once running');
});
