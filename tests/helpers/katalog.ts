// Runner test "katalog": tiap file tests/<app>/katalog/<modul>.json berisi daftar test case read-only
// (halaman tampil, pindah tab, cari, form validasi). File ini mengubahnya jadi test Playwright.
//
// Katalog yang sama dipakai scripts/katalog-ke-excel.mjs untuk mengisi Excel, jadi Excel = isi test.
// Menambah halaman baru = tambah 1 objek di JSON; tidak perlu menulis kode test.

import fs from 'node:fs';
import path from 'node:path';
import { type Page } from '@playwright/test';
import { test, expect } from './test';

/** Satu test case di katalog. `jenis` menentukan langkah & pengecekannya. */
export type KasusKatalog = {
  /** ID unik tanpa awalan "TC-", mis. "WH-INV-001". */
  id: string;
  judul: string;
  prioritas?: 'P1' | 'P2' | 'P3' | 'P4';
  /** Halaman awal, relatif terhadap baseURL app, TANPA "/" di depan. */
  url: string;
  /** Catatan untuk QA/dev (alasan fixme, bug terkait, dll). */
  catatan?: string;
  /** Isi alasan di sini kalau test sedang ditandai bug aplikasi (test.fixme). */
  fixme?: string;
} & (
  | {
      jenis: 'halaman';
      /** Teks yang harus tampil (persis, huruf besar-kecil sama). */
      teks: string[];
      /** Tombol yang harus tampil (nama aksesibel persis). */
      tombol?: string[];
      /** Judul kolom tabel yang harus tampil. */
      kolom?: string[];
      /** Teks yang TIDAK boleh tampil (mis. pesan error), dicocokkan sebagian. */
      tidakAda?: string[];
    }
  | {
      jenis: 'tab';
      /** Tab yang diklik berurutan dan URL (regex) yang harus terbuka. `link: true` kalau tab berupa link (menu). */
      tab: { nama: string; url: string; link?: boolean }[];
    }
  | {
      jenis: 'cari';
      /** Kata kunci yang dijamin tidak ada di data. */
      kata?: string;
    }
  | {
      jenis: 'form';
      /** Tombol pembuka form, mis. "New terminal". */
      tombol: string;
      /** Judul form yang tampil, mis. "Add terminal". */
      judulForm: string;
      /** Label field di form, tanpa tanda "*" (mis. "Serial number"). Opsional. */
      teks?: string[];
      /** Tombol kirim. Default "Submit". */
      submit?: string;
      /** Pesan validasi yang harus muncul setelah submit kosong. Kosongkan kalau submit dinonaktifkan. */
      validasi: string[];
      /** true = tombol kirim harus nonaktif saat form kosong (tidak diklik). */
      submitNonaktif?: boolean;
      /** false = form tidak punya tombol kirim saat kosong (baru muncul setelah diisi); langkah submit dilewati. */
      submitAda?: boolean;
      /** Tombol penutup form. Default "Cancel". "X" = ikon ✕ di header form, "Escape" = tombol Esc. */
      tutup?: string;
    }
  | {
      jenis: 'detail';
      /** Cara membuka detail baris pertama: "aksi" = tombol di kolom terakhir, "baris" = klik sel pertama. */
      buka: 'aksi' | 'baris';
      /** Regex path API detail yang harus membalas 200, mis. "/inventory-management/terminal/[^/]+/detail". */
      api: string;
      /** Regex URL halaman detail, kalau detail membuka halaman baru (bukan slide-out). */
      urlDetail?: string;
      /** Label/judul statis di detail (bukan nilai data). */
      teks: string[];
      /** Tab di detail yang diklik satu per satu (API-nya harus sukses). */
      tab?: string[];
    }
  | {
      jenis: 'export';
      /** Tombol export. Default "Export". */
      tombol?: string;
      /** Regex nama file hasil download, mis. "^export-terminal\\.xlsx$". */
      file: string;
    }
  | {
      jenis: 'halaman-berikut';
    }
  | {
      jenis: 'filter';
      /** Field di "Add condition", mis. "Condition". Nilai yang dipilih = opsi pertama (dari data saat test). */
      field: string;
      /** Operator. Default "is". */
      operator?: string;
      /** Judul kolom tabel yang isinya harus sama dengan nilai filter di semua baris hasil. */
      kolom?: string;
    }
);

