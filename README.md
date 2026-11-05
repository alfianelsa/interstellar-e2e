# interstellar-e2e

Automated E2E test untuk **semua app web Interstellar** pakai [Playwright](https://playwright.dev), dalam 1 repo. Polanya sama dengan `everest-e2e`: QA menulis test case di Excel, AI (**Cursor** — lihat **`AGENTS.md`**, atau Copilot `.github/agents/`) membantu generate kode test, Jenkins menjalankan test tiap malam.

Target default: **dev**, `https://interstellar.kalachakra.io`.

| App | Path | Login | Project Playwright | Folder |
|---|---|---|---|---|
| Warehouse | `/warehouse/` | email + OTP | `warehouse` | `tests/warehouse/` |
| Backoffice | `/backoffice/` | email + OTP | `backoffice` | `tests/backoffice/` |
| Content Management | `/content-management/` | email + OTP | `content-management` | `tests/content-management/` |
| Merchant (website publik) | `/` | tanpa login | `merchant` | `tests/merchant/` |
| Invoice | `/reconcile/` | email + OTP | `invoice` | `tests/invoice/` — **app di dev belum merender (lihat Temuan)** |
| Lintas app | — | warehouse + backoffice | `lintas-app` | `tests/lintas-app/` |
| Technician (mobile) | API `/technician/v1/` | email + OTP (API) | `technician` | `tests/technician/` |

App mobile Technician (Flutter) tidak bisa dijalankan Playwright, jadi yang dites **API-nya** (GET saja, read-only): login + OTP lewat API, token di `.auth/technician.json`. Akun QA harus punya role dengan akses "Field mobile app" atau "King". Endpoint `ticket-job/geocode-image` sengaja tidak dites (memanggil layanan geocode eksternal).

## Isi repo

| Path | Isi |
|---|---|
| `tests/<app>/auth.setup.ts` | Login (email + password + OTP dari email) sekali per app, sesi ke `.auth/<app>.json` |
| `tests/<app>/katalog/*.json` | **Katalog test read-only** per modul: halaman tampil, pindah tab, cari, form validasi |
| `tests/<app>/katalog.spec.ts` | Menjalankan semua katalog app itu (lihat `tests/helpers/katalog.ts`) |
| `tests/<app>/login.spec.ts` | Test halaman login (negatif, tanpa OTP) |
| `tests/<app>/seed.spec.ts` | Titik awal untuk AI agent |
| `tests/lintas-app/` | Test yang membuka >1 app dalam 1 test (mis. tiket warehouse ↔ backoffice) |
| `tests/helpers/` | `test.ts` (pengaman read-only + cek 5xx), `apps.ts`, `login.ts`, `email.ts`, `katalog.ts`, `lintas-app.ts`, `data.ts` |
| `testcases/interstellar-testcases.xlsx` | Test case QA (baca sheet *Petunjuk*). **QA nulis di sini.** |
| `testcases/katalog-regresi.xlsx` | **Hasil generate** dari katalog JSON (`npm run katalog:excel`): daftar semua test read-only yang sudah otomatis. Jangan diedit. |
| `specs/` | Spec markdown hasil `npm run import` dari Excel QA |
| **`AGENTS.md`** | **Panduan QA + contoh prompt Cursor** (mulai dari sini) |
| `Jenkinsfile` | Pipeline CI |

## Setup laptop (sekali)

1. Install **Node.js 20+**, **Git**, **[Cursor](https://cursor.com)** (atau VS Code).
2. Clone dan install:
   ```bash
   git clone https://github.com/kalachakra-dev/interstellar-e2e.git
   cd interstellar-e2e
   npm ci
   npx playwright install chromium
   cp .env.example .env
   ```
3. Isi `.env`: `E2E_EMAIL`, `E2E_PASSWORD` (akun QA automation, akses semua app) dan `E2E_IMAP_*` (inbox email akun itu, untuk OTP). Minta ke dev. `.env` tidak ikut ke-commit.
4. Cek: `npx playwright test` harus hijau (test bertanda *fixme* = bug yang sudah diketahui, dilewati).

> **macOS 13 atau lebih lama:** `npx playwright install chromium` gagal ("does not support chromium on mac13"). Install Google Chrome, lalu isi `PW_CHANNEL=chrome` di `.env`. Video dimatikan, trace & screenshot tetap ada. Jenkins tidak terpengaruh.

## Menjalankan

| Perintah | Kegunaan |
|---|---|
| `npx playwright test` | Semua app |
| `npm run test:warehouse` / `test:backoffice` / `test:content-management` / `test:merchant` / `test:technician` / `test:lintas-app` | 1 app saja (login app itu ikut jalan duluan) |
| `npx playwright test --project=backoffice tests/backoffice/katalog.spec.ts --grep TC-BO-TIC` | 1 modul |
| `npx playwright test --grep TC-WH-INV-004` | 1 test berdasarkan ID |
| `npx playwright test --project=setup-warehouse --headed` | Cuma login + OTP warehouse, diam 5 detik di Welcome |
| `SLOW_MO=700 npx playwright test --headed --grep TC-WH-INV-001` | Ditonton pelan-pelan |
| `PAUSE_AFTER_LOGIN=1 npx playwright test --headed --grep TC-WH-INV-001` | Berhenti di Welcome, klik **Resume** di Inspector |
| `npm run test:ui` | Mode visual: screenshot tiap langkah |
| `npm run report` | Buka laporan HTML run terakhir |
| `npm run cakupan` | Laporan cakupan endpoint dari run terakhir → terminal + `results/cakupan-endpoint.xlsx` (endpoint mana yang sudah / belum dites) |
| `npm run endpoint` | Daftar semua endpoint backend (dibaca dari repo `interstellar-be-*` di folder sebelah) |

Login (`setup-<app>`) dan tiap test adalah browser terpisah: setelah login browser ditutup, test membuka browser baru dengan sesi tersimpan dan langsung ke halaman yang dites. Kelihatan "kedip" itu normal.

## Pengaman bawaan (semua test)

- **Read-only.** Semua request ke API Interstellar selain `GET` **diblokir** dan membuat test gagal. Test tidak pernah menyimpan/mengubah/menghapus data di dev, walaupun ada form yang lolos tanpa validasi (bug itu justru ketahuan). Test yang perlu API tulis tertentu harus mengizinkannya eksplisit (`test.use({ izinkanApi: [...] })`).
- **API 5xx = gagal.** Halaman bisa terlihat normal padahal API-nya error. Semua respons 5xx dari API Interstellar membuat test gagal.
- **Login ditunggu sampai 45 detik** dan pesan penolakan server ditampilkan jelas; OTP lama di inbox tidak terbaca (dibaca berdasarkan UID email setelah klik *Sign in*).

## Katalog test read-only

Satu objek di `tests/<app>/katalog/<modul>.json` = satu test. Jenis:

| `jenis` | Yang dicek |
|---|---|
| `halaman` | Teks judul/deskripsi, tombol, kolom tabel tampil; tidak ada API 5xx; teks `tidakAda` tidak tampil |
| `tab` | Klik tab berurutan → URL yang benar terbuka |
| `cari` | Ketik kata acak di Search → API cari 200, tabel kosong |
| `form` | Klik "New …" → form terbuka dengan field wajib → submit kosong → pesan validasi muncul, tidak ada data tersimpan → form ditutup |
| `detail` | Buka detail baris pertama (tombol aksi / klik baris) → API detail 200, label detail tampil, tiap tab detail dibuka |
| `export` | Klik Export → file ter-download dengan nama yang benar dan berisi Excel valid |
| `halaman-berikut` | Klik Next → API halaman 2 membalas 200 dan data berbeda dari halaman 1 |
| `filter` | Filters → Add condition → field / "is" / nilai pertama → API filter 200, semua baris hasil sesuai nilai filter |

Semua jenis juga gagal kalau ada API GET yang membalas 4xx/5xx selama test.

Menambah halaman = tambah 1 objek di JSON (tidak perlu kode), lalu `npm run katalog:excel` supaya Excel katalog ikut ter-update. Teks yang berasal dari **data** (nama terminal, jumlah item, tanggal) jangan dimasukkan: data dev bisa berubah.

## Hal khusus Interstellar

- **Login selalu pakai OTP email**, sama di semua app. OTP berlaku 2,5 menit.
- ⚠️ **Jangan otomasi "password salah" dengan akun QA.** Tiap password salah menambah `users.login_attempt` (1 counter untuk semua app, tidak di-reset login sukses). 5x salah dalam 60 menit → `login_access = false` → akun **terkunci di semua app** sampai dibuka admin (Backoffice → Account management → User → edit → *Login access*). Ini pernah terjadi 2026-11-04 karena TC-*-LOGIN-004, sehingga test itu dicabut.
- **1 akun = 1 sesi per app.** Login baru di app yang sama menimpa token sesi sebelumnya. Jangan login manual pakai akun QA saat test jalan (termasuk Jenkins ±01:00 WIB). Login di app lain aman (token per app terpisah).
- **App ada di bawah path.** `baseURL` tiap project = `…/<path app>/`, test memanggil `page.goto('halaman')` **tanpa** `/` di depan.
- **Error dari backend selalu HTTP 500.** `Request.error` di `interstellar-be-core/helper/request.js` membalas semua error untuk user (mis. "password salah") dengan 500. Test negatif yang sengaja memicu error mengizinkan 5xx di endpoint itu (`izinkan5xx`).

## Temuan saat membuat test (2026-11-04)

Ditandai `fixme` di katalog/test (dilewati, bukan dihapus) sampai diperbaiki:

| Test | Temuan |
|---|---|
| TC-WH-ACC-005, TC-BO-ACC-007 | "Add team member": Submit tanpa memilih anggota langsung mengirim `PATCH user-and-team/team/<id>` (tidak ada validasi) |
| TC-WH-RPT-001 | `GET warehouse-api/v1/reporting/population` → 500 |
| TC-WH-RPT-008 | `GET warehouse-api/v1/reporting/stock/thermal` → 500 (tab Thermal di report Stock) |
| TC-BO-MAP-001 | Google Maps di dev: "This page can't load Google Maps correctly." (API key/billing) |
| TC-INV-LOGIN-001 | App invoice `/reconcile/` di dev tidak merender apa pun (`#root` kosong, tanpa error console) |
| TC-WH-RPT-017 | Filter **Customer** di report Movement terminal → `GET reporting/movement/terminal?filter…` 500 (2026-11-05) |
| TC-TEC-VAL-001 | API mobile `GET transfer-order` tanpa `?is_sender` → 500, seharusnya 4xx (2026-11-05) |
| TC-TEC-VAL-002 | API mobile `GET ticket-job/checklist` tanpa `?category` → 500, seharusnya 4xx (2026-11-05) |

**Rate limit backoffice = HTTP 500.** `interstellar-be-backoffice/routes/v1.js` membatasi 60 request/menit per token dan membalas kelebihannya lewat `Request.error` → **HTTP 500** "You can only make 60 requests every minutes." (terbukti 2026-11-05). Satu halaman backoffice memanggil 3–10 API, jadi test backoffice yang berjalan cepat (dan user yang aktif) bisa kena error acak. Seharusnya 429 + pesan di UI.

Lain-lain (2026-11-05): dialog **edit** produk di Content Management → Catalog berjudul "New product".

Lain-lain: form "New SLA" berjudul "Edit SLA" (typo UI); tombol "Add new Rack" di Rack management langsung membuat rack tanpa form/konfirmasi; semua error API dikirim sebagai HTTP 500.

## Alur bikin test baru (selain katalog)

1. Branch: `git checkout -b test/<nama-fitur>`
2. Tulis test case di `testcases/interstellar-testcases.xlsx`, **Otomasi? = Ya**, modul format `<App> / <Modul>` (dropdown).
3. `npm run import` → `specs/<app>-<modul>.md`.
4. Generate kode (prompt di **`AGENTS.md`**), simpan di `tests/<app>/<modul>/`.
5. Jalankan sampai hijau, cek tiap "Hasil yang Diharapkan" punya `expect(...)`.
6. Commit + PR ke `main` (Excel + spec + test).

## Kalau test gagal

- **Lokal**: `npm run report` → klik test yang gagal → screenshot, trace.
- **Jenkins**: build merah → **Test Result** → artifact `test-results/` → `trace.zip` di [trace.playwright.dev](https://trace.playwright.dev).

| Penyebab | Tindakan |
|---|---|
| **Bug di aplikasi** (termasuk API 5xx berulang, form tanpa validasi) | Lapor, lampirkan trace. Tandai `fixme` dengan alasan + tanggal. **Jangan** ubah expected-nya. |
| **UI berubah** | Perbaiki katalog JSON / locator (prompt *healer* di `AGENTS.md`). Review diff. |
| **Dev down / lambat** (banyak test gagal sekaligus, 502/timeout) | Jalankan ulang nanti. Di Jenkins tiap test diulang 1x otomatis. |
| **`setup-<app>` gagal di OTP** | Cek kredensial IMAP (App Password), email OTP masuk inbox (bukan spam). |

## Aturan

- Data dummy saja; test default **read-only**. Test yang membuat data (nanti) wajib prefix `E2E` + `{unik}` dan harus didiskusikan dulu dengan dev (dev dipakai bersama).
- Kredensial cuma lewat `.env` (lokal) dan Jenkins credential (CI).
- Jangan ubah `playwright.config.ts`, `tests/helpers/*`, `tests/<app>/auth.setup.ts`, `Jenkinsfile`, `package.json` tanpa ngobrol sama dev.

## Jenkins (admin)

- Job: **Pipeline script from SCM** → repo ini, branch `main`, script path `Jenkinsfile`.
- Credential (nilai **dev**):

  | ID | Jenis | Isi |
  |---|---|---|
  | `interstellar-e2e-qa` | Username with password | akun QA automation (`E2E_EMAIL` / `E2E_PASSWORD`) |
  | `interstellar-e2e-imap` | Username with password | inbox email akun QA (`E2E_IMAP_USER` / App Password Gmail) |

- **Credential dulu, baru merge.** Kalau satu credential belum ada, seluruh build gagal sebelum stage apa pun jalan.
- Parameter: `APP` (semua / per app / lintas-app), `BASE_HOST`, `GREP`. Jadwal tiap malam ±01:00 WIB menjalankan `semua`.
- Agent harus bisa `docker run` (image `mcr.microsoft.com/playwright`, versinya = `@playwright/test` di `package.json`). Kalau Jenkins tidak jalan di container dengan volume `jenkins-data`, ganti baris `--mount ...` di `Jenkinsfile` dengan `-v "$WORKSPACE":/work`.
