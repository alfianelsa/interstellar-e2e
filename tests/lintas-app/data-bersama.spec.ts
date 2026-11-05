// Test lintas app: data yang sama harus terlihat konsisten di warehouse dan backoffice
// (semua backend Interstellar memakai 1 database). Read-only: tidak membuat / mengubah data.
//
// Jalankan: npx playwright test --project=lintas-app
import { test, expect } from '../helpers/test';
import { bukaApp, cari, selPertama } from '../helpers/lintas-app';

test.describe('Lintas app: warehouse ↔ backoffice', () => {
  test('TC-LA-001 Tiket di Ticketing warehouse juga ada di Ticketing backoffice', async ({ browser }) => {
    const wh = await bukaApp(browser, 'warehouse');
    await wh.page.goto('ticketing');
    await wh.page.getByRole('button', { name: 'View all', exact: true }).click();
    const ticketId = await selPertama(wh.page);
    expect(ticketId, 'format Ticket ID').toMatch(/^[A-Z0-9]+_[A-Z]+_\d{8}_\d+$/);
    await wh.tutup();

    const bo = await bukaApp(browser, 'backoffice');
    await bo.page.goto('ticketing');
    await bo.page.getByRole('button', { name: 'View all', exact: true }).click();
    await cari(bo.page, ticketId);
    await expect(bo.page.getByRole('cell', { name: ticketId, exact: true })).toBeVisible();
    await bo.tutup();
  });

  test('TC-LA-002 Daftar warehouse sama di Settings warehouse dan Settings backoffice', async ({ browser }) => {
    const wh = await bukaApp(browser, 'warehouse');
    await wh.page.goto('settings/warehouse');
    const nama = await selPertama(wh.page);
    await wh.tutup();

    const bo = await bukaApp(browser, 'backoffice');
    await bo.page.goto('settings/warehouse');
    await cari(bo.page, nama);
    await expect(bo.page.getByRole('cell', { name: nama }).first()).toBeVisible();
    await bo.tutup();
  });

  test('TC-LA-003 Terminal di Inventory warehouse juga ada di Terminal management backoffice', async ({ browser }) => {
    const wh = await bukaApp(browser, 'warehouse');
    await wh.page.goto('inventory-management/terminal');
    // Kolom ke-3 = Serial Number (kolom 1 nama terminal, kolom 2 part number).
    const baris = wh.page.getByRole('row').filter({ has: wh.page.getByRole('cell') }).first();
    const serial = (await baris.getByRole('cell').nth(2).innerText()).trim();
    expect(serial, 'serial number terminal pertama').not.toBe('');
    await wh.tutup();

    const bo = await bukaApp(browser, 'backoffice');
    await bo.page.goto('terminal-management');
    await cari(bo.page, serial);
    await expect(bo.page.getByRole('cell', { name: serial, exact: true }).first()).toBeVisible();
    await bo.tutup();
  });
});
