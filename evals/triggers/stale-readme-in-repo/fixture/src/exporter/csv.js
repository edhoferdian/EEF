import { writeFile } from 'node:fs/promises';
import { loadSales } from '../sales.js';

export async function exportCsv(path, { delimiter = ',' } = {}) {
  const rows = await loadSales();
  const lines = rows.map((r) => [r.date, r.sku, r.qty, r.total].join(delimiter));
  await writeFile(path, ['date,sku,qty,total', ...lines].join('\n'));
}
