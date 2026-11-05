// Helper test API langsung (tanpa browser) untuk app web, memakai sesi login yang sudah ada
// (.auth/<app>.json dari auth.setup.ts). Hanya untuk GET: test API di repo ini tetap read-only.

import fs from 'node:fs';
import { request, test, type TestInfo } from '@playwright/test';
import { HOST, fileSesi, type NamaApp } from './apps';
import { catatPanggilan } from './catat-api';

/** Prefix API backend tiap app. */
export const API_APP: Partial<Record<NamaApp, string>> = {
  warehouse: '/warehouse-api/v1/',
  backoffice: '/backoffice-api/v1/',
  'content-management': '/content-management-api/v1/',
};

/** Token JWT app dari file sesi (cookie tokenWarehouse / tokenBackoffice / ...). */
export function tokenDariSesi(app: NamaApp): string {
  const sesi = JSON.parse(fs.readFileSync(fileSesi(app), 'utf8'));
  const semua: { value: string }[] = [...sesi.cookies, ...sesi.origins.flatMap((o: any) => o.localStorage)];
  const token = semua.map((x) => x.value).find((v) => /^eyJ/.test(v));
  if (!token) throw new Error(`Token ${app} tidak ada di ${fileSesi(app)}. Jalankan setup-${app} dulu.`);
  return token;
}

export type Respons = { status: number; body: any; url: string; buffer: Buffer; header: Record<string, string> };

/** Klien GET ke API app. `tanpaToken: true` = request anonim (untuk cek endpoint wajib login). */
export async function apiApp(app: NamaApp, testInfo: TestInfo, opsi: { tanpaToken?: boolean } = {}) {
  const prefix = API_APP[app];
  if (!prefix) throw new Error(`API untuk app ${app} belum didaftarkan di API_APP`);
  const ctx = await request.newContext({
    baseURL: HOST + prefix,
    extraHTTPHeaders: opsi.tanpaToken ? {} : { authorization: `Bearer ${tokenDariSesi(app)}` },
  });
  return {
    async get(path: string): Promise<Respons> {
      const r = await ctx.get(path, { timeout: 60_000 });
      catatPanggilan('GET', r.url(), r.status(), testInfo);
      const buffer = await r.body();
      let body: any = null;
      try {
        body = JSON.parse(buffer.toString('utf8'));
      } catch {
        // bukan JSON (mis. file Excel)
      }
      return { status: r.status(), body, url: r.url(), buffer, header: r.headers() };
    },
    dispose: () => ctx.dispose(),
  };
}

/** Isi daftar dari respons standar be-core ({ data: [] } atau { data: { data: [] } }). */
export function daftar(body: any): any[] {
  const d = body?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  return [];
}

/**
 * Tandai test perbaikan bug yang sudah di-fix di kode tapi belum ter-deploy ke dev (test.fixme).
 * E2E_CEK_PERBAIKAN=1 → test tetap dijalankan (cek ke server lokal / tepat setelah deploy).
 */
export function menungguDeploy(repo: string) {
  test.fixme(!process.env.E2E_CEK_PERBAIKAN, `Diperbaiki di kode 2026-11-05 (${repo}), menunggu deploy ke dev. Hapus menungguDeploy() setelah deploy.`);
}
