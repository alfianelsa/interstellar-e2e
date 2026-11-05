// Mencatat setiap panggilan API Interstellar selama test (method, path, status, test mana) ke
// results/api-log.jsonl. Dipakai `npm run cakupan` untuk menghitung endpoint mana yang sudah / belum
// tersentuh test. File di-reset tiap awal run (tests/helpers/global-setup.ts).

import fs from 'node:fs';
import path from 'node:path';
import type { BrowserContext, TestInfo } from '@playwright/test';

export const FILE_LOG = path.resolve(__dirname, '../../results/api-log.jsonl');
const API = /\/(?:[a-z-]+-api|technician)\/v1\//;

export function catatApi(context: BrowserContext, testInfo: TestInfo, izinkan5xx: RegExp[] = []) {
  fs.mkdirSync(path.dirname(FILE_LOG), { recursive: true });
  const test = `${testInfo.project.name} › ${testInfo.title}`;
  context.on('requestfinished', async (req) => {
    if (!API.test(req.url())) return;
    const res = await req.response().catch(() => null);
    const status = res?.status() ?? 0;
    // 5xx yang memang sengaja dipicu test negatif (izinkan5xx) tidak dihitung sebagai error.
    const disengaja = status >= 500 && izinkan5xx.some((p) => p.test(req.url()));
    tulis({ method: req.method(), url: req.url(), status, disengaja, test });
  });
  context.on('requestfailed', (req) => {
    if (!API.test(req.url())) return;
    // Request tulis yang diblokir pengaman read-only juga tercatat (status 0, "diblokir").
    tulis({ method: req.method(), url: req.url(), status: 0, gagal: req.failure()?.errorText, test });
  });
}

/** Catat 1 panggilan API manual (untuk test API tanpa browser, mis. technician). */
export function catatPanggilan(method: string, url: string, status: number, testInfo: TestInfo) {
  tulis({ method, url, status, test: `${testInfo.project.name} › ${testInfo.title}` });
}

function tulis(baris: object) {
  try {
    fs.appendFileSync(FILE_LOG, JSON.stringify(baris) + '\n');
  } catch {
    // Pencatatan tidak boleh membuat test gagal.
  }
}
