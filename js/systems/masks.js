(function (HW) {
  'use strict';

  HW.masks = {
    lajkonik: { name: 'Lajkonik', perk: null },
    bolek: { name: 'Bolek', perk: 'knife' },
    lolek: { name: 'Lolek', perk: 'doorStun' },
    czapka: { name: 'Czapka milicjanta', perk: 'shield' },
    kleks: { name: 'Pan Kleks', perk: 'speed' },
  };

  HW.masks.levelOrder = ['blok', 'pewex', 'komenda'];

  const GRADES = ['F', 'D', 'C', 'B', 'A', 'A+'];
  const MASK_ORDER = ['lajkonik', 'bolek', 'lolek', 'czapka', 'kleks'];

  function atLeast(grade, min) {
    return GRADES.indexOf(grade) >= GRADES.indexOf(min);
  }

  HW.masks.nextLevel = function (levelId) {
    const i = HW.masks.levelOrder.indexOf(levelId);
    return i >= 0 && i + 1 < HW.masks.levelOrder.length ? HW.masks.levelOrder[i + 1] : null;
  };

  // Mask ids newly earned by finishing levelId with grade (table order, minus already unlocked).
  HW.masks.unlocksAfter = function (levelId, grade, unlocked) {
    const earned = new Set();
    if (levelId === 'blok') {
      earned.add('bolek');
      if (atLeast(grade, 'B')) earned.add('lolek');
    }
    if (levelId === 'pewex') earned.add('czapka');
    if (atLeast(grade, 'A')) earned.add('kleks');
    return MASK_ORDER.filter((id) => earned.has(id) && !unlocked.includes(id));
  };
})(globalThis.HW);
