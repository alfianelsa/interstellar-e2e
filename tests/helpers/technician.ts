// Helper test API aplikasi mobile technician (Flutter). Playwright tidak bisa menjalankan app Flutter,
// jadi yang dites adalah API-nya (be-technician, /technician/v1) — API yang sama yang dipanggil app.
//
// Login: POST auth/login-technician → OTP ke email → POST auth/check-otp-login → token (Bearer).
// Token disimpan di .auth/technician.json oleh tests/technician/auth.setup.ts.
// Akun harus punya role dengan akses "Field mobile app" atau "King".
// 1 akun = 1 token mobile: login baru menendang sesi app mobile akun QA yang lain.

import fs from 'node:fs';
import { request, type APIRequestContext, type TestInfo } from '@playwright/test';
import { HOST } from './apps';
import { ambilOtp, tandaiInbox } from './email';
import { catatPanggilan } from './catat-api';

export const API_TECHNICIAN = `${HOST}/technician/v1/`;
export const FILE_SESI_TECHNICIAN = '.auth/technician.json';
const ZONA = 'Asia/Jakarta';

export async function loginTechnician(email: string, password: string): Promise<string> {
  const api = await request.newContext({ baseURL: API_TECHNICIAN, extraHTTPHeaders: { 'time-zone': ZONA } });
  try {
    const sejak = new Date();
    const mulaiUid = await tandaiInbox();
    const r = await api.post('auth/login-technician', { data: { email, password }, timeout: 45_000 });
    const body = await r.json().catch(() => ({}));
    if (!r.ok() || !/OTP sent/.test(body?.data?.message ?? '')) {
      throw new Error(`Login technician ditolak server (HTTP ${r.status()}): ${body?.message ?? JSON.stringify(body)}`);
    }
    const otp = await ambilOtp(email, sejak, { mulaiUid });
    const v = await api.post('auth/check-otp-login', { data: { otp, user_id: body.data.user_id } });
    const hasil = await v.json().catch(() => ({}));
    const token = hasil?.data?.token ?? hasil?.token;
    if (!v.ok() || !token) throw new Error(`Verifikasi OTP technician gagal (HTTP ${v.status()}): ${hasil?.message ?? JSON.stringify(hasil)}`);
    return token;
  } finally {
    await api.dispose();
  }
}

/** API context dengan token technician tersimpan. Semua panggilan dicatat untuk laporan cakupan. */
export async function apiTechnician(testInfo: TestInfo) {
  const { token } = JSON.parse(fs.readFileSync(FILE_SESI_TECHNICIAN, 'utf8'));
  const ctx = await request.newContext({
    baseURL: API_TECHNICIAN,
    extraHTTPHeaders: { authorization: `Bearer ${token}`, 'time-zone': ZONA },
  });
  return {
    ctx,
    /** GET + catat. Mengembalikan status & body JSON. */
    async get(path: string, params?: Record<string, string | number>) {
      const r = await ctx.get(path, { params, timeout: 30_000 });
      catatPanggilan('GET', r.url(), r.status(), testInfo);
      return { status: r.status(), body: await r.json().catch(() => null), url: r.url() };
    },
  };
}

export type ApiTechnician = Awaited<ReturnType<typeof apiTechnician>> & { ctx: APIRequestContext };
