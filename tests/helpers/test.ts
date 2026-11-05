// `test` khusus repo ini. Pakai ini (bukan dari '@playwright/test') di semua file test:
//   import { test, expect } from '../helpers/test';
//
// Pengaman READ-ONLY (otomatis di semua test):
//   Semua request ke API Interstellar (`*-api/v1/...`) selain GET DIBLOKIR, lalu di akhir test dicek:
//   kalau ada yang terblokir, test GAGAL. Jadi test tidak pernah menyimpan / mengubah / menghapus data
//   di dev, walaupun ada form yang ternyata lolos tanpa validasi (bug itu justru ketahuan).
//
//   Test yang memang perlu memanggil API tulis tertentu (mis. POST login untuk test login negatif)
//   mengizinkannya lewat:  test.use({ izinkanApi: [/\/v1\/auth\/?$/] });

import { test as dasar, expect } from '@playwright/test';
import { catatApi } from './catat-api';

type Opsi = {
  /** Pola URL API non-GET yang boleh lewat di test ini. Default: tidak ada. */
  izinkanApi: RegExp[];
  /**
   * Pola URL API yang boleh membalas 5xx di test ini. Backend Interstellar membalas SEMUA error untuk user
   * (mis. "password salah") dengan HTTP 500 (be-core helper/request.js `Request.error`), jadi test negatif
   * yang memang memicu error itu perlu mengizinkannya.
   */
  izinkan5xx: RegExp[];
};

type Fixture = {
  /** Daftar request tulis yang diblokir selama test (dicek otomatis di akhir test). */
  apiTulisTerblokir: string[];
  /** Respons API 5xx selama test (dicek otomatis di akhir test). */
  apiError5xx: string[];
  catatApiOtomatis: void;
};

const API_INTERSTELLAR = /-api\/v1\//;

export const test = dasar.extend<Opsi & Fixture>({
  izinkanApi: [[], { option: true }],
  izinkan5xx: [[], { option: true }],

  apiTulisTerblokir: [
    async ({ context, izinkanApi }, use, testInfo) => {
      const terblokir: string[] = [];
      await context.route(API_INTERSTELLAR, (route) => {
        const req = route.request();
        if (req.method() === 'GET' || izinkanApi.some((p) => p.test(req.url()))) return route.continue();
        terblokir.push(`${req.method()} ${req.url().replace(/^https?:\/\/[^/]+/, '')}`);
        return route.abort('blockedbyclient');
      });

      await use(terblokir);

      if (terblokir.length && testInfo.status === testInfo.expectedStatus) {
        testInfo.annotations.push({ type: 'api-tulis-terblokir', description: terblokir.join('\n') });
      }
      expect(
        terblokir,
        'Test read-only mencoba MENGUBAH data (request sudah diblokir, data aman). ' +
          'Kalau ini dari form tanpa validasi, itu bug aplikasi: tandai test.fixme() + laporkan.',
      ).toEqual([]);
    },
    { auto: true },
  ],

  // Catat semua panggilan API untuk laporan cakupan endpoint (npm run cakupan).
  catatApiOtomatis: [
    async ({ context, izinkan5xx }, use, testInfo) => {
      catatApi(context, testInfo, izinkan5xx);
      await use();
    },
    { auto: true },
  ],

  // Halaman bisa "tampil" padahal API-nya error (tabel kosong, angka hilang). Respons 5xx = test gagal.
  apiError5xx: [
    async ({ page, izinkan5xx }, use) => {
      const error: string[] = [];
      page.on('response', (r) => {
        if (r.status() >= 500 && API_INTERSTELLAR.test(r.url()) && !izinkan5xx.some((p) => p.test(r.url()))) {
          error.push(`${r.status()} ${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, '')}`);
        }
      });
      await use(error);
      expect(error, 'API mengembalikan error server (5xx). Kalau berulang, itu bug backend / dev sedang down.').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
