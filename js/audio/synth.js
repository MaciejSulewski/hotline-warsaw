(function (HW) {
  'use strict';

  const MASTER_GAIN = 0.6;
  let ac = null, masterNode = null, muted = false, noiseBuf = null;

  // Creates the AudioContext (call from a user gesture). Returns false in no-op mode.
  function init() {
    if (ac) return true;
    try {
      const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Ctor) return false;
      const c = new Ctor();
      const m = c.createGain();
      m.gain.value = muted ? 0 : MASTER_GAIN;
      m.connect(c.destination);
      ac = c; masterNode = m;
      if (c.state === 'suspended' && c.resume) c.resume();
      return true;
    } catch (e) {
      ac = null; masterNode = null;
      return false;
    }
  }

  function setMuted(m) {
    muted = !!m;
    if (masterNode) masterNode.gain.value = muted ? 0 : MASTER_GAIN;
  }

  // One second of white noise, shared by every noise source.
  function noise() {
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  // Enveloped oscillator: freq -> freqEnd over dur, peak gain vol. Returns nothing; self-disposing.
  function tone(type, f0, f1, t, dur, vol, dest) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || masterNode);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // Filtered noise burst, cutoff sweeping f0 -> f1.
  function burst(ftype, f0, f1, t, dur, vol, dest) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise();
    f.type = ftype;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || masterNode);
    s.start(t); s.stop(t + dur + 0.02);
  }

  HW.synth = {
    init, setMuted,
    isMuted: () => muted,
    ctx: () => ac,
    master: () => masterNode,
    tone, burst,
  };
})(globalThis.HW);
