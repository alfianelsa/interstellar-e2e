// Dijalankan sekali sebelum semua test: reset log API (lihat catat-api.ts).
import fs from 'node:fs';
import { FILE_LOG } from './catat-api';

export default function globalSetup() {
  fs.rmSync(FILE_LOG, { force: true });
}
