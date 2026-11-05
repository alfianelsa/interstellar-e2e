// Login API technician (mobile) + OTP email, token disimpan ke .auth/technician.json.
import fs from 'node:fs';
import path from 'node:path';
import { test as setup } from '@playwright/test';
import { FILE_SESI_TECHNICIAN, loginTechnician } from '../helpers/technician';

setup('login akun QA (technician / mobile API)', async () => {
  setup.setTimeout(180_000);
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) throw new Error('E2E_EMAIL / E2E_PASSWORD belum diisi. Copy .env.example jadi .env lalu isi.');
  const token = await loginTechnician(email, password);
  fs.mkdirSync(path.dirname(FILE_SESI_TECHNICIAN), { recursive: true });
  fs.writeFileSync(FILE_SESI_TECHNICIAN, JSON.stringify({ token }));
});
