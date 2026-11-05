// Konversi test case Excel (testcases/*.xlsx) jadi spec markdown (specs/<modul>.md)
// yang dibaca AI generator. Cuma baris dengan "Otomasi?" = Ya yang dikonversi.
//
//   npm run import                  konversi semua file di testcases/
//   npm run import -- file.xlsx     konversi file tertentu
//   npm run import -- --check       validasi saja, tidak menulis file
//
// Kalau ada error, tidak ada file yang ditulis.

import readExcelFile from 'read-excel-file/node';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TESTCASE_DIR = path.join(ROOT, 'testcases');
const SPEC_DIR = path.join(ROOT, 'specs');
const SHEET = 'Test Case';
const MARKER = '<!-- AUTO-GENERATED oleh `npm run import`';

const COLS = {
  id: 'ID',
  modul: 'Modul',
  skenario: 'Skenario',
  judul: 'Judul Test Case',
  tipe: 'Tipe',
  prioritas: 'Prioritas',
  login: 'Perlu Login?',
  kondisi: 'Kondisi Awal',
  data: 'Data Test',
  langkah: 'Langkah',
  hasil: 'Hasil yang Diharapkan',
  otomasi: 'Otomasi?',
  catatan: 'Catatan',
};
const REQUIRED = ['id', 'modul', 'skenario', 'judul', 'tipe', 'prioritas', 'login', 'langkah', 'hasil', 'otomasi'];
const ALLOWED = {
  tipe: ['Positif', 'Negatif'],
  prioritas: ['P1', 'P2', 'P3', 'P4'],
  login: ['Ya', 'Tidak'],
  otomasi: ['Ya', 'Tidak', 'Nanti'],
};
// TC-<APP>-<MODUL>-<3 angka>, mis. TC-WH-INV-001 (segmen kode boleh lebih dari satu).
const ID_RE = /^TC-[A-Z0-9]+(-[A-Z0-9]+)*-\d{3}$/;
const VAGUE_RE = /\b(sesuai|berhasil|normal|dengan benar|cek data)\b/i;

// Placeholder data unik di Excel → helper di tests/helpers/data.ts.
const PLACEHOLDERS = {
  unik: '`{unik}` = `const u = unik()`',
  nik: '`{nik}` = `const nikBaru = nik()`',
  hp: '`{hp}` = `const hpBaru = hp()` (tanpa 0 di depan)',
};
const PLACEHOLDER_RE = /\{([^{}]*)\}/g;
const PLACEHOLDER_FIELDS = ['kondisi', 'data', 'langkah', 'hasil'];

function placeholdersIn(tc) {
  const found = new Set();
  for (const key of PLACEHOLDER_FIELDS) {
    for (const m of tc[key].matchAll(PLACEHOLDER_RE)) found.add(m[1].trim());
  }
  return found;
}

const errors = [];
const warnings = [];
const rel = (p) => path.relative(ROOT, p);

function text(v) {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).replace(/\r\n?/g, '\n').trim();
}

