// Membaca semua route Express di repo backend Interstellar → daftar endpoint lengkap (method + path).
// Dipakai oleh scripts/cakupan-endpoint.mjs. Bisa juga dijalankan sendiri:
//   node scripts/daftar-endpoint.mjs            → ringkasan per backend
//   node scripts/daftar-endpoint.mjs --json     → semua endpoint (JSON)
//
// Repo backend dicari di folder parent (sejajar dengan interstellar-e2e). Ganti lewat INTERSTELLAR_DIR.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.INTERSTELLAR_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const BACKEND = [
  { repo: 'interstellar-be-warehouse', prefix: '/warehouse-api/v1', app: 'warehouse' },
  { repo: 'interstellar-be-backoffice', prefix: '/backoffice-api/v1', app: 'backoffice' },
  { repo: 'interstellar-be-content-management', prefix: '/content-management-api/v1', app: 'content-management' },
  { repo: 'interstellar-be-invoice', prefix: '/invoice-api/v1', app: 'invoice' },
  { repo: 'interstellar-be-technician', prefix: '/technician/v1', app: 'technician (mobile)' },
];

const METHOD = ['get', 'post', 'put', 'patch', 'delete'];

function buangKomentar(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

/** Isi argumen di dalam kurung yang dimulai di posisi `buka` (karakter "("). */
function argumen(src, buka) {
  let d = 0;
  let q = null;
  for (let i = buka; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '\\') i++;
      else if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') q = c;
    else if (c === '(') d++;
    else if (c === ')' && --d === 0) return src.slice(buka + 1, i);
  }
  return '';
}

function resolve(dari, req) {
  const base = path.resolve(path.dirname(dari), req);
  for (const p of [base, `${base}.js`, path.join(base, 'index.js')]) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return null;
}

function gabung(...b) {
  return ('/' + b.join('/')).replace(/\/+/g, '/').replace(/(.)\/$/, '$1');
}

function bacaRouter(file, prefix, hasil, dilihat) {
  if (!file || dilihat.has(file + prefix)) return;
  dilihat.add(file + prefix);
  const src = buangKomentar(fs.readFileSync(file, 'utf8'));

  // const x = require('./a')  → supaya router.use('/a', x) bisa di-resolve
  const variabel = {};
  for (const m of src.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*['"`]([^'"`]+)['"`]\s*\)/g)) {
    variabel[m[1]] = m[2];
  }

  const re = /\b(?:router|route|app)\s*\.\s*(use|get|post|put|patch|delete)\s*\(/g;
  for (const m of src.matchAll(re)) {
    const args = argumen(src, m.index + m[0].length - 1);
    const lit = args.match(/^\s*(['"`])(.*?)\1/);
    const jenis = m[1];
    if (jenis === 'use') {
      if (!lit) continue; // router.use(auth) dsb.
      const req = args.match(/require\(\s*['"`]([^'"`]+)['"`]\s*\)/)?.[1];
      const id = req ? null : args.slice(lit[0].length).match(/^\s*,[\s\S]*?(\w+)\s*$/)?.[1];
      const target = req ?? (id && variabel[id]);
      if (target && target.startsWith('.')) bacaRouter(resolve(file, target), gabung(prefix, lit[2]), hasil, dilihat);
    } else if (METHOD.includes(jenis) && lit) {
      hasil.push({ method: jenis.toUpperCase(), path: gabung(prefix, lit[2]), file: path.relative(ROOT, file) });
    }
  }
}

export function daftarEndpoint() {
  const semua = [];
  for (const b of BACKEND) {
    const v1 = path.join(ROOT, b.repo, 'routes', 'v1.js');
    if (!fs.existsSync(v1)) {
      console.warn(`! ${b.repo} tidak ditemukan di ${ROOT} (lewati)`);
      continue;
    }
    const hasil = [];
    bacaRouter(v1, b.prefix, hasil, new Set());
    const unik = new Map();
    for (const e of hasil) unik.set(`${e.method} ${e.path}`, { ...e, app: b.app, repo: b.repo });
    semua.push(...unik.values());
  }
  return semua;
}

/** Ubah path Express ("/ticket/:id/detail") jadi regex untuk mencocokkan URL nyata. */
export function polaPath(p) {
  const esc = p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\\?\*/g, '.*').replace(/:\w+/g, '[^/]+');
  return new RegExp(`^${esc}/?$`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ep = daftarEndpoint();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(ep, null, 2));
  } else {
    const t = {};
    for (const e of ep) {
      t[e.repo] ??= { GET: 0, POST: 0, PUT: 0, PATCH: 0, DELETE: 0, total: 0 };
      t[e.repo][e.method]++;
      t[e.repo].total++;
    }
    console.table(t);
    console.log('Total endpoint:', ep.length);
  }
}
