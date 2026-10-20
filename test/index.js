'use strict';
// Node >= 22 treats `node --test test/` as a module path; this entry makes that command work.
const fs = require('node:fs');
const path = require('node:path');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.test.js') ? [path.join(d, e.name)] : []);
for (const f of walk(__dirname)) require(f);
