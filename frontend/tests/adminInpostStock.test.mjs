import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const adminApiSource = readSource('../src/api/admin.ts');
const stockSource = readSource('../src/pages/admin/AdminStock.tsx');
const localeSource = readSource('../src/i18n/locales/ru.ts');
const css = readSource('../src/index.css');

test('admin stock rows and updates carry explicit source type', () => {
  assert.match(adminApiSource, /source_type: 'local_point' \| 'inpost'/);
  assert.match(adminApiSource, /location_id\?: number \| null/);
  assert.match(adminApiSource, /updateStock: \(items: \{ source_type: 'local_point' \| 'inpost'; location_id\?: number \| null; variant_id: number; quantity: number \}\[\]\)/);
});

test('admin stock page exposes Local Point and InPost source filters', () => {
  assert.match(stockSource, /type StockSourceFilter = 'local_point' \| 'inpost'/);
  assert.match(stockSource, /const \[sourceFilter, setSourceFilter\] = useState<StockSourceFilter>\('local_point'\)/);
  assert.match(stockSource, /admin\.stockSources\.localPoint/);
  assert.match(stockSource, /admin\.stockSources\.inpost/);
  assert.match(stockSource, /row\.source_type === sourceFilter/);
});

test('admin stock page keys and saves InPost rows without fake location ids', () => {
  assert.match(stockSource, /`\$\{row\.source_type\}_\$\{row\.location_id \?\? 'inpost'\}_\$\{row\.variant_id\}`/);
  assert.match(stockSource, /source_type: row\.source_type/);
  assert.match(stockSource, /location_id: row\.location_id/);
  assert.doesNotMatch(stockSource, /location_id: row\.location_id \|\| 0/);
});

test('admin InPost stock labels and dark input styling are present', () => {
  assert.match(localeSource, /stockSources:\s*\{/);
  assert.match(localeSource, /localPoint:/);
  assert.match(localeSource, /inpost:/);
  assert.match(css, /\.admin-stock-source-tabs/);
  assert.match(css, /\.admin-qty-control input\.input/);
  assert.match(css, /-webkit-text-fill-color: var\(--primary\) !important;/);
});

function readSource(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}
