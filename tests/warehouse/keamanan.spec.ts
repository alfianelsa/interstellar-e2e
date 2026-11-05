// Test keamanan & export API warehouse (GET saja, read-only). Ditemukan 2026-11-05:
//  - SQL injection: kata pencarian disisipkan mentah ke SQL (search berisi ' → 500, payload OR '1'='1 bocor).
//  - Report warehouse bisa diakses TANPA login (router.use(auth) dipasang di tengah reporting.routes.js).
//  - Export Population tidak ada; export Stock Thermal judul & isi kolom bergeser.
// Semua sudah diperbaiki di kode backend (2026-11-05). Test ditandai fixme sampai perbaikan ter-deploy ke dev.
// Setelah deploy: hapus pemanggilan menungguDeploy() supaya test berjalan tiap malam.
// Cek lebih awal (mis. ke server lokal / setelah deploy): E2E_CEK_PERBAIKAN=1 npx playwright test ... --no-deps

import readExcelFile from 'read-excel-file/node';
import { test, expect } from '@playwright/test';
import { apiApp, daftar, menungguDeploy } from '../helpers/api';

// Endpoint list yang punya Search. Kata yang mustahil ada di data + tanda kutip / payload injeksi.
const DAFTAR_SEARCH = [
  'inventory-management/terminal?page=1&archive=0',
  'inventory-management/sim-card?page=1&archive=0',
  'inventory-management/sam-card?page=1&archive=0',
  'inventory-management/peripheral?page=1&archive=0',
  'inventory-management/thermal?page=1&archive=0',
  'inventory-management/terminal/part-number?page=1&archive=0',
  'user-and-team/user?page=1&archive=0',
  'ticket?page=1&status=view+all&tab=overview',
  'approval?page=1&page_detail=1&archive=0&category=&status=view+all&detailTab=terminal',
  'reporting/movement/terminal?page=1&type=terminal',
  'stock-adjustment?page=1&page_detail=1&type=view+all&archive=0&detailTab=terminal',
  'stock-opname?page=1',
  'setting/warehouse?page=1&archive=0',
];
// Payload injeksi untuk konteks ILIKE '%…%' (server menambah % di akhir): dulu mengembalikan SEMUA data.
const INPUT_BERBAHAYA = ["zzE2E'kutip", "zzE2E' OR 'a' ILIKE 'a"];

test.describe('Warehouse / Keamanan', () => {
  for (const kata of INPUT_BERBAHAYA) {
    test(`TC-WH-SEC-00${INPUT_BERBAHAYA.indexOf(kata) + 1} Search berisi ${kata.includes('OR') ? 'payload SQL injection' : 'tanda kutip'} aman di semua daftar`, async ({}, testInfo) => {
      menungguDeploy('be-warehouse / be-core');
      const api = await apiApp('warehouse', testInfo);
      const gagal: string[] = [];
      for (const p of DAFTAR_SEARCH) {
        const r = await api.get(`${p}&search=${encodeURIComponent(kata)}`);
        // Aman = query tetap jalan (200) dan input diperlakukan sebagai teks biasa (tidak cocok data apa pun).
        if (r.status !== 200 || daftar(r.body).length !== 0) gagal.push(`${r.status} ${daftar(r.body).length} baris  ${p}`);
      }
      await api.dispose();
      expect(gagal, `endpoint yang error / bocor untuk search ${JSON.stringify(kata)}`).toEqual([]);
    });
  }

  test('TC-WH-SEC-003 Report warehouse menolak request tanpa login (401)', async ({}, testInfo) => {
    menungguDeploy('be-warehouse / be-core');
    const api = await apiApp('warehouse', testInfo, { tanpaToken: true });
    const report = [
      'reporting/population?page=1',
      'reporting/population/export',
      'reporting/movement/terminal?page=1&type=terminal',
      'reporting/movement/simcard?page=1&type=simcard',
      'reporting/movement/samcard?page=1&type=samcard',
      'reporting/movement/thermal?page=1&type=thermal',
      'reporting/stock/terminal?page=1&type=terminal',
      'reporting/stock/thermal?page=1&type=thermal',
      'reporting/in-out/warehouse/terminal?page=1&type=terminal',
      'reporting/in-out/technician/terminal?page=1&type=terminal',
      'reporting/stock-opname/terminal?page=1&type=terminal',
      'reporting/movement/terminal/export?type=terminal',
      'reporting/stock/terminal/export?type=terminal',
    ];
    const terbuka: string[] = [];
    for (const p of report) {
      const r = await api.get(p);
      if (r.status !== 401) terbuka.push(`${r.status} ${p}`);
    }
    await api.dispose();
    expect(terbuka, 'report yang bisa dibuka TANPA login').toEqual([]);
  });
});

