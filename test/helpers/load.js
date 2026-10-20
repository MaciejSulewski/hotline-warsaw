'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function scriptList() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const out = [];
  const re = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

function allJsFiles(dir) {
  const out = [];
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
      const r = rel + '/' + e.name;
      if (e.isDirectory()) walk(r);
      else if (e.name.endsWith('.js')) out.push(r);
    }
  };
  walk(dir);
  return out.sort();
}

// extraGlobals: optional host objects (e.g. DOM stubs) copied into the vm context before scripts run.
function loadHW(extraGlobals) {
  const context = { console };
  if (extraGlobals) Object.defineProperties(context, Object.getOwnPropertyDescriptors(extraGlobals)); // keeps getters live
  context.globalThis = context;
  vm.createContext(context);
  for (const src of scriptList()) {
    const code = fs.readFileSync(path.join(ROOT, src), 'utf8');
    vm.runInContext(code, context, { filename: src });
  }
  return context.HW;
}

module.exports = { ROOT, scriptList, allJsFiles, loadHW };
