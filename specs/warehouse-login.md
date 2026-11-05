<!-- AUTO-GENERATED oleh `npm run import` dari testcases/interstellar-testcases.xlsx. Jangan edit file ini; ubah Excel-nya lalu jalankan ulang. -->
# Warehouse / Login

Simpan file test di folder `tests/warehouse/login/`. Judul test = judul skenario lengkap dengan ID-nya (mis. "TC-WH-LOGIN-001 Halaman login tampil").

### 1. Login
**Seed:** `tests/warehouse/seed.spec.ts`

#### 1.1 TC-WH-LOGIN-001 Halaman login tampil
- **Tipe / prioritas:** Positif · P2
- **Kondisi awal:** BELUM login. Test harus mulai tanpa sesi: `test.use({ storageState: { cookies: [], origins: [] } })`.
- **Catatan:** tests/warehouse/login.spec.ts (helper tests/helpers/login-negatif.ts, dipakai juga BO & CM)

**Steps:**
1. Buka halaman "login"

**Expected Results:**
- Tampil teks "Welcome back! Please enter your details."
- Ada field "Enter your email" dan "Enter your password"
- Ada tombol "Sign in"

#### 1.2 TC-WH-LOGIN-002 Muncul validasi submit data kosong
- **Tipe / prioritas:** Negatif · P3
- **Kondisi awal:** BELUM login. Test harus mulai tanpa sesi: `test.use({ storageState: { cookies: [], origins: [] } })`.
- **Catatan:** tests/warehouse/login.spec.ts

**Steps:**
1. Buka halaman "login"
2. Klik "Sign in"

**Expected Results:**
- Muncul pesan "email is a required field"
- Muncul pesan "password is a required field"
- Tetap di halaman login

#### 1.3 TC-WH-LOGIN-003 Email tidak terdaftar ditolak
- **Tipe / prioritas:** Negatif · P3
- **Kondisi awal:** BELUM login. Test harus mulai tanpa sesi: `test.use({ storageState: { cookies: [], origins: [] } })`.
- **Catatan:** tests/warehouse/login.spec.ts

**Data test:**
- email: e2e-tidak-terdaftar@example.com
- password: Password123!

**Steps:**
1. Buka halaman "login"
2. Isi "Enter your email" dengan email di data test
3. Isi "Enter your password" dengan password di data test
4. Klik "Sign in"

**Expected Results:**
- Muncul notifikasi "Login Failed, The email you entered is not registered"
- Tetap di halaman login
