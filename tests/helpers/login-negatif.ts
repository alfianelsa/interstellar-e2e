// Test halaman login yang sama untuk semua app ber-login (warehouse, backoffice, content-management, invoice).
// Semua test mulai TANPA sesi dan tidak pernah sampai OTP, jadi sesi auth.setup tidak terganggu.

import { test, expect } from './test';
import { isiFormLogin } from './login';

/** Daftarkan TC-<prefix>-LOGIN-001..003 untuk 1 app. */
export function daftarkanTestLogin(prefix: string) {
  test.describe('Login', () => {
    test.use({
      storageState: { cookies: [], origins: [] },
      // Login negatif memanggil POST /v1/auth/ (ditolak server, tidak mengubah data). Server membalas
      // penolakan itu dengan HTTP 500 (perilaku Request.error di be-core), jadi 500 di endpoint ini diizinkan.
      izinkanApi: [/\/v1\/auth\/?(\?.*)?$/],
      izinkan5xx: [/\/v1\/auth\/?(\?.*)?$/],
    });

    test.beforeEach(async ({ page }) => {
      await page.goto('login');
    });

    test(`TC-${prefix}-LOGIN-001 Halaman login tampil`, async ({ page }) => {
      await expect(page.getByText('Welcome back! Please enter your details.')).toBeVisible();
      await expect(page.getByPlaceholder('Enter your email')).toBeVisible();
      await expect(page.getByPlaceholder('Enter your password')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    });

    test(`TC-${prefix}-LOGIN-002 Muncul validasi submit data kosong`, async ({ page }) => {
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page.getByText('email is a required field')).toBeVisible();
      await expect(page.getByText('password is a required field')).toBeVisible();
      await expect(page).toHaveURL(/\/login$/);
    });

    test(`TC-${prefix}-LOGIN-003 Email tidak terdaftar ditolak`, async ({ page }) => {
      await isiFormLogin(page, 'e2e-tidak-terdaftar@example.com', 'Password123!');
      await expect(page.getByRole('alert').filter({ hasText: 'not registered' })).toBeVisible();
      await expect(page).toHaveURL(/\/login$/);
    });

    // TC-*-LOGIN-004 "Password salah ditolak" SENGAJA TIDAK diotomasi: tiap password salah menambah
    // users.login_attempt (1 counter untuk semua app, tidak di-reset oleh login sukses). 5x salah dalam
    // 60 menit → login_access=false → akun QA terkunci di SEMUA app sampai dibuka admin.
    // (be-core controller/auth.*.controller.js). Kejadian 2026-11-04: akun QA terkunci karena test ini.
  });
}
