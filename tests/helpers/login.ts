// Login app Interstellar lewat UI: email + password, lalu OTP 6 digit dari email.
// Form login & OTP sama di warehouse, backoffice, content-management, invoice.
// Dipakai tests/<app>/auth.setup.ts. Test biasa TIDAK perlu login ulang (pakai sesi dari setup).

import { expect, type Page } from '@playwright/test';
import { ambilOtp, tandaiInbox } from './email';

export async function isiFormLogin(page: Page, email: string, password: string) {
  await page.goto('login');
  await page.getByPlaceholder('Enter your email').fill(email);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** Isi 6 kotak OTP. Tiap kotak 1 digit dan fokus pindah otomatis ke kotak berikutnya. */
export async function isiOtp(page: Page, otp: string) {
  const kotak = page.locator('input[maxlength="1"]');
  await expect(kotak).toHaveCount(6);
  await kotak.first().click();
  await page.keyboard.type(otp);
  await page.getByRole('button', { name: 'Verify email' }).click();
}

/** Login penuh sampai halaman Welcome tampil. */
export async function login(page: Page, email: string, password: string) {
  // Catat sebelum memicu email, supaya OTP lama di inbox tidak terbaca.
  const sejak = new Date();
  const pakaiImap = !!process.env.E2E_IMAP_HOST || !!process.env.CI;
  const mulaiUid = pakaiImap ? await tandaiInbox() : 0;
  // API login dev kadang lambat (>10 detik); tunggu responsnya dulu supaya pesan gagalnya jelas.
  const responsLogin = page.waitForResponse(
    (r) => r.request().method() === 'POST' && /\/v1\/auth\/?(\?.*)?$/.test(r.url()),
    { timeout: 45_000 },
  );
  await isiFormLogin(page, email, password);
  const r = await responsLogin;
  const body = await r.json().catch(() => ({}));
  if (!r.ok() || !String(body?.data ?? body?.message ?? '').includes('OTP sent')) {
    throw new Error(`Login ditolak server (HTTP ${r.status()}): ${JSON.stringify(body?.message ?? body).slice(0, 200)}`);
  }
  await expect(page).toHaveURL(/check-otp-login/);
  await expect(page.getByText('Check your email')).toBeVisible();

  const welcome = page.getByText('Welcome!', { exact: true });

  if (!pakaiImap) {
    // Lokal tanpa IMAP: QA isi OTP sendiri di browser (jalankan dengan --headed). OTP berlaku 2,5 menit.
    console.log(`\n>>> E2E_IMAP_HOST kosong: buka email ${email}, ketik OTP di browser lalu klik "Verify email" (maks 150 detik).\n`);
    await expect(welcome).toBeVisible({ timeout: 150_000 });
  } else {
    const otp = await ambilOtp(email, sejak, { mulaiUid });
    await isiOtp(page, otp);
    // Setelah OTP benar, app menyimpan cookie token lalu membuka halaman Welcome.
    await expect(welcome).toBeVisible({ timeout: 20_000 });
  }

  // Lokal saja: PAUSE_AFTER_LOGIN=1 menahan browser di halaman Welcome sampai klik "Resume" di Inspector.
  if (process.env.PAUSE_AFTER_LOGIN && !process.env.CI) {
    await page.pause();
  }
}
