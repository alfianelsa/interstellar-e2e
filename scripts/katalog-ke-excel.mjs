// Tulis testcases/katalog-regresi.xlsx dari semua katalog test read-only (tests/<app>/katalog/*.json).
// File ini HASIL GENERATE: jangan diedit di Excel. Ubah JSON katalognya lalu jalankan:
//
//   npm run katalog:excel
//
// Isinya: 1 baris = 1 test case, dengan langkah & hasil yang diharapkan dalam bahasa biasa,
// supaya QA bisa membaca apa saja yang sudah dites otomatis tanpa membuka kode.

import writeXlsxFile from 'write-excel-file/node';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'testcases', 'katalog-regresi.xlsx');
const APP = { warehouse: 'Warehouse', backoffice: 'Backoffice', 'content-management': 'Content Management', merchant: 'Merchant' };

const q = (s) => `"${s}"`;

function langkahDanHasil(k) {
  const buka = `1. Buka halaman ${q(k.url || '/')}`;
  switch (k.jenis) {
    case 'halaman':
      return [
        buka,
        [
          ...(k.teks || []).map((t) => `- Tampil teks ${q(t)}`),
          ...(k.tombol?.length ? [`- Ada tombol ${k.tombol.map(q).join(', ')}`] : []),
          ...(k.kolom?.length ? [`- Tabel punya kolom ${k.kolom.map(q).join(', ')}`] : []),
          ...(k.tidakAda || []).map((t) => `- TIDAK tampil ${q(t)}`),
          '- Tidak ada API yang error (5xx)',
        ].join('\n'),
      ];
    case 'tab':
      return [
        [buka, ...k.tab.map((t, i) => `${i + 2}. Klik ${q(t.nama)}`)].join('\n'),
        k.tab.map((t) => `- Setelah klik ${q(t.nama)}, URL berisi ${q(t.url.replace(/\$$/, ''))}`).join('\n'),
      ];
    case 'cari':
      return [
        [buka, `2. Ketik kata acak yang tidak ada di data di kotak "Search"`].join('\n'),
        ['- API pencarian membalas 200', '- Tabel tidak menampilkan baris data'].join('\n'),
      ];
    case 'detail':
      return [
        [buka, `2. ${k.buka === 'aksi' ? 'Klik tombol aksi (ikon) di baris pertama' : 'Klik baris pertama'}`, ...(k.tab || []).map((t, i) => `${i + 3}. Klik tab ${q(t)}`)].join('\n'),
        [
          k.urlDetail ? '- Halaman detail terbuka' : '- Panel detail terbuka di kanan',
          '- API detail membalas 200',
          ...k.teks.map((t) => `- Tampil ${q(t)}`),
          ...(k.tab || []).map((t) => `- Tab ${q(t)} terbuka tanpa error`),
          '- Tidak ada API yang error (4xx/5xx)',
        ].join('\n'),
      ];
    case 'export':
      return [
        [buka, `2. Klik ${q(k.tombol || 'Export')}`].join('\n'),
        [`- File ter-download dengan nama ${q(k.file.replace(/^\^|\$$/g, '').replace(/\\/g, ''))}`, '- File berisi Excel yang valid (bukan pesan error)'].join('\n'),
      ];
    case 'halaman-berikut':
      return [
        [buka, '2. Klik "Next" di bawah tabel'].join('\n'),
        ['- API halaman 2 membalas 200', '- Tabel menampilkan data yang berbeda dari halaman 1'].join('\n'),
      ];
    case 'filter':
      return [
        [buka, '2. Klik "Filters" → "Add condition"', `3. Pilih field ${q(k.field)}, operator ${q(k.operator || 'is')}, nilai pertama di daftar`].join('\n'),
        [
          '- API daftar dengan filter membalas 200',
          ...(k.kolom ? [`- Semua baris hasil punya kolom ${q(k.kolom)} = nilai yang dipilih`] : []),
        ].join('\n'),
      ];
    case 'form':
      return [
        [
          buka,
          `2. Klik ${q(k.tombol)}`,
          ...(k.submitAda === false || k.submitNonaktif ? [] : [`3. Klik ${q(k.submit || 'Submit')} tanpa mengisi apa pun`]),
          `${k.submitAda === false || k.submitNonaktif ? 3 : 4}. Tutup form`,
        ].join('\n'),
        [
          `- Form ${q(k.judulForm)} terbuka`,
          ...(k.teks || []).map((t) => `- Ada field ${q(t)}`),
          ...(k.submitNonaktif ? [`- Tombol ${q(k.submit || 'Submit')} nonaktif`] : []),
          ...(k.submitAda === false ? ['- Belum ada tombol kirim selama form kosong'] : []),
          ...(k.validasi || []).map((v) => `- Muncul pesan ${q(v)}`),
          '- Tidak ada data yang tersimpan (request simpan diblokir test)',
          '- Form tertutup setelah ditutup',
        ].join('\n'),
      ];
  }
}

const header = ['ID', 'App', 'Modul', 'Judul Test Case', 'Jenis', 'Prioritas', 'Langkah', 'Hasil yang Diharapkan', 'Status', 'Catatan', 'File katalog']
  .map((value) => ({ value, fontWeight: 'bold', backgroundColor: '#DDEBF7', wrap: true }));
const rows = [header];

for (const app of Object.keys(APP)) {
  const dir = path.join(ROOT, 'tests', app, 'katalog');
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const { modul, kasus } = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const k of kasus) {
      const [langkah, hasil] = langkahDanHasil(k);
      const cell = (value) => ({ value: value ?? '', wrap: true, alignVertical: 'top' });
      rows.push([
        cell(`TC-${k.id}`), cell(APP[app]), cell(modul.split(' / ').slice(1).join(' / ') || modul), cell(k.judul), cell(k.jenis),
        cell(k.prioritas || ''), cell(langkah), cell(hasil),
        { ...cell(k.fixme ? 'Fixme (bug)' : 'Aktif di Jenkins'), ...(k.fixme ? { backgroundColor: '#FCE4D6' } : {}) },
        cell([k.fixme, k.catatan].filter(Boolean).join(' ')), cell(`tests/${app}/katalog/${f}`),
      ]);
    }
  }
}

await writeXlsxFile(rows, {
  filePath: OUT,
  sheet: 'Katalog Regresi',
  stickyRowsCount: 1,
  columns: [14, 14, 22, 44, 9, 9, 48, 60, 16, 40, 34].map((width) => ({ width })),
});
console.log(`✔ ${path.relative(ROOT, OUT)} — ${rows.length - 1} test case`);
