// Laporan cakupan endpoint: endpoint backend mana yang sudah dipanggil test (dari results/api-log.jsonl,
// hasil run Playwright terakhir) dibandingkan dengan semua route di repo backend (daftar-endpoint.mjs).
//
//   npx playwright test        # run test (log API otomatis tercatat)
//   npm run cakupan            # → ringkasan di terminal + results/cakupan-endpoint.xlsx
//
// Status per endpoint:
//   Dites OK      → dipanggil test dan membalas < 500
//   Dites ERROR   → dipanggil test dan membalas 5xx (bug / dev down)
//   Diblokir      → test memicu request tulis tapi diblokir pengaman read-only (validasi form bocor)
//   Belum dites   → tidak pernah dipanggil test

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import writeXlsxFile from 'write-excel-file/node';
import { daftarEndpoint, polaPath } from './daftar-endpoint.mjs';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOG = path.join(DIR, 'results/api-log.jsonl');
const OUT = path.join(DIR, 'results/cakupan-endpoint.xlsx');

if (!fs.existsSync(LOG)) {
  console.error('results/api-log.jsonl belum ada. Jalankan test dulu: npx playwright test');
  process.exit(1);
}

const endpoint = daftarEndpoint().map((e) => ({
  ...e,
  re: polaPath(e.path),
  // Route spesifik ("/ticket/export") dicocokkan duluan sebelum route ber-parameter ("/ticket/:id").
  skor: (e.path.match(/:\w+/g) || []).length * 100 - e.path.split('/').length,
  panggilan: 0,
  status: new Set(),
  test: new Set(),
}));
const urut = [...endpoint].sort((a, b) => a.skor - b.skor);

const tidakDikenal = new Map();
for (const baris of fs.readFileSync(LOG, 'utf8').split('\n')) {
  if (!baris.trim()) continue;
  const l = JSON.parse(baris);
  const p = decodeURIComponent(new URL(l.url).pathname);
  const e = urut.find((x) => x.method === l.method && x.re.test(p));
  if (!e) {
    tidakDikenal.set(`${l.method} ${p}`, (tidakDikenal.get(`${l.method} ${p}`) || 0) + 1);
    continue;
  }
  e.panggilan++;
  e.status.add(l.disengaja ? `${l.status} (disengaja)` : l.status);
  e.test.add(l.test);
}

function statusEp(e) {
  if (!e.panggilan) return 'Belum dites';
  const s = [...e.status];
  if (s.some((x) => typeof x === 'number' && x >= 500)) return 'Dites ERROR';
  if (s.every((x) => x === 0)) return 'Diblokir';
  return 'Dites OK';
}

// Ringkasan per backend
const ringkas = {};
for (const e of endpoint) {
  const r = (ringkas[e.app] ??= { total: 0, GET: 0, 'GET dites': 0, tulis: 0, 'tulis dites': 0, error: 0 });
  r.total++;
  const st = statusEp(e);
  if (e.method === 'GET') {
    r.GET++;
    if (st !== 'Belum dites') r['GET dites']++;
  } else {
    r.tulis++;
    if (st === 'Dites OK' || st === 'Dites ERROR') r['tulis dites']++;
  }
  if (st === 'Dites ERROR') r.error++;
}
for (const r of Object.values(ringkas)) {
  r['% GET'] = `${Math.round((100 * r['GET dites']) / r.GET)}%`;
  r['% total'] = `${Math.round((100 * (r['GET dites'] + r['tulis dites'])) / r.total)}%`;
}
console.table(ringkas);

const dites = endpoint.filter((e) => ['Dites OK', 'Dites ERROR'].includes(statusEp(e))).length;
console.log(`Total: ${dites} / ${endpoint.length} endpoint dipanggil test (${Math.round((100 * dites) / endpoint.length)}%).`);
const err = endpoint.filter((e) => statusEp(e) === 'Dites ERROR');
if (err.length) console.log('Endpoint 5xx:\n' + err.map((e) => `  ${e.method} ${e.path}`).join('\n'));
if (tidakDikenal.size) {
  console.log(`\n${tidakDikenal.size} URL dipanggil FE tapi tidak ada route-nya di repo backend (route dinamis / repo beda versi dengan dev):`);
  for (const [k] of [...tidakDikenal].slice(0, 15)) console.log('  ' + k);
}

// Excel
const kolom = ['App', 'Method', 'Endpoint', 'Status', 'Jumlah panggilan', 'HTTP status', 'Dites oleh', 'File route'];
const header = kolom.map((k) => ({ value: k, fontWeight: 'bold', backgroundColor: '#D9E1F2' }));
const warna = { 'Dites OK': '#E2EFDA', 'Dites ERROR': '#F8CBAD', Diblokir: '#FFF2CC', 'Belum dites': undefined };
const rows = [
  header,
  ...endpoint.map((e) => {
    const st = statusEp(e);
    return [
      e.app,
      e.method,
      e.path,
      st,
      e.panggilan,
      [...e.status].sort().join(', '),
      [...e.test].slice(0, 5).join('\n') + (e.test.size > 5 ? `\n(+${e.test.size - 5} test lain)` : ''),
      e.file,
    ].map((v, i) => ({ value: v, type: i === 4 ? Number : String, backgroundColor: i === 3 ? warna[st] : undefined, wrap: i === 6 }));
  }),
];
await writeXlsxFile(rows, {
  filePath: OUT,
  sheet: 'Cakupan Endpoint',
  columns: [{ width: 20 }, { width: 9 }, { width: 70 }, { width: 14 }, { width: 10 }, { width: 12 }, { width: 70 }, { width: 70 }],
  stickyRowsCount: 1,
});
console.log(`\nDetail per endpoint: ${path.relative(DIR, OUT)}`);