export type Katalog = { modul: string; kasus: KasusKatalog[] };

const KATA_TIDAK_ADA = 'zzE2Ekosong9q';

/** Locator teks yang persis sama, dan terlihat (abaikan salinan tersembunyi, mis. tooltip). */
function teksTerlihat(page: Page, teks: string, exact = true) {
  return page.getByText(teks, { exact }).locator('visible=true').first();
}

function tombolTerlihat(page: Page, nama: string) {
  return page.getByRole('button', { name: nama, exact: true }).locator('visible=true').first();
}

const API = /-api\/v1\//;

/** Baris data tabel (punya sel). */
function barisData(page: Page) {
  return page.getByRole('row').filter({ has: page.getByRole('cell') });
}

/** Catat respons API GET >= 400 mulai sekarang (5xx sudah dicek fixture; ini menangkap 4xx juga). */
function pantauApiGagal(page: Page) {
  const gagal: string[] = [];
  page.on('response', (r) => {
    if (r.status() >= 400 && API.test(r.url()) && r.request().method() === 'GET') {
      gagal.push(`${r.status()} ${new URL(r.url()).pathname}`);
    }
  });
  return gagal;
}

/** Tombol buka dropdown (MUI Autocomplete) terakhir di layar, mis. di baris kondisi filter. */
function dropdownTerakhir(page: Page) {
  return page.locator('input[role="combobox"]').locator('..').getByRole('button').last();
}

