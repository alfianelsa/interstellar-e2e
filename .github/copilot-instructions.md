# Aturan repo interstellar-e2e

Repo ini berisi E2E test Playwright untuk **semua app web Interstellar** dalam 1 repo: warehouse (`/warehouse/`), backoffice (`/backoffice/`), content-management (`/content-management/`), merchant (website publik di `/`), invoice (`/reconcile/`), plus test lintas app. 1 app = 1 project Playwright = 1 folder `tests/<app>/`.

> **QA pakai Cursor?** Baca **`AGENTS.md`** dan **`.cursor/rules/`**. File ini dipakai Copilot / agent di `.github/agents/`, dan berlaku untuk semua AI.

## Struktur

- `tests/<app>/auth.setup.ts` — login + OTP sekali per app → `.auth/<app>.json`. Project `<app>` bergantung pada `setup-<app>`.
- `tests/<app>/katalog/<modul>.json` — test read-only berbasis data (halaman / tab / cari / form / detail / export / halaman-berikut / filter), dijalankan `tests/helpers/katalog.ts`. Tipe datanya `KasusKatalog` di file itu.
- `tests/<app>/<modul>/*.spec.ts` — test skenario yang ditulis dari spec Excel.
- `tests/technician/` — test API mobile technician (tanpa browser), helper `tests/helpers/technician.ts`.
- `tests/lintas-app/` — test >1 app; buka app lewat `bukaApp(browser, '<app>')` dari `tests/helpers/lintas-app.ts`.

## Menulis test

- **Import `test` dan `expect` dari `tests/helpers/test.ts`**, bukan dari `@playwright/test`. Fixture di sana memblokir semua API tulis (POST/PUT/PATCH/DELETE ke `*-api/v1/`) dan menggagalkan test kalau ada yang terblokir, serta menggagalkan test kalau ada respons API 5xx.
- Test yang memang memanggil API tulis tertentu: `test.use({ izinkanApi: [/pola/] })`. Kalau server membalas penolakan dengan 500 (semua error backend Interstellar = 500), tambah `izinkan5xx: [/pola/]`. Jangan dipakai untuk menutupi bug.
- **URL relatif TANPA `/` di depan**: `page.goto('ticketing')`. `baseURL` tiap project sudah berisi path app.
- Urutan locator: `getByRole` → `getByLabel` / `getByPlaceholder` → `getByText` → `getByTestId`. **Jangan** class CSS (Tailwind) atau XPath. Atribut `data-test` yang sudah ada boleh lewat `page.locator('[data-test="..."]')` kalau tidak ada cara lain.
- Jangan `page.waitForTimeout()`. Pakai assertion auto-wait.
- Toast → `page.getByRole('alert')`. Form "New …" = slide-out kanan; judulnya teks biasa (mis. "Add terminal"), tombol ✕ di header tidak bernama (klik tombol pertama di `getByRole('banner')` yang memuat judul).
- Label field wajib punya `*` di elemen terpisah: cocokkan label tanpa `*`.
- Sesi login dari `auth.setup.ts`. Test baru **jangan** login ulang (apalagi sampai OTP): akun QA cuma 1 sesi per app, login baru menendang sesi test lain.
- Test yang mulai belum login: `test.use({ storageState: { cookies: [], origins: [] } })`.
- Judul test = ID + judul test case, mis. `test('TC-WH-SO-010 Detail stock opname tampil', ...)`. ID: `TC-<APP>-<MODUL>-<NNN>` (APP: WH, BO, CM, MC, INV, LA, TEC).
- **Jangan masukkan nilai dari data** (nama terminal, jumlah item, tanggal, nama user) sebagai expected. Data dev berubah. Kalau perlu data, ambil dari layar/API saat test jalan (contoh: `selPertama()` di `tests/helpers/lintas-app.ts`).

## Katalog read-only

- Tambah halaman/form = tambah objek di `tests/<app>/katalog/<modul>.json`, ID melanjutkan nomor terbesar di file itu. Setelah mengubah katalog: jalankan test-nya lalu `npm run katalog:excel`.
- `teks`/`tombol`/`kolom` = teks UI statis saja. `validasi` = pesan persis yang muncul setelah submit kosong.
- Bug aplikasi → isi `"fixme": "BUG: <apa>. Ditemukan <YYYY-MM-DD>."` (jangan hapus kasusnya).

## Data unik (kalau nanti ada test yang membuat data)

Test default read-only. Test yang membuat data harus didiskusikan dengan dev dulu (dev dipakai bersama tim lain). Kalau disetujui: data diawali `E2E` + `{unik}` dari `tests/helpers/data.ts`, satu nilai per test, jangan andalkan hapus data di akhir test.

## Email / OTP

`ambilOtp(email, sejak, { mulaiUid })` (`tests/helpers/email.ts`) + `isiOtp(page, otp)` (`tests/helpers/login.ts`). Panggil `tandaiInbox()` **sebelum** aksi yang mengirim email, kirim hasilnya sebagai `mulaiUid`, supaya email lama tidak terbaca.

## Jangan diubah tanpa minta dev

`playwright.config.ts`, `tests/helpers/*`, `tests/<app>/auth.setup.ts`, `Jenkinsfile`, `package.json`, `scripts/`. File `specs/*.md` berheader `AUTO-GENERATED` dan `testcases/katalog-regresi.xlsx` = hasil generate, jangan diedit langsung.

## Memperbaiki test yang gagal (healer)

- Boleh: update locator / katalog, tambah tunggu yang benar, sesuaikan data test.
- **Dilarang**: menghapus / melonggarkan assertion, menambah `izinkanApi` / `izinkan5xx` supaya lolos.
- Bug aplikasi (API 5xx berulang, form tanpa validasi, tampilan salah) → `test.fixme()` / `"fixme"` + alasan + tanggal.
