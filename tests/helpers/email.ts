// Baca email dari inbox akun QA lewat IMAP. Dipakai untuk OTP login warehouse.
// Kredensial dari env: E2E_IMAP_HOST, E2E_IMAP_PORT, E2E_IMAP_USER, E2E_IMAP_PASSWORD.

import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

export type Email = {
  /** UID IMAP email ini (naik terus; dipakai untuk melewati email yang sudah dicoba). */
  uid: number;
  subjek: string;
  dari: string;
  ke: string;
  tanggal: Date;
  teks: string;
  html: string;
};

type OpsiTunggu = {
  /** Alamat penerima persis. */
  ke: string;
  /** Cuma email yang masuk setelah waktu ini (catat sebelum memicu email). */
  sejak: Date;
  /** Filter subjek (teks yang harus ada, atau regex). */
  subjek?: string | RegExp;
  /** Filter isi email (teks yang harus ada). */
  berisi?: string;
  /** Default 120 detik. */
  timeoutMs?: number;
  /**
   * Cuma email dengan UID >= nilai ini (hasil `tandaiInbox()` sebelum memicu email).
   * Lebih akurat dari `sejak`: OTP dari login sebelumnya yang masih dalam toleransi jam tidak ikut terbaca.
   */
  mulaiUid?: number;
};

// Toleransi beda jam antara mesin test dan server email.
const TOLERANSI_JAM_MS = 2 * 60_000;

function env(nama: string): string {
  const v = process.env[nama];
  if (!v) throw new Error(`${nama} belum diisi (lihat .env.example)`);
  return v;
}

function cocok(nilai: string, pola?: string | RegExp): boolean {
  if (!pola) return true;
  return typeof pola === 'string' ? nilai.includes(pola) : pola.test(nilai);
}

function buatClient() {
  return new ImapFlow({
    host: env('E2E_IMAP_HOST'),
    port: Number(process.env.E2E_IMAP_PORT ?? 993),
    secure: true,
    auth: { user: env('E2E_IMAP_USER'), pass: env('E2E_IMAP_PASSWORD') },
    logger: false,
  });
}

/**
 * Catat posisi inbox saat ini (UID berikutnya). Panggil SEBELUM aksi yang mengirim email,
 * lalu kirim hasilnya sebagai `mulaiUid`, supaya cuma email baru yang terbaca.
 */
export async function tandaiInbox(): Promise<number> {
  return cobaUlang('tandai inbox', async () => {
    const client = buatClient();
    await client.connect();
    try {
      const status = await client.status('INBOX', { uidNext: true });
      return status.uidNext ?? 0;
    } finally {
      await client.logout().catch(() => {});
    }
  });
}

/** Koneksi IMAP ke Gmail kadang putus sesaat (ETIMEDOUT/ECONNRESET): coba lagi sebelum menyerah. */
async function cobaUlang<T>(nama: string, fn: () => Promise<T>, maks = 6): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= maks) throw e;
      console.warn(`IMAP ${nama} gagal (percobaan ${i}/${maks}), coba lagi: ${(e as Error)?.message ?? e}`);
      await new Promise((r) => setTimeout(r, 5000 * i)); // total tunggu s.d. ~75 detik
    }
  }
}

async function cariSekali(opsi: OpsiTunggu): Promise<Email | null> {
  const client = buatClient();
  await client.connect();
  const lock = await client.getMailboxLock('INBOX');
  try {
    const batas = opsi.sejak.getTime() - TOLERANSI_JAM_MS;
    const uids = (await client.search({ to: opsi.ke, since: new Date(batas) }, { uid: true })) || [];
    // Terbaru dulu.
    for (const uid of [...uids].sort((a, b) => b - a)) {
      if (opsi.mulaiUid && uid < opsi.mulaiUid) continue;
      const msg = await client.fetchOne(String(uid), { source: true, internalDate: true }, { uid: true });
      if (!msg || !msg.source) continue;
      const tanggal = new Date(msg.internalDate ?? 0);
      if (tanggal.getTime() < batas) continue;
      const p = await simpleParser(msg.source);
      const email: Email = {
        uid,
        subjek: p.subject ?? '',
        dari: p.from?.text ?? '',
        ke: Array.isArray(p.to) ? p.to.map((t) => t.text).join(', ') : (p.to?.text ?? ''),
        tanggal,
        teks: p.text ?? '',
        html: typeof p.html === 'string' ? p.html : '',
      };
      if (!email.ke.toLowerCase().includes(opsi.ke.toLowerCase())) continue;
      if (!cocok(email.subjek, opsi.subjek)) continue;
      if (opsi.berisi && !email.teks.includes(opsi.berisi) && !email.html.includes(opsi.berisi)) continue;
      return email;
    }
    return null;
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }
}

/** Tunggu sampai email yang cocok masuk, lalu kembalikan isinya. */
export async function tungguEmail(opsi: OpsiTunggu): Promise<Email> {
  const batasWaktu = Date.now() + (opsi.timeoutMs ?? 120_000);
  let galatTerakhir: unknown = null;
  while (Date.now() < batasWaktu) {
    try {
      const email = await cariSekali(opsi);
      if (email) return email;
    } catch (e) {
      // Gangguan jaringan sesaat ke server IMAP: lanjut menunggu sampai batas waktu.
      galatTerakhir = e;
      console.warn(`IMAP gagal dibaca, coba lagi: ${(e as Error)?.message ?? e}`);
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  if (galatTerakhir) throw galatTerakhir;
  throw new Error(
    `Email ke ${opsi.ke}${opsi.subjek ? ` (subjek ${opsi.subjek})` : ''} tidak masuk dalam ${(opsi.timeoutMs ?? 120_000) / 1000} detik`,
  );
}

/**
 * Ambil kode OTP login dari email terbaru ke alamat itu.
 * Format email Interstellar (be-core auth.*.controller.js):
 *   subjek "Interstellar: OTP Verification", isi "this is your OTP: 123456".
 */
export async function ambilOtp(ke: string, sejak: Date, opsi: Partial<OpsiTunggu> = {}): Promise<string> {
  return (await ambilOtpDenganUid(ke, sejak, opsi)).otp;
}

/**
 * Sama dengan `ambilOtp`, plus UID email-nya. Email OTP semua app isinya sama persis, jadi kalau OTP
 * ditolak ("Wrong OTP": email dari login sebelumnya yang telat masuk), panggil lagi dengan
 * `mulaiUid: uid + 1` untuk mengambil email yang lebih baru.
 */
export async function ambilOtpDenganUid(
  ke: string,
  sejak: Date,
  opsi: Partial<OpsiTunggu> = {},
): Promise<{ otp: string; uid: number }> {
  const email = await tungguEmail({ ke, sejak, subjek: 'OTP Verification', ...opsi });
  const isi = email.teks || email.html.replace(/<[^>]+>/g, ' ');
  const m = isi.match(/OTP\s*:\s*(\d{6})/i);
  if (!m) throw new Error(`Kode OTP tidak ditemukan di email "${email.subjek}" ke ${ke}`);
  return { otp: m[1], uid: email.uid };
}
