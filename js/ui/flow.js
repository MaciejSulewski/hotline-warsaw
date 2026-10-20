(function (HW) {
  'use strict';

  // Pure screen state machine (no drawing, no DOM). main.js dispatches actions and reacts to
  // state changes (loads the world on 'playing', computes results on a won world).
  //   title → levelSelect → phoneCall → maskSelect → playing → results → levelSelect
  // Actions: click, select {id}, confirm, back, won {results, save?}, move {dir}, hover {id}, abort.
  const MASK_IDS = ['lajkonik', 'bolek', 'lolek', 'czapka', 'kleks'];
  const RING = 1.5, RING_EVERY = 0.5; // phone rings before the typewriter starts
  const RESULTS_LOCK = 0.5; // results ignore dismissal this long (no accidental skip)

  function create(save) {
    return {
      state: 'title', save, levelId: null, maskId: null, world: null, results: null,
      phone: null, sel: 0, stateT: 0,
    };
  }

  function levelList(flow) {
    return HW.masks.levelOrder
      .filter((id) => HW.levels && HW.levels[id])
      .map((id) => ({ id, level: HW.levels[id], unlocked: flow.save.unlockedLevels.includes(id) }));
  }

  function maskList(flow) {
    return MASK_IDS.map((id) => ({ id, mask: HW.masks[id], unlocked: flow.save.unlockedMasks.includes(id) }));
  }

  function listFor(flow) {
    if (flow.state === 'levelSelect') return levelList(flow);
    if (flow.state === 'maskSelect') return maskList(flow);
    return null;
  }

  const ringing = (flow) => flow.state === 'phoneCall' && flow.stateT < RING;

  function go(flow, state) {
    flow.state = state;
    flow.stateT = 0;
    const list = listFor(flow);
    if (list) {
      const prev = state === 'levelSelect' ? flow.levelId : flow.maskId;
      const i = list.findIndex((e) => e.id === prev && e.unlocked);
      flow.sel = i >= 0 ? i : Math.max(0, list.findIndex((e) => e.unlocked));
    }
  }

  function toLevelSelect(flow) {
    flow.world = null;
    flow.phone = null;
    flow.results = null;
    flow.maskId = null;
    go(flow, 'levelSelect');
  }

  function choose(flow, id) {
    const list = listFor(flow);
    const e = list && list.find((x) => x.id === id);
    if (!e || !e.unlocked) return;
    if (flow.state === 'levelSelect') {
      flow.levelId = id;
      flow.phone = HW.phonecall.create(e.level.phoneCall || []);
      go(flow, 'phoneCall');
    } else {
      flow.maskId = id;
      go(flow, 'playing');
    }
  }

  // Keyboard selection walks unlocked entries only.
  function move(flow, dir) {
    const list = listFor(flow);
    if (!list) return;
    for (let i = flow.sel + dir; i >= 0 && i < list.length; i += dir) {
      if (list[i].unlocked) { flow.sel = i; return; }
    }
  }

  // click/confirm on the phone call: end ringing + typing at once, then continue.
  function advanceCall(flow) {
    if (ringing(flow) || !flow.phone.done) {
      flow.stateT = Math.max(flow.stateT, RING);
      HW.phonecall.skip(flow.phone);
    } else {
      go(flow, 'maskSelect');
    }
  }

  function handle(flow, action) {
    const s = flow.state, type = action.type;
    // abort: unconditional escape hatch to level select (used by the error screen).
    if (type === 'abort') { if (s !== 'title' && s !== 'levelSelect') toLevelSelect(flow); return flow; }
    if (s === 'title') {
      if (type === 'click' || type === 'confirm') go(flow, 'levelSelect');
    } else if (s === 'levelSelect' || s === 'maskSelect') {
      const list = listFor(flow);
      if (type === 'select') choose(flow, action.id);
      else if (type === 'confirm') choose(flow, list[flow.sel] && list[flow.sel].id);
      else if (type === 'move') move(flow, action.dir);
      else if (type === 'hover') {
        const i = list.findIndex((e) => e.id === action.id && e.unlocked);
        if (i >= 0) flow.sel = i;
      } else if (type === 'back' && s === 'maskSelect') toLevelSelect(flow);
    } else if (s === 'phoneCall') {
      if (type === 'click' || type === 'confirm') advanceCall(flow);
      else if (type === 'back') toLevelSelect(flow);
    } else if (s === 'playing') {
      if (type === 'back') toLevelSelect(flow);
      else if (type === 'won') {
        flow.results = action.results;
        if (action.save) flow.save = action.save;
        go(flow, 'results');
      }
    } else if (s === 'results') {
      if (flow.stateT < RESULTS_LOCK) return flow;
      if (type === 'click' || type === 'confirm' || type === 'back') toLevelSelect(flow);
    }
    return flow;
  }

  // Advances timers; returns sound cues ('ring') for main to play.
  function update(flow, dt) {
    const cues = [];
    const t0 = flow.stateT;
    flow.stateT += dt;
    if (flow.state === 'phoneCall') {
      for (let k = 0; k * RING_EVERY < RING; k++) {
        const at = k * RING_EVERY;
        if ((t0 === 0 && at === 0) || (at > t0 && at <= flow.stateT)) cues.push('ring');
      }
      if (!ringing(flow)) HW.phonecall.update(flow.phone, Math.min(dt, flow.stateT - RING));
    }
    return cues;
  }

  HW.flow = { MASK_IDS, RING, create, handle, update, levelList, maskList, ringing };
})(globalThis.HW);
