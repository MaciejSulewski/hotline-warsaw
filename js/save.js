(function (HW) {
  'use strict';

  const KEY = 'hotline-warsaw-save-v1';

  function defaults() {
    return { unlockedLevels: ['blok'], unlockedMasks: ['lajkonik'], bestScores: {} };
  }

  function isStringArray(v) {
    return Array.isArray(v) && v.every((x) => typeof x === 'string');
  }

  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  // Valid list, always led by the default entries (deduplicated).
  function withBase(list, base) {
    return base.concat(list.filter((x) => !base.includes(x)));
  }

  function load(storage) {
    const d = defaults();
    let raw;
    try {
      raw = storage ? storage.getItem(KEY) : null;
    } catch (e) {
      return d;
    }
    if (typeof raw !== 'string') return d;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return d;
    }
    if (!isPlainObject(parsed)) return d;
    if (isStringArray(parsed.unlockedLevels)) d.unlockedLevels = withBase(parsed.unlockedLevels, d.unlockedLevels);
    if (isStringArray(parsed.unlockedMasks)) d.unlockedMasks = withBase(parsed.unlockedMasks, d.unlockedMasks);
    if (isPlainObject(parsed.bestScores)) d.bestScores = parsed.bestScores;
    return d;
  }

  function store(storage, data) {
    try {
      storage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  function recordResult(data, levelId, total, grade) {
    const out = {
      unlockedLevels: data.unlockedLevels.slice(),
      unlockedMasks: data.unlockedMasks.slice(),
      bestScores: Object.assign({}, data.bestScores),
    };
    const prev = out.bestScores[levelId];
    if (!prev || typeof prev.score !== 'number' || total > prev.score) out.bestScores[levelId] = { score: total, grade: grade };

    const next = HW.masks.nextLevel(levelId);
    let newLevel = null;
    if (next && !out.unlockedLevels.includes(next)) {
      out.unlockedLevels.push(next);
      newLevel = next;
    }
    const newMasks = HW.masks.unlocksAfter(levelId, grade, out.unlockedMasks);
    out.unlockedMasks.push(...newMasks);
    return { data: out, newMasks: newMasks, newLevel: newLevel };
  }

  HW.save = { KEY: KEY, defaults: defaults, load: load, store: store, recordResult: recordResult };
})(globalThis.HW);