function lines(v) {
  return text(v).split('\n').map((l) => l.trim()).filter(Boolean);
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Modul ditulis "<App> / <Modul>", mis. "Warehouse / Inventory Management".
//   folder test: tests/warehouse/inventory-management/   spec: specs/warehouse-inventory-management.md
const bagianModul = (modul) => modul.split('/').map((x) => slug(x)).filter(Boolean);
const folderTest = (modul) => `tests/${bagianModul(modul).join('/')}/`;
const namaSpec = (modul) => `${bagianModul(modul).join('-')}.md`;
const appDari = (modul) => bagianModul(modul)[0];

function columnIndex(header) {
  const names = header.map((h) => text(h).replace(/\s*\*$/, ''));
  const idx = {};
  for (const [key, name] of Object.entries(COLS)) idx[key] = names.indexOf(name);
  return idx;
}

// Modul → kode ID dari sheet "Pilihan", buat cek prefix ID.
function moduleCodes(sheets) {
  const pilihan = sheets.find((s) => s.sheet === 'Pilihan');
  if (!pilihan) return new Map();
  const [header, ...rows] = pilihan.data;
  const m = header.map(text).indexOf('Modul');
  const k = header.map(text).indexOf('Kode ID');
  if (m < 0 || k < 0) return new Map();
  return new Map(rows.filter((r) => text(r[m]) && text(r[k])).map((r) => [text(r[m]), text(r[k])]));
}

async function readFile(file, seenIds) {
  const where = rel(file);
  const sheets = await readExcelFile(file);
  const sheet = sheets.find((s) => s.sheet === SHEET);
  if (!sheet) {
    errors.push(`${where}: sheet "${SHEET}" tidak ditemukan`);
    return { cases: [], skipped: 0 };
  }
  const codes = moduleCodes(sheets);
  const [header = [], ...rows] = sheet.data;
  const idx = columnIndex(header);
  const missingCols = REQUIRED.filter((k) => idx[k] < 0).map((k) => COLS[k]);
  if (missingCols.length) {
    errors.push(`${where}: kolom tidak ditemukan: ${missingCols.join(', ')}`);
    return { cases: [], skipped: 0 };
  }

  const cases = [];
  let skipped = 0;
  rows.forEach((row, i) => {
    const at = `${where} baris ${i + 2}`;
    const get = (key) => (idx[key] < 0 ? '' : text(row[idx[key]]));
    if (row.every((c) => text(c) === '')) return;

    const id = get('id');
    if (!id) return errors.push(`${at}: ID kosong`);
    if (!ID_RE.test(id)) errors.push(`${at}: ID "${id}" salah format (contoh: TC-WH-INV-001)`);
    if (seenIds.has(id)) errors.push(`${at}: ID ${id} dobel (sudah dipakai di ${seenIds.get(id)})`);
    seenIds.set(id, at);

    const otomasi = get('otomasi');
    if (otomasi && !ALLOWED.otomasi.includes(otomasi)) {
      return errors.push(`${id} (${at}): "Otomasi?" harus salah satu dari ${ALLOWED.otomasi.join('/')}`);
    }
    if (otomasi !== 'Ya') {
      skipped++;
      return;
    }

    const tc = Object.fromEntries(Object.keys(COLS).map((k) => [k, get(k)]));
    const empty = REQUIRED.filter((k) => !tc[k]).map((k) => COLS[k]);
    if (empty.length) errors.push(`${id} (${at}): wajib diisi: ${empty.join(', ')}`);
    for (const [key, allowed] of Object.entries(ALLOWED)) {
      if (tc[key] && !allowed.includes(tc[key])) {
        errors.push(`${id} (${at}): "${COLS[key]}" = "${tc[key]}", harus salah satu dari ${allowed.join('/')}`);
      }
    }
    const code = codes.get(tc.modul);
    if (code && !id.startsWith(`TC-${code}-`)) {
      warnings.push(`${id}: modul ${tc.modul} biasanya pakai ID TC-${code}-xxx`);
    }
    const unknown = [...placeholdersIn(tc)].filter((p) => !(p in PLACEHOLDERS));
    if (unknown.length) {
      errors.push(`${id} (${at}): placeholder tidak dikenal {${unknown.join('}, {')}}. Yang bisa dipakai: {unik}, {nik}, {hp}`);
    }
    const vague = lines(tc.hasil).filter((l) => VAGUE_RE.test(l));
    if (vague.length) {
      warnings.push(`${id}: hasil kurang konkret, susah dicek otomatis: "${vague[0]}"`);
    }
    cases.push(tc);
  });
  return { cases, skipped };
}

function renderSpec(modul, cases, sources) {
  const dir = folderTest(modul);
  const app = appDari(modul);
  const out = [
    `${MARKER} dari ${sources.join(', ')}. Jangan edit file ini; ubah Excel-nya lalu jalankan ulang. -->`,
    `# ${modul}`,
    '',
    `Simpan file test di folder \`${dir}\`. Judul test = judul skenario lengkap dengan ID-nya (mis. "${cases[0].id} ${cases[0].judul}").`,
    '',
  ];
  const groups = new Map();
  for (const tc of cases) {
    if (!groups.has(tc.skenario)) groups.set(tc.skenario, []);
    groups.get(tc.skenario).push(tc);
  }
  let g = 0;
  for (const [skenario, list] of groups) {
    g++;
    out.push(`### ${g}. ${skenario}`, `**Seed:** \`tests/${app}/seed.spec.ts\``, '');
    list.forEach((tc, t) => {
      out.push(`#### ${g}.${t + 1} ${tc.id} ${tc.judul}`);
      out.push(`- **Tipe / prioritas:** ${tc.tipe} · ${tc.prioritas}`);
      out.push(
        tc.login === 'Ya'
          ? `- **Kondisi awal:** sudah login sebagai akun QA (sesi dari \`tests/${app}/auth.setup.ts\`).`
          : '- **Kondisi awal:** BELUM login. Test harus mulai tanpa sesi: `test.use({ storageState: { cookies: [], origins: [] } })`.',
      );
      for (const l of lines(tc.kondisi)) out.push(`- **Kondisi awal:** ${l}`);
      const used = Object.keys(PLACEHOLDERS).filter((p) => placeholdersIn(tc).has(p));
      if (used.length) {
        out.push(
          `- **Data unik (beda tiap run):** ${used.map((p) => PLACEHOLDERS[p]).join(', ')}, ` +
            'dari `tests/helpers/data.ts`. Buat sekali di awal test; semua placeholder yang sama di test ini pakai nilai yang sama.',
        );
      }
      if (tc.catatan) out.push(`- **Catatan:** ${lines(tc.catatan).join(' ')}`);
      out.push('');
      const data = lines(tc.data);
      if (data.length) out.push('**Data test:**', ...data.map((l) => `- ${l.replace(/^[-•*]\s*/, '')}`), '');
      out.push('**Steps:**', ...lines(tc.langkah).map((l, n) => `${n + 1}. ${l.replace(/^\d+[.)]\s*/, '')}`), '');
      out.push('**Expected Results:**', ...lines(tc.hasil).map((l) => `- ${l.replace(/^[-•*]\s*/, '')}`), '');
    });
  }
  return out.join('\n');
}

async function main() {
  console.log(`📁 Repo: ${ROOT}`);
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const named = args.filter((a) => !a.startsWith('--')).map((f) => path.resolve(f));
  const files = named.length
    ? named
    : fs.readdirSync(TESTCASE_DIR)
        // katalog-*.xlsx = hasil generate `npm run katalog:excel` (bukan test case QA), dilewati.
        .filter((f) => f.endsWith('.xlsx') && !f.startsWith('~$') && !f.startsWith('katalog-'))
        .map((f) => path.join(TESTCASE_DIR, f));
  if (!files.length) {
    console.error('Tidak ada file .xlsx di testcases/');
    process.exit(1);
  }

  for (const file of files) {
    const st = fs.statSync(file);
    console.log(`📄 Sumber: ${rel(file)} (terakhir disimpan: ${st.mtime.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })})`);
  }
  console.log('ℹ  Import hanya menulis ulang specs/*.md — file tests/*.spec.ts tidak ikut berubah.\n');

  const seenIds = new Map();
  const byModul = new Map();
  let skipped = 0;
  for (const file of files) {
    const res = await readFile(file, seenIds);
    skipped += res.skipped;
    for (const tc of res.cases) {
      if (!byModul.has(tc.modul)) byModul.set(tc.modul, { cases: [], sources: new Set() });
      byModul.get(tc.modul).cases.push(tc);
      byModul.get(tc.modul).sources.add(rel(file));
    }
  }

  // Jangan timpa spec yang ditulis manual (tanpa marker).
  const outputs = new Map();
  for (const [modul, { cases, sources }] of byModul) {
    const target = path.join(SPEC_DIR, namaSpec(modul));
    if (fs.existsSync(target) && !fs.readFileSync(target, 'utf8').startsWith(MARKER)) {
      errors.push(`${rel(target)} sudah ada dan bukan hasil import (ditulis manual). Rename file itu dulu.`);
    }
    outputs.set(target, renderSpec(modul, cases, [...sources]));
  }

  for (const w of warnings) console.log(`⚠  ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`✖  ${e}`);
    console.error(`\n${errors.length} error. Tidak ada file yang ditulis.`);
    process.exit(1);
  }

  const stale = fs.readdirSync(SPEC_DIR)
    .map((f) => path.join(SPEC_DIR, f))
    .filter((f) => f.endsWith('.md') && !outputs.has(f) && fs.readFileSync(f, 'utf8').startsWith(MARKER));

  for (const [target, content] of outputs) {
    if (!checkOnly) fs.writeFileSync(target, content);
    const count = (content.match(/^#### /gm) || []).length;
    console.log(`${checkOnly ? '✔ (cek)' : '✔'} ${rel(target)} — ${count} test case`);
  }
  for (const f of stale) {
    if (!checkOnly) fs.unlinkSync(f);
    console.log(`${checkOnly ? '🗑 (cek)' : '🗑'} ${rel(f)} dihapus (modulnya sudah tidak ada test case Otomasi = Ya)`);
  }
  if (skipped) console.log(`⏭  ${skipped} test case dilewati (Otomasi? bukan Ya)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