async function jalankan(page: Page, k: KasusKatalog) {
  const apiGagal = pantauApiGagal(page);
  await page.goto(k.url);

  switch (k.jenis) {
    case 'halaman': {
      for (const t of k.teks) await expect(teksTerlihat(page, t), `teks "${t}"`).toBeVisible();
      for (const b of k.tombol ?? []) await expect(tombolTerlihat(page, b), `tombol "${b}"`).toBeVisible();
      for (const c of k.kolom ?? []) {
        await expect(page.getByRole('columnheader', { name: c, exact: true }).first(), `kolom "${c}"`).toBeVisible();
      }
      // Tunggu semua request awal selesai, supaya API yang error (5xx) ikut ketahuan.
      await page.waitForLoadState('networkidle');
      for (const t of k.tidakAda ?? []) await expect(teksTerlihat(page, t, false), `tidak boleh ada "${t}"`).toHaveCount(0);
      break;
    }

    case 'tab': {
      for (const t of k.tab) {
        const el = t.link
          ? page.getByRole('link', { name: t.nama, exact: true }).locator('visible=true').first()
          : tombolTerlihat(page, t.nama);
        await el.click();
        await expect(page, `tab "${t.nama}"`).toHaveURL(new RegExp(t.url));
      }
      break;
    }

    case 'cari': {
      const kata = k.kata ?? KATA_TIDAK_ADA;
      const kotak = page.getByRole('textbox', { name: 'Search' }).or(page.getByRole('combobox', { name: 'Search' })).first();
      await expect(kotak).toBeVisible();
      // Tunggu daftar awal selesai dimuat dulu, supaya hasil cari tidak tertimpa respons awal.
      await page.waitForLoadState('networkidle');
      const respons = page.waitForResponse(
        (r) => r.request().method() === 'GET' && /-api\/v1\//.test(r.url()) && r.url().includes(`search=${kata}`),
      );
      await kotak.fill(kata);
      const r = await respons;
      expect(r.status(), `API cari ${r.url()}`).toBe(200);
      // Kata acak tidak cocok dengan data apa pun: tabel tidak boleh berisi baris data.
      await expect(page.getByRole('row').filter({ has: page.getByRole('cell') }).filter({ hasText: /\S/ })).toHaveCount(0);
      break;
    }

    case 'form': {
      await tombolTerlihat(page, k.tombol).click();
      const judul = teksTerlihat(page, k.judulForm);
      await expect(judul, `judul form "${k.judulForm}"`).toBeVisible();
      // Label field ditulis tanpa "*" (tanda wajib ada di elemen terpisah), dicocokkan sebagian.
      for (const t of k.teks ?? []) await expect(teksTerlihat(page, t, false), `label form "${t}"`).toBeVisible();

      const kirim = page.getByRole('button', { name: k.submit ?? 'Submit', exact: true }).locator('visible=true').last();
      if (k.submitAda === false) {
        await expect(kirim, 'tombol kirim belum ada saat form kosong').toHaveCount(0);
      } else if (k.submitNonaktif) {
        await expect(kirim, 'tombol kirim nonaktif saat form kosong').toBeDisabled();
      } else {
        await kirim.click();
        for (const v of k.validasi) await expect(teksTerlihat(page, v), `validasi "${v}"`).toBeVisible();
      }

      if (k.tutup === 'Escape') await page.keyboard.press('Escape');
      else if (k.tutup === 'X') {
        // Tombol ikon ✕ tanpa nama: satu-satunya tombol di header (banner) slide-out yang memuat judul form.
        await page.getByRole('banner').filter({ hasText: k.judulForm }).getByRole('button').first().click();
      }
      else await page.getByRole('button', { name: k.tutup ?? 'Cancel', exact: true }).locator('visible=true').last().click();
      await expect(judul, 'form tertutup setelah tutup').toBeHidden();
      break;
    }

    case 'detail': {
      const baris = barisData(page).first();
      await expect(baris, 'tabel punya minimal 1 baris data (data dev kosong?)').toBeVisible();
      const respons = page.waitForResponse((r) => r.request().method() === 'GET' && new RegExp(k.api).test(new URL(r.url()).pathname));
      if (k.buka === 'aksi') await baris.getByRole('cell').last().getByRole('button').first().click();
      else await baris.getByRole('cell').first().click();
      const r = await respons;
      expect(r.status(), `API detail ${new URL(r.url()).pathname}`).toBe(200);
      if (k.urlDetail) await expect(page).toHaveURL(new RegExp(k.urlDetail));
      for (const t of k.teks) await expect(teksTerlihat(page, t), `teks detail "${t}"`).toBeVisible();
      for (const t of k.tab ?? []) {
        await page.getByRole('tab', { name: t, exact: true }).locator('visible=true').last().click();
        await expect(page.getByRole('tab', { name: t, exact: true }).locator('visible=true').last()).toHaveAttribute('aria-selected', 'true');
        await page.waitForLoadState('networkidle');
      }
      await page.waitForLoadState('networkidle');
      break;
    }

    case 'export': {
      await page.waitForLoadState('networkidle');
      const unduh = page.waitForEvent('download');
      await tombolTerlihat(page, k.tombol ?? 'Export').click();
      const d = await unduh;
      expect(d.suggestedFilename(), 'nama file export').toMatch(new RegExp(k.file));
      expect(await d.failure(), 'download export gagal').toBeNull();
      const isi = fs.readFileSync(await d.path());
      // File .xlsx = arsip ZIP (diawali "PK"). Kalau server mengirim JSON error, ketahuan di sini.
      expect(isi.length, 'ukuran file export').toBeGreaterThan(0);
      if (/xlsx$/.test(d.suggestedFilename())) expect(isi.subarray(0, 2).toString(), 'file export bukan Excel yang valid').toBe('PK');
      break;
    }

    case 'halaman-berikut': {
      await expect(barisData(page).first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      const awal = await barisData(page).first().innerText();
      const respons = page.waitForResponse(
        (r) => r.request().method() === 'GET' && API.test(r.url()) && new URL(r.url()).searchParams.get('page') === '2',
      );
      await tombolTerlihat(page, 'Next').click();
      const r = await respons;
      expect(r.status(), `API halaman 2 ${new URL(r.url()).pathname}`).toBe(200);
      await expect(barisData(page).first(), 'halaman 2 berisi data').toBeVisible();
      await expect(barisData(page).first(), 'halaman 2 menampilkan data yang berbeda dari halaman 1').not.toHaveText(awal);
      break;
    }

    case 'filter': {
      await page.waitForLoadState('networkidle');
      await tombolTerlihat(page, 'Filters').click();
      await teksTerlihat(page, 'Add condition').click();
      await dropdownTerakhir(page).click();
      await page.getByRole('option', { name: k.field, exact: true }).click();
      await dropdownTerakhir(page).click();
      await page.getByRole('option', { name: k.operator ?? 'is', exact: true }).click();
      await dropdownTerakhir(page).click();
      const opsi = page.getByRole('option').first();
      await expect(opsi, `ada pilihan nilai untuk filter "${k.field}"`).toBeVisible();
      const nilai = (await opsi.innerText()).trim();
      const respons = page.waitForResponse(
        (r) =>
          r.request().method() === 'GET' &&
          API.test(r.url()) &&
          !/\/option\//.test(r.url()) &&
          decodeURIComponent(r.url()).includes('filter[0][field]'),
        { timeout: 30_000 },
      );
      await opsi.click();
      const r = await respons;
      expect(r.status(), `API filter ${new URL(r.url()).pathname}`).toBe(200);
      await page.waitForLoadState('networkidle');
      test.info().annotations.push({ type: 'filter', description: `${k.field} ${k.operator ?? 'is'} "${nilai}"` });
      if (k.kolom) {
        // Semua baris hasil harus punya nilai filter di kolom itu.
        // Ditunggu (poll) karena tabel di-render ulang sesaat setelah respons API filter datang.
        const isiKolom = () =>
          page.evaluate((judul) => {
            const th = [...document.querySelectorAll('thead th')];
            const i = th.findIndex((x) => x.textContent?.trim() === judul);
            if (i < 0) return null;
            return [...document.querySelectorAll('tbody tr')].map((tr) => tr.children[i]?.textContent?.trim() ?? '');
          }, k.kolom!);
        expect(await isiKolom(), `kolom "${k.kolom}" ada di tabel`).not.toBeNull();
        await expect
          .poll(async () => (await isiKolom())!.filter((v) => v !== nilai), {
            message: `semua baris hasil filter ${k.field} = "${nilai}" (yang tampil di bawah = baris yang TIDAK sesuai filter)`,
            timeout: 15_000,
          })
          .toEqual([]);
      }
      break;
    }
  }

  expect(apiGagal, 'API membalas error (4xx/5xx) selama test').toEqual([]);
}

/** Baca semua katalog app (tests/<app>/katalog/*.json) lalu daftarkan test-nya. */
export function daftarkanKatalog(folderApp: string) {
  const dir = path.join(folderApp, 'katalog');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  for (const f of files) {
    const katalog: Katalog = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    test.describe(katalog.modul, () => {
      for (const k of katalog.kasus) {
        const judul = `TC-${k.id} ${k.judul}`;
        test(judul, async ({ page }) => {
          // Bug aplikasi yang sudah diketahui: test dilewati (bukan dihapus) sampai bug-nya diperbaiki.
          test.fixme(!!k.fixme, k.fixme);
          if (k.catatan) test.info().annotations.push({ type: 'catatan', description: k.catatan });
          await jalankan(page, k);
        });
      }
    });
  }
}
