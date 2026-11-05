# Specs — rencana test untuk AI generator

QA pakai **Cursor**: contoh prompt generate/healer ada di **`AGENTS.md`** (root repo).

File `.md` di folder ini **dibuat otomatis** dari Excel `testcases/*.xlsx` dengan:

```bash
npm run import
```

1 modul = 1 file (mis. `login.md`). Cuma test case dengan **Otomasi? = Ya** yang masuk.

- **Jangan edit** file yang baris pertamanya `AUTO-GENERATED`. Ubah Excel-nya, lalu jalankan `npm run import` lagi. Edit manual akan hilang.
- Draft dari agent **planner** boleh disimpan di sini dengan nama lain (mis. `draft-billing.md`). Pindahkan isinya ke Excel kalau sudah final.
- Cek Excel tanpa menulis file: `npm run import -- --check`.
