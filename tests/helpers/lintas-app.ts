// Helper test lintas app: membuka beberapa app Interstellar dalam 1 test, masing-masing dengan sesi
// login-nya sendiri (.auth/<app>.json dari project setup-<app>). Pengaman read-only tetap berlaku.

import { type Browser, type Page } from '@playwright/test';
import { expect, test } from './test';
import { catatApi } from './catat-api';
import { fileSesi, urlApp, type NamaApp } from './apps';

const API_INTERSTELLAR = /-api\/v1\//;

export type HalamanApp = { page: Page; tulisTerblokir: string[]; tutup: () => Promise<void> };

/** Buka 1 app di browser context baru (sesi login app itu, request tulis diblokir). */
export async function bukaApp(browser: Browser, app: NamaApp): Promise<HalamanApp> {
  const context = await browser.newContext({ baseURL: urlApp(app), storageState: fileSesi(app) });
  catatApi(context, test.info());
  const tulisTerblokir: string[] = [];
  await context.route(API_INTERSTELLAR, (route) => {
    if (route.request().method() === 'GET') return route.continue();
    tulisTerblokir.push(`${app}: ${route.request().method()} ${route.request().url()}`);
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  return {
    page,
    tulisTerblokir,
    tutup: async () => {
      expect(tulisTerblokir, 'test lintas app mencoba mengubah data (sudah diblokir)').toEqual([]);
      await context.close();
    },
  };
}

/** Teks sel pertama di baris data pertama tabel (mis. Ticket ID, nama warehouse). */
export async function selPertama(page: Page): Promise<string> {
  const sel = page.getByRole('row').filter({ has: page.getByRole('cell') }).first().getByRole('cell').first();
  await expect(sel).toBeVisible();
  return (await sel.innerText()).trim().split('\n')[0].trim();
}

/** Ketik di kotak Search lalu tunggu API daftar membalas hasil pencarian itu. */
export async function cari(page: Page, kata: string) {
  const kotak = page.getByRole('textbox', { name: 'Search' }).first();
  await page.waitForLoadState('networkidle');
  const respons = page.waitForResponse(
    // Bandingkan parameter yang sudah di-decode: spasi bisa dikirim sebagai "+" atau "%20".
    (r) => r.request().method() === 'GET' && API_INTERSTELLAR.test(r.url()) && new URL(r.url()).searchParams.get('search') === kata,
  );
  await kotak.fill(kata);
  expect((await respons).status()).toBe(200);
}
