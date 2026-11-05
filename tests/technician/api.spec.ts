// Test API aplikasi mobile technician (read-only: GET saja). Sumber endpoint & parameter:
// interstellar-be-technician/modules/*/…routes.js + pemanggilan di interstellar-mobile-technician/lib.
// ID: TC-TEC-<MODUL>-<NNN>.

import { test, expect } from '@playwright/test';
import { apiTechnician } from '../helpers/technician';
import { menungguDeploy } from '../helpers/api';

type Kasus = { id: string; judul: string; path: string; params?: Record<string, string>; tanpaData?: boolean };

/** Cek respons standar be-core: HTTP 200 + { status: 200, message: "Success", data }. */
async function cekSukses(r: { status: number; body: any; url: string }, opsi: { tanpaData?: boolean } = {}) {
  expect(r.status, `HTTP ${r.url}`).toBe(200);
  expect(r.body?.status, `body.status ${r.url}`).toBe(200);
  // Beberapa endpoint (mis. job-list) menaruh isi langsung di body, tanpa "data".
  if (!opsi.tanpaData) expect(r.body, `body.data ${r.url}`).toHaveProperty('data');
}

/** Ambil daftar dari data (array langsung, atau { data: [] } / { rows: [] }). */
function daftar(body: any): any[] {
  const d = body?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.rows)) return d.rows;
  return [];
}

const LIST: Kasus[] = [
  { id: 'TEC-AUTH-001', judul: 'Profil technician (auth/detail)', path: 'auth/detail' },
  { id: 'TEC-JOB-001', judul: 'Daftar ticket job', path: 'ticket-job' },
  { id: 'TEC-JOB-002', judul: 'Daftar ticket job yang di-pin', path: 'ticket-job/pinned' },
  { id: 'TEC-JOB-003', judul: 'Daftar root cause', path: 'ticket-job/root-list' },
  { id: 'TEC-JOB-004', judul: 'Daftar job', path: 'ticket-job/job-list', tanpaData: true },
  { id: 'TEC-JOB-005', judul: 'Filter job category', path: 'ticket-job/job-category-filter' },
  { id: 'TEC-JOB-006', judul: 'Filter customer', path: 'ticket-job/customer-list-filter' },
  { id: 'TEC-JOB-007', judul: 'Filter SLA status', path: 'ticket-job/sla-status-list-filter' },
  { id: 'TEC-JOB-008', judul: 'Checklist PM priority', path: 'ticket-job/checklist', params: { category: 'PM-priority' } },
  { id: 'TEC-JOB-009', judul: 'Daftar kondisi', path: 'ticket-job/condition-list' },
  { id: 'TEC-JOB-010', judul: 'Daftar peripheral', path: 'ticket-job/peripheral-list' },
  { id: 'TEC-TO-001', judul: 'Transfer order dikirim (sender)', path: 'transfer-order', params: { is_sender: 'true' } },
  { id: 'TEC-TO-002', judul: 'Transfer order diterima (receiver)', path: 'transfer-order', params: { is_sender: 'false' } },
  { id: 'TEC-INV-001', judul: 'Inventory di technician', path: 'inventory-management' },
  { id: 'TEC-INV-002', judul: 'Ringkasan inventory (show-index)', path: 'inventory-management/show-index' },
  { id: 'TEC-LOG-001', judul: 'Log error mobile', path: 'mobile-log-error' },
  { id: 'TEC-OPT-001', judul: 'Opsi inventory', path: 'option/inventory-list' },
  { id: 'TEC-OPT-002', judul: 'Opsi customer', path: 'option/customer-list' },
  { id: 'TEC-OPT-003', judul: 'Opsi kondisi', path: 'option/condition-list' },
];

test.describe('Technician (mobile API) / Daftar', () => {
  for (const k of LIST) {
    test(`TC-${k.id} ${k.judul}`, async ({}, testInfo) => {
      const api = await apiTechnician(testInfo);
      await cekSukses(await api.get(k.path, k.params), { tanpaData: k.tanpaData });
      await api.ctx.dispose();
    });
  }
});

const DETAIL_TIKET = [
  ['TEC-JOB-011', 'Detail ticket job', ':id/detail'],
  ['TEC-JOB-012', 'Detail ticket job (detail-ticket-job)', ':id/detail-ticket-job'],
  ['TEC-JOB-013', 'PIC ticket job', ':id/detail/pics'],
  ['TEC-JOB-015', 'Riwayat ticket job', ':id/ticket-history'],
  ['TEC-JOB-016', 'Detail riwayat ticket job', ':id/ticket-history-details'],
  ['TEC-JOB-017', 'Job category ticket job', ':id/job-category-list'],
  ['TEC-JOB-018', 'Detail root cause ticket job', ':id/detail-root-list'],
] as const;

