// Pembuat test "setup" login per app. Tiap tests/<app>/auth.setup.ts cukup memanggil buatAuthSetup('<app>').
// Sesi disimpan ke .auth/<app>.json lalu dipakai semua test app itu.
//
// Token sesi disimpan per app di database (token_warehouse, token_backoffice, ...), jadi akun QA
// bisa login di beberapa app sekaligus. Tapi login ulang di app YANG SAMA menendang sesi sebelumnya.

import { test as setup } from '@playwright/test';
import { login } from './login';
import { catatApi } from './catat-api';
import { fileSesi, type NamaApp } from './apps';

// Lama diam di halaman Welcome setelah login, cuma saat --headed (lokal, ada yang menonton).
// Ubah lewat env JEDA_WELCOME_DETIK (0 = tanpa jeda). Tanpa --headed / di CI tidak ada jeda.
const JEDA_WELCOME_DETIK = Number(process.env.JEDA_WELCOME_DETIK ?? 5);

export function buatAuthSetup(app: NamaApp) {
  setup(`login akun QA (${app})`, async ({ page, headless }, testInfo) => {
    catatApi(page.context(), testInfo);
    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;
    if (!email || !password) {
      throw new Error('E2E_EMAIL / E2E_PASSWORD belum diisi. Copy .env.example jadi .env lalu isi.');
    }

    await login(page, email, password);
    await page.context().storageState({ path: fileSesi(app) });

    if (!headless && !process.env.CI && JEDA_WELCOME_DETIK > 0) {
      // Sengaja pakai jeda tetap: ini bukan menunggu kondisi, cuma memberi waktu QA melihat halaman.
      await page.waitForTimeout(JEDA_WELCOME_DETIK * 1000);
    }
  });
}
