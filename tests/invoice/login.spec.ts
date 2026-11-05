// App invoice (/reconcile). Saat ini di dev tidak merender apa pun: <div id="root"> kosong, tanpa error
// di console (bundle JS ter-load). Karena itu belum ada setup login / test fitur invoice.
// Kalau app sudah normal: hapus fixme di bawah, ganti project invoice di playwright.config.ts dengan
// ...projectApp('invoice'), tambah tests/invoice/auth.setup.ts + katalog seperti app lain.
import { test, expect } from '../helpers/test';

test.describe('Login', () => {
  test('TC-INV-LOGIN-001 Halaman login invoice tampil', async ({ page }) => {
    test.fixme(true, 'BUG/DEPLOY: /reconcile/login di dev kosong (#root tidak dirender, tanpa error console). Ditemukan 2026-11-04.');
    await page.goto('login');
    await expect(page.getByText('Welcome back! Please enter your details.')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your email')).toBeVisible();
  });
});
