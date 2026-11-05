// Data unik untuk test yang membuat data baru, supaya test bisa dijalankan berulang
// tanpa bentrok "already exist". Dipakai untuk placeholder {unik}, {nik}, {hp} di spec.
//
// Kenapa bukan hapus data setelah test: kalau test gagal di tengah, langkah hapus tidak jalan
// dan run berikutnya bentrok; QA (laptop) dan Jenkins bisa jalan bersamaan; dan tidak semua
// data bisa dihapus dari UI.

const pad = (n: number, len = 2) => String(n).padStart(len, '0');

// Worker Playwright yang jalan paralel dibedakan lewat indeksnya.
const worker = Number(process.env.TEST_PARALLEL_INDEX ?? 0) % 10;

// Jam milidetik yang selalu naik di worker ini, jadi 2 panggilan tidak pernah dapat nilai sama.
let last = 0;
function tick(): number {
  last = Math.max(Date.now(), last + 1);
  return last;
}

/** Kode unik: waktu WIB sampai milidetik (yyMMddHHmmssSSS) + worker + 2 karakter acak. */
export function unik(): string {
  const wib = new Date(tick() + 7 * 3600_000).toISOString();
  const stamp = wib.slice(2, 23).replace(/\D/g, '');
  const acak = Math.random().toString(36).slice(2, 4).padEnd(2, '0');
  return `${stamp}${worker}${acak}`;
}

/**
 * NIK 16 digit berstruktur valid: kode wilayah + tanggal lahir (perempuan +40) + nomor urut.
 * Tanggal lahir & nomor urut diturunkan dari jam di atas, jadi tidak ada NIK kembar dalam ±7 jam.
 */
export function nik(): string {
  const t = tick();
  const detik = Math.floor(t / 1000);
  const hari = detik % 12775; // tanggal lahir dalam rentang 1970–2004
  const lahir = new Date(Date.UTC(1970, 0, 1 + hari));
  const tgl = lahir.getUTCDate() + (Math.floor(detik / 12775) % 2 ? 40 : 0);
  const urut = pad((t % 1000) * 10 + worker, 4);
  return `317101${pad(tgl)}${pad(lahir.getUTCMonth() + 1)}${pad(lahir.getUTCFullYear() % 100)}${urut}`;
}

/** Nomor HP bagian nasional TANPA 0 di depan (kalau field HP di UI sudah menampilkan +62; sesuaikan per form), 13 digit. */
export function hp(): string {
  return `81${pad(tick() % 1e10, 10)}${worker}`;
}
