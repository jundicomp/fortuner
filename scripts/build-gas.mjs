// Bundle src/server (logika yang sama dengan mode demo) menjadi apps-script/Code.gs.
import { build } from 'esbuild';
import fs from 'node:fs';
const fns = ['doPost', 'doGet', 'setup', 'backupSekarang', 'pasangTriggerBackup', 'onOpen'];
await build({
  entryPoints: ['src/server/gasEntry.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'FortunerServer',
  target: 'es2019',
  outfile: 'apps-script/Code.gs',
  banner: { js: '/* Fortuner POS — FILE HASIL BUILD, jangan diedit langsung. Sumber: src/server/*.ts (npm run build:gas) */' },
  footer: { js: '\n' + fns.map((f) => `function ${f}(e) { return FortunerServer.${f}(e); }`).join('\n') + '\n' },
  logLevel: 'warning',
});
fs.writeFileSync('apps-script/appsscript.json', JSON.stringify({
  timeZone: 'Asia/Jakarta',
  dependencies: {},
  exceptionLogging: 'STACKDRIVER',
  runtimeVersion: 'V8',
  webapp: { executeAs: 'USER_DEPLOYING', access: 'ANYONE_ANONYMOUS' },
}, null, 2) + '\n');
console.log('apps-script/Code.gs dibuat (' + Math.round(fs.statSync('apps-script/Code.gs').size / 1024) + ' KB)');
