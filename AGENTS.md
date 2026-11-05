# Panduan Cursor untuk QA — interstellar-e2e

Repo ini: **E2E Playwright** untuk semua app web Interstellar (warehouse, backoffice, content-management, merchant, lintas app) di `https://interstellar.kalachakra.io`.
Buka folder **`interstellar-e2e`** di **Cursor** (bukan folder parent `Interstellar/`), supaya aturan AI ikut terbaca.

## Setup sekali

1. **Node.js 20+**, **Git**, **Cursor** terbaru. Extension **Playwright Test for VS Code** (opsional).
2. Terminal:
   ```bash
   cd interstellar-e2e
   npm ci
   npx playwright install chromium   # macOS 13: gagal → isi PW_CHANNEL=chrome di .env
   cp .env.example .env
   ```
3. Isi `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_IMAP_*` (minta ke dev). **Jangan commit `.env`.**
4. Cek: `npx playwright test` hijau.

> **Penting:** akun QA cuma boleh **1 sesi per app**. Jangan login manual pakai akun ini saat test jalan (termasuk Jenkins ±01:00 WIB).

## Dua jenis test di repo ini

| Jenis | Di mana | Kapan dipakai |
|---|---|---|
| **Katalog read-only** | `tests/<app>/katalog/<modul>.json` | Halaman tampil, pindah tab, cari, form "New …" menolak data kosong. Tambah 1 objek JSON = 1 test, tanpa kode. Daftar lengkapnya: `testcases/katalog-regresi.xlsx`. |
| **Test skenario** | `tests/<app>/<modul>/*.spec.ts` | Alur yang lebih dari sekadar tampil (filter tertentu, detail data, alur bisnis). Ditulis dari Excel QA → spec → AI. |

Jangan menulis ulang test katalog di Excel QA. Cek dulu `katalog-regresi.xlsx`.

## Alur kerja QA (Excel → spec → test)

| Langkah | QA | Cursor |
|--------|-----|--------|
| 1 | Tulis test case di `testcases/interstellar-testcases.xlsx`, **Otomasi? = Ya**, Modul `<App> / <Modul>` | — |
| 2 | `npm run import` → `specs/<app>-<modul>.md` | Kalau import error, paste error ke chat |
| 3 | — | **Generate test** (prompt di bawah) |
| 4 | `npx playwright test tests/<app>/<modul>` atau `npm run test:ui` | Kalau merah: **Healer** |
| 5 | Cek manual: setiap "Hasil yang Diharapkan" punya `expect(...)` | — |
| 6 | Update **Status Otomasi** di Excel, commit Excel + spec + test, PR | — |

> Excel = file biner. Hindari edit bareng; pecah per file (`testcases/warehouse.xlsx`, `testcases/backoffice.xlsx`, …) atau gantian. `npm run import` membaca semua `testcases/*.xlsx` kecuali `katalog-*.xlsx`.

## Kode ID

`TC-<APP>-<MODUL>-<3 angka>`. APP: `WH` warehouse, `BO` backoffice, `CM` content-management, `MC` merchant, `INV` invoice, `LA` lintas app, `TEC` API mobile technician. Kode modul ada di sheet *Pilihan* Excel (mis. `WH-INV`, `BO-TIC`, `CM-BOT`). Nomor baru = lanjutkan nomor terbesar di modul itu (cek juga `katalog-regresi.xlsx`).

## Contoh prompt ke Cursor (copy-paste)

### Generate test dari spec

```
Ikuti aturan repo interstellar-e2e. Generate test Playwright untuk
TC-WH-SO-010 dari specs/warehouse-stock-opname.md.
Simpan di tests/warehouse/stock-opname/, judul test pakai ID + judul spec.
Import test & expect dari tests/helpers/test.ts. page.goto tanpa "/" di depan.
Jalankan: npx playwright test --project=warehouse --grep TC-WH-SO-010
Perbaiki kalau gagal tanpa melonggarkan assertion.
```

### Tambah halaman ke katalog read-only

```
Tambahkan ke tests/backoffice/katalog/settings.json test "halaman" dan "form" untuk
halaman settings/<x> backoffice. Ikuti format KasusKatalog di tests/helpers/katalog.ts,
ID lanjutkan nomor terakhir. Jangan masukkan teks dari data (angka, nama, tanggal).
Jalankan test-nya, lalu npm run katalog:excel.
```

### Rencana test baru (planner)

```
Buat draft test plan untuk halaman [Transfer order] warehouse (di luar yang sudah ada di
testcases/katalog-regresi.xlsx). Simpan di specs/draft-warehouse-transfer-order.md.
Format: ID TC-WH-TO-..., steps, expected, data test, prioritas.
```

### Perbaiki test gagal (healer)

```
Test TC-BO-CUST-012 gagal. Baca trace/screenshot di test-results/ atau playwright-report.
Perbaiki locator/katalog saja — jangan hapus atau lemahkan expect.
Kalau ini bug aplikasi (API 5xx, form tanpa validasi), tandai fixme + alasan + tanggal.
```

## Aturan teknis (wajib AI ikuti)

Detail di `.github/copilot-instructions.md`.

- **Import** `test` & `expect` dari `tests/helpers/test.ts`, **bukan** `@playwright/test` (supaya pengaman read-only & cek 5xx aktif).
- **URL:** `page.goto('inventory-management/terminal')` — **tanpa** `/` di depan.
- **Locator:** `getByRole` → `getByLabel` / `getByPlaceholder` → `getByText` → `getByTestId`. Jangan CSS class / XPath.
- **Jangan** `page.waitForTimeout()`. Pakai `expect` auto-wait.
- Toast: `page.getByRole('alert')`. Form "New …" = slide-out kanan (judul mis. "Add terminal").
- Login: pakai sesi dari `tests/<app>/auth.setup.ts`; jangan login ulang sampai OTP di test.
- Belum login: `test.use({ storageState: { cookies: [], origins: [] } })`.
- Test default **read-only**. Test yang perlu menyimpan data harus dibahas dengan dev dulu.
- **Jangan edit** `specs/*.md` AUTO-GENERATED dan `testcases/katalog-regresi.xlsx`.
- **Jangan ubah** tanpa dev: `playwright.config.ts`, `tests/helpers/*`, `auth.setup.ts`, `Jenkinsfile`, `package.json`, `scripts/`.

## Kalau test gagal — QA putuskan dulu

| Penyebab | Tindakan |
|----------|----------|
| Bug aplikasi | Lapor + trace. Tandai `fixme` (katalog: isi field `"fixme"`). **Jangan** ubah expected. |
| UI berubah | Healer / update katalog JSON, review diff. |
| Dev down / lambat / sesi ter-logout | Info dev, rerun nanti. |

Lokal: `npm run report`. Jenkins: artifact `test-results/`, `trace.zip` di [trace.playwright.dev](https://trace.playwright.dev).