test.describe('Warehouse / Report export', () => {
  /** Baca sheet pertama file Excel hasil export → baris (array of array). */
  async function bacaExcel(buffer: Buffer, sheet: string) {
    // read-excel-file v9: [{ sheet, data }, ...] per sheet; versi lama: langsung array baris.
    const hasil: any = await readExcelFile(buffer, { sheet });
    const satu = Array.isArray(hasil) && hasil[0]?.data ? hasil.find((x: any) => x.sheet === sheet) ?? hasil[0] : hasil;
    return (Array.isArray(satu) ? satu : satu.data) as unknown[][];
  }

  test('TC-WH-RPT-022 Export Population menghasilkan Excel sesuai data report', async ({}, testInfo) => {
    menungguDeploy('be-warehouse / be-core');
    const api = await apiApp('warehouse', testInfo);
    const list = await api.get('reporting/population?page=1');
    expect(list.status).toBe(200);
    const r = await api.get('reporting/population/export');
    expect(r.status, 'export population').toBe(200);
    expect(r.header['content-disposition'] ?? '').toContain('report-population.xlsx');
    const baris = await bacaExcel(r.buffer, 'Population');
    expect(baris[0]).toEqual([
      'Customer/Bank', 'Project', 'PM quantity', 'IS success quantity', 'WD success quantity', 'Active population', 'Inactive population',
    ]);
    expect(baris.length - 1, 'jumlah baris export = total di report').toBe(list.body.meta.total);
    await api.dispose();
  });

  test('TC-WH-RPT-023 Export Stock Thermal: judul & isi kolom sama dengan data report', async ({}, testInfo) => {
    menungguDeploy('be-warehouse / be-core');
    const api = await apiApp('warehouse', testInfo);
    const list = await api.get('reporting/stock/thermal?page=1&page_size=100&type=thermal');
    expect(list.status).toBe(200);
    const r = await api.get('reporting/stock/thermal/export?type=thermal');
    expect(r.status).toBe(200);
    const baris = await bacaExcel(r.buffer, 'Stock Thermal');
    const kolom: [string, string][] = [
      ['Customer/Bank', 'customer_name'], ['Project', 'project_name'], ['Normal stock WH', 'normal_stock_wh'],
      ['In transit', 'intransit'], ['Technician', 'on_technician'], ['OTS faktur', 'ots_facture'],
      ['Population', 'population'], ['Supply faktur', 'supply_faktur'], ['Inactive', 'inactive'], ['Lost', 'lost'],
    ];
    expect(baris[0], 'judul kolom export').toEqual(kolom.map(([j]) => j));
    const data = daftar(list.body);
    expect(baris.length - 1, 'jumlah baris export').toBe(data.length);
    data.forEach((row, i) => {
      const harapan = kolom.map(([, f], k) => (k < 2 ? row[f] ?? '' : Number(row[f]) || 0));
      const isi = baris[i + 1].map((v, k) => (k < 2 ? v ?? '' : Number(v) || 0));
      expect(isi, `baris ${i + 1} export = data report`).toEqual(harapan);
    });
    await api.dispose();
  });
});
