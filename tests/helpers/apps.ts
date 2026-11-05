// Daftar app web Interstellar yang dites. Semua jalan di 1 host di bawah path masing-masing
// (nginx route per path). Ganti host lewat env BASE_HOST (default: dev).

export const HOST = (process.env.BASE_HOST || 'https://interstellar.kalachakra.io').replace(/\/+$/, '');

export const APPS = {
  warehouse: { path: '/warehouse/', perluLogin: true },
  backoffice: { path: '/backoffice/', perluLogin: true },
  'content-management': { path: '/content-management/', perluLogin: true },
  // App invoice di-build dengan base /reconcile (bukan /invoice).
  invoice: { path: '/reconcile/', perluLogin: true },
  // Merchant = website publik di root host, tanpa login.
  merchant: { path: '/', perluLogin: false },
} as const;

export type NamaApp = keyof typeof APPS;

/** URL dasar app, selalu diakhiri "/". Test memanggil page.goto('halaman') TANPA "/" di depan. */
export function urlApp(app: NamaApp): string {
  return HOST + APPS[app].path;
}

/** File sesi login hasil auth.setup app itu. */
export function fileSesi(app: NamaApp): string {
  return `.auth/${app}.json`;
}
