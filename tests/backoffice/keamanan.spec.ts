// Test keamanan API backoffice (GET saja, read-only). Ditemukan 2026-11-05: kata pencarian disisipkan mentah
// ke SQL (search berisi ' → 500). Diperbaiki di kode 2026-11-05, test menunggu deploy (lihat menungguDeploy()).

import { test, expect } from '@playwright/test';
import { apiApp, daftar, menungguDeploy } from '../helpers/api';

const DAFTAR_SEARCH = [
  'ticket?page=1&status=view+all&tab=overview',
  'user-and-team/user?page=1&archive=0',
  'customer-hub/project?page=1&archive=0',
  'customer-hub/sla?page=1&archive=0',
  'customer-hub/merchant?page=1&archive=0',
  'setting/job-order-flow?page=1',
  'terminal?page=1&archive=0',
  'job-order-report?page=1&start_date=2026-01-01&end_date=2026-12-31',
];
// Payload injeksi untuk konteks ILIKE '%…%' (server menambah % di akhir): dulu mengembalikan SEMUA data.
const INPUT_BERBAHAYA = ["zzE2E'kutip", "zzE2E' OR 'a' ILIKE 'a"];

test.describe('Backoffice / Keamanan', () => {
  INPUT_BERBAHAYA.forEach((kata, i) => {
    test(`TC-BO-SEC-00${i + 1} Search berisi ${kata.includes('OR') ? 'payload SQL injection' : 'tanda kutip'} aman di semua daftar`, async ({}, testInfo) => {
      menungguDeploy('be-backoffice / be-core');
      const api = await apiApp('backoffice', testInfo);
      const gagal: string[] = [];
      // Backoffice membatasi 60 request/menit per token: daftar ini sengaja pendek.
      for (const p of DAFTAR_SEARCH) {
        const r = await api.get(`${p}&search=${encodeURIComponent(kata)}`);
        if (r.status !== 200 || daftar(r.body).length !== 0) gagal.push(`${r.status} ${daftar(r.body).length} baris  ${p}`);
      }
      await api.dispose();
      expect(gagal, `endpoint yang error / bocor untuk search ${JSON.stringify(kata)}`).toEqual([]);
    });
  });
});
