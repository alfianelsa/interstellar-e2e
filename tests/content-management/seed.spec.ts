import { test } from '../helpers/test';

// Titik awal untuk AI agent (planner/generator/healer). Sesi login sudah dari auth.setup app ini.
// Path relatif TANPA "/" di depan (baseURL sudah berisi path app).
test('seed', async ({ page }) => {
  await page.goto('./');
});
