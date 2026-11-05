import { defineConfig, devices, type Project } from '@playwright/test';
import dotenv from 'dotenv';
import { APPS, fileSesi, urlApp, type NamaApp } from './tests/helpers/apps';

dotenv.config({ quiet: true });

const CI = !!process.env.CI;

// Opsional (lokal saja): PW_CHANNEL=chrome pakai Google Chrome yang terpasang di laptop, untuk OS yang
// tidak didukung Chromium bawaan Playwright (mis. macOS 13). Di Jenkins biarkan kosong.
const channel = process.env.PW_CHANNEL || undefined;

// Opsional (lokal saja): SLOW_MO=500 memberi jeda 500 ms di tiap aksi, supaya --headed enak ditonton.
const slowMo = Number(process.env.SLOW_MO) || 0;

const browser = { ...devices['Desktop Chrome'], channel };

// 1 app = 1 project, plus project "setup-<app>" (login + OTP) untuk app yang butuh login.
//   npx playwright test --project=warehouse      → login warehouse + test warehouse saja
//   npx playwright test --project=backoffice     → login backoffice + test backoffice saja
//   npx playwright test --project=lintas-app     → test yang melibatkan >1 app
// Tiap app dites di folder tests/<app>/. baseURL selalu diakhiri "/", jadi test memanggil
// page.goto('halaman') TANPA "/" di depan; page.goto('/halaman') akan membuang path app.
function projectApp(app: NamaApp): Project[] {
  const baseURL = urlApp(app);
  if (!APPS[app].perluLogin) {
    return [{ name: app, testDir: `./tests/${app}`, use: { ...browser, baseURL } }];
  }
  return [
    {
      name: `setup-${app}`,
      testDir: `./tests/${app}`,
      testMatch: /auth\.setup\.ts/,
      timeout: 180_000,
      use: { ...browser, baseURL },
    },
    {
      name: app,
      testDir: `./tests/${app}`,
      testIgnore: /auth\.setup\.ts/,
      use: { ...browser, baseURL, storageState: fileSesi(app) },
      dependencies: [`setup-${app}`],
    },
  ];
}

export default defineConfig({
  globalSetup: './tests/helpers/global-setup.ts',
  testDir: './tests',
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  // 1 worker: akun QA cuma boleh 1 sesi per app (token ditimpa tiap login), semua test 1 app
  // berbagi sesi dari setup-nya, dan OTP beberapa app dibaca dari 1 inbox.
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: CI
    ? [['list'], ['junit', { outputFile: 'results/junit.xml' }], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    launchOptions: { slowMo },
    timezoneId: 'Asia/Jakarta',
    // Batas tiap aksi (klik, isi). Tanpa ini aksi yang macet baru gagal saat test timeout.
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Video butuh ffmpeg Playwright, yang juga tidak tersedia di OS lama; trace tetap merekam layar.
    video: channel ? 'off' : 'retain-on-failure',
  },
  projects: [
    ...projectApp('warehouse'),
    ...projectApp('backoffice'),
    ...projectApp('content-management'),
    ...projectApp('merchant'),
    // Invoice (/reconcile) di dev saat ini tidak merender apa pun (lihat tests/invoice/), jadi belum ada
    // setup login. Kalau app sudah normal, ganti baris ini dengan ...projectApp('invoice').
    { name: 'invoice', testDir: './tests/invoice', use: { ...browser, baseURL: urlApp('invoice') } },
    // API aplikasi mobile technician (Flutter tidak bisa dijalankan Playwright → tes API-nya langsung).
    { name: 'setup-technician', testDir: './tests/technician', testMatch: /auth\.setup\.ts/, timeout: 180_000 },
    { name: 'technician', testDir: './tests/technician', testIgnore: /auth\.setup\.ts/, dependencies: ['setup-technician'] },
    {
      // Test lintas app membuka beberapa browser context sendiri (lihat tests/helpers/lintas-app.ts).
      name: 'lintas-app',
      testDir: './tests/lintas-app',
      use: browser,
      dependencies: ['setup-backoffice', 'setup-warehouse'],
    },
  ],
});