test.describe('Technician (mobile API) / Detail ticket job', () => {
  for (const [id, judul, p] of DETAIL_TIKET) {
    test(`TC-${id} ${judul} (tiket pertama di daftar)`, async ({}, testInfo) => {
      const api = await apiTechnician(testInfo);
      const list = await api.get('ticket-job');
      await cekSukses(list);
      const tiket = daftar(list.body)[0];
      test.skip(!tiket, 'Akun QA tidak punya ticket job di dev');
      await cekSukses(await api.get(`ticket-job/${p.replace(':id', tiket.id)}`));
      await api.ctx.dispose();
    });
  }
});

test('TC-TEC-JOB-014 Detail interaksi (interaction-by) dari riwayat tiket pertama', async ({}, testInfo) => {
  // :id di endpoint ini = ID riwayat aksi tiket (ticket_action_histories), bukan ID tiket.
  const api = await apiTechnician(testInfo);
  const tiket = daftar((await api.get('ticket-job')).body)[0];
  test.skip(!tiket, 'Akun QA tidak punya ticket job di dev');
  const riwayat = await api.get(`ticket-job/${tiket.id}/ticket-history`);
  await cekSukses(riwayat);
  const aksi = JSON.stringify(riwayat.body.data).match(/"id":"([0-9a-f-]{36})"/)?.[1];
  test.skip(!aksi, 'Tiket pertama belum punya riwayat aksi');
  await cekSukses(await api.get(`ticket-job/${aksi}/detail/interaction-by`));
  await api.ctx.dispose();
});

const DETAIL_TO = [
  ['TEC-TO-003', 'Detail transfer order', ':id'],
  ['TEC-TO-004', 'Inventory transfer order', 'transfer-order-inventory-list/:id'],
  ['TEC-TO-005', 'Summary transfer order', 'summary-list/:id'],
  ['TEC-TO-006', 'Inventory hilang transfer order', 'inventory-miss-list/:id'],
] as const;

test.describe('Technician (mobile API) / Detail transfer order', () => {
  for (const [id, judul, p] of DETAIL_TO) {
    test(`TC-${id} ${judul} (TO pertama di daftar)`, async ({}, testInfo) => {
      const api = await apiTechnician(testInfo);
      let to: any;
      for (const is_sender of ['true', 'false']) {
        const list = await api.get('transfer-order', { is_sender });
        await cekSukses(list);
        to ??= daftar(list.body)[0];
      }
      test.skip(!to, 'Akun QA tidak punya transfer order di dev');
      await cekSukses(await api.get(`transfer-order/${p.replace(':id', to.id)}`));
      await api.ctx.dispose();
    });
  }
});

test.describe('Technician (mobile API) / Validasi parameter', () => {
  // Parameter wajib kosong harus ditolak 400 dengan pesan jelas, bukan crash 500.
  // Dulu 500 (ditemukan 2026-11-05), sudah diperbaiki di kode be-technician 2026-11-05.
  test('TC-TEC-VAL-001 Transfer order tanpa is_sender ditolak dengan pesan jelas', async ({}, testInfo) => {
    menungguDeploy('be-technician');
    const api = await apiTechnician(testInfo);
    const r = await api.get('transfer-order');
    expect(r.status).toBe(400);
    expect(r.body?.message).toContain('is_sender');
  });
  test('TC-TEC-VAL-002 Checklist tanpa category ditolak dengan pesan jelas', async ({}, testInfo) => {
    menungguDeploy('be-technician');
    const api = await apiTechnician(testInfo);
    const r = await api.get('ticket-job/checklist');
    expect(r.status).toBe(400);
    expect(r.body?.message).toContain('category');
  });
});

test.describe('Technician (mobile API) / Keamanan', () => {
  // Filter & search disisipkan mentah ke SQL (ditemukan 2026-11-05): payload ini dulu mengembalikan SEMUA tiket.
  test("TC-TEC-SEC-001 Filter job category berisi payload SQL injection tidak membocorkan data", async ({}, testInfo) => {
    menungguDeploy('be-technician');
    const api = await apiTechnician(testInfo);
    const r = await api.get('ticket-job', { 'job_category[0]': "zzE2E') OR ('1'='1" });
    await cekSukses(r);
    expect(daftar(r.body), 'payload diperlakukan sebagai nama kategori biasa → 0 tiket').toHaveLength(0);
  });
  test("TC-TEC-SEC-002 Filter customer berisi tanda kutip tidak membuat error", async ({}, testInfo) => {
    menungguDeploy('be-technician');
    const api = await apiTechnician(testInfo);
    const r = await api.get('ticket-job', { 'customer[0]': "zzE2E'kutip" });
    await cekSukses(r);
    expect(daftar(r.body)).toHaveLength(0);
  });
  test("TC-TEC-SEC-003 Search ticket job berisi payload SQL injection aman", async ({}, testInfo) => {
    menungguDeploy('be-technician');
    const api = await apiTechnician(testInfo);
    const r = await api.get('ticket-job', { search: "zzE2E' OR 'a' ILIKE 'a" });
    await cekSukses(r);
    expect(daftar(r.body)).toHaveLength(0);
  });
});
