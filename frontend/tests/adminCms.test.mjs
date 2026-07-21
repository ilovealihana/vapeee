import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../src/', import.meta.url);
const projectRoot = new URL('../', import.meta.url);
const css = readFileSync(new URL('index.css', root), 'utf8');
const indexHtml = readFileSync(new URL('index.html', projectRoot), 'utf8');
const mainSource = readFileSync(new URL('main.tsx', root), 'utf8');
const appSource = readFileSync(new URL('App.tsx', root), 'utf8');
const adminApiSource = readFileSync(new URL('api/admin.ts', root), 'utf8');
const layoutSource = readFileSync(new URL('pages/admin/AdminLayout.tsx', root), 'utf8');
const citiesSource = readFileSync(new URL('pages/admin/AdminCities.tsx', root), 'utf8');
const productsSource = readFileSync(new URL('pages/admin/AdminProducts.tsx', root), 'utf8');
const stockSource = readFileSync(new URL('pages/admin/AdminStock.tsx', root), 'utf8');
const ordersSource = readFileSync(new URL('pages/admin/AdminOrders.tsx', root), 'utf8');
const staffSource = readFileSync(new URL('pages/admin/AdminStaff.tsx', root), 'utf8');
const uiSource = readFileSync(new URL('pages/admin/AdminUI.tsx', root), 'utf8');
const checkoutSource = readFileSync(new URL('pages/Checkout.tsx', root), 'utf8');
const apiClientSource = readFileSync(new URL('api/client.ts', root), 'utf8');
const locationsSource = readFileSync(new URL('pages/Locations.tsx', root), 'utf8');

test('admin panel uses a shared CMS component layer', () => {
  assert.equal(existsSync(new URL('pages/admin/AdminUI.tsx', root)), true);
  assert.match(uiSource, /export function AdminPageHeader/);
  assert.match(uiSource, /export function AdminModal/);
  assert.match(uiSource, /export function AdminConfirmDialog/);
  assert.match(uiSource, /export function AdminStatusBadge/);
});

test('admin layout is a separate CMS shell with readable navigation labels', () => {
  assert.match(layoutSource, /className="admin-cms-shell"/);
  assert.match(layoutSource, /className="admin-cms-header"/);
  assert.match(layoutSource, /className="admin-cms-tabs"/);
  assert.doesNotMatch(layoutSource, /return null/);
  assert.match(layoutSource, /useI18n\(activeLocale\)/);
  assert.match(layoutSource, /labelKey: 'admin\.layout\.tabs\.cities'/);
  assert.match(layoutSource, /labelKey: 'admin\.layout\.tabs\.products'/);
  assert.match(layoutSource, /labelKey: 'admin\.layout\.tabs\.stock'/);
  assert.match(layoutSource, /labelKey: 'admin\.layout\.tabs\.orders'/);
  assert.match(layoutSource, /t\(tab\.labelKey\)/);
  assert.match(layoutSource, /t\('admin\.layout\.title'\)/);
  assert.match(layoutSource, /t\('admin\.layout\.noAccessTitle'\)/);
  assert.match(layoutSource, /adminApi\.getAccess/);
  assert.doesNotMatch(layoutSource, /VITE_ADMIN_IDS/);
});

test('admin shared UI defaults use i18n keys', () => {
  assert.match(uiSource, /useI18n\(activeLocale\)/);
  assert.match(uiSource, /t\('admin\.common\.close'\)/);
  assert.match(uiSource, /t\('admin\.common\.cancel'\)/);
  assert.match(uiSource, /confirmLabel \|\| t\('admin\.common\.delete'\)/);
});

test('admin city and product CRUD pages use i18n keys for visible labels', () => {
  for (const source of [citiesSource, productsSource]) {
    assert.match(source, /useI18n\(activeLocale\)/);
    assert.match(source, /useUserStore\(\(state\) => state\.activeLocale\)/);
    assert.match(source, /t\('admin\.common\.save'\)/);
    assert.match(source, /AdminConfirmDialog/);
  }

  assert.match(citiesSource, /t\('admin\.cities\.title'\)/);
  assert.match(citiesSource, /t\('admin\.cities\.deleteCityMessage'\)\.replace\('\{name\}', city\.name\)/);
  assert.doesNotMatch(citiesSource, /t\('admin\.fields\.telegramManager'\)/);
  assert.doesNotMatch(citiesSource, /curator_tg_username/);
  assert.match(citiesSource, /loc\.manager_tg_id/);
  assert.match(citiesSource, /t\('admin\.cities\.managerAssigned'\)\.replace\('\{id\}', String\(loc\.manager_tg_id\)\)/);
  assert.match(citiesSource, /t\('admin\.cities\.managerMissing'\)/);
  assert.match(citiesSource, /onClick=\{\(\) => openLocationModal\(city\.id\)\}/);
  assert.match(citiesSource, /aria-label=\{t\('admin\.cities\.addLocation'\)\}/);
  assert.match(productsSource, /t\('admin\.products\.title'\)/);
  assert.match(productsSource, /t\('admin\.products\.deleteVariantMessage'\)\.replace\('\{variant\}', variant\.name_ru\)\.replace\('\{product\}', product\.name_ru\)/);
  assert.match(productsSource, /t\('admin\.fields\.variantPrice'\)/);
  assert.match(productsSource, /function withNameFallback/);
  assert.match(productsSource, /await adminApi\.createVariant\(product\.id/);
  assert.match(productsSource, /onClick=\{\(\) => openVariantModal\(product\.id\)\}/);
  assert.match(productsSource, /aria-label=\{t\('admin\.products\.addVariant'\)\}/);
  assert.match(productsSource, /PRODUCT_NAME_FIELD_LABEL_KEYS/);
  assert.match(productsSource, /t\(PRODUCT_NAME_FIELD_LABEL_KEYS\[field\]\)/);
  assert.doesNotMatch(productsSource, /field\.toUpperCase\(\)/);
  assert.doesNotMatch(citiesSource, /title="Города и точки"/);
  assert.doesNotMatch(productsSource, /title="Товары"/);
});

test('admin stock and orders pages use i18n keys for visible labels', () => {
  for (const source of [stockSource, ordersSource]) {
    assert.match(source, /useI18n\(activeLocale\)/);
    assert.match(source, /useUserStore\(\(state\) => state\.activeLocale\)/);
  }

  assert.match(stockSource, /t\('admin\.stock\.title'\)/);
  assert.match(stockSource, /placeholder=\{t\('admin\.stock\.searchPlaceholder'\)\}/);
  assert.match(stockSource, /t\('admin\.stock\.unsavedChanges'\)\.replace\('\{count\}', String\(editedCount\)\)/);
  assert.match(ordersSource, /labelKey: 'admin\.orders\.filters\.all'/);
  assert.match(ordersSource, /STATUS_LABEL_KEYS/);
  assert.match(ordersSource, /DELIVERY_LABEL_KEYS/);
  assert.match(ordersSource, /t\('admin\.orders\.orderTitle'\)\.replace\('\{id\}', String\(selected\.id\)\)/);
  assert.match(ordersSource, /t\('admin\.orders\.details\.email'\)/);
  assert.match(ordersSource, /t\('admin\.orders\.totals\.total'\)/);
  assert.doesNotMatch(stockSource, /title="Остатки"/);
  assert.doesNotMatch(ordersSource, /title="Заказы"/);
  assert.doesNotMatch(ordersSource, />Email<\/span>/);
});

test('admin staff page is routed and uses cms/i18n patterns', () => {
  assert.match(layoutSource, /labelKey: 'admin\.layout\.tabs\.staff'/);
  assert.match(appSource, /path="staff" element=\{<AdminStaff \/>\}/);
  assert.match(staffSource, /AdminPageHeader/);
  assert.match(staffSource, /AdminConfirmDialog/);
  assert.match(staffSource, /useI18n\(activeLocale\)/);
  assert.match(staffSource, /t\('admin\.staff\.title'\)/);
  assert.match(staffSource, /adminApi\.getStaff/);
  assert.match(staffSource, /adminApi\.createStaff/);
  assert.match(staffSource, /adminApi\.updateStaff/);
  assert.match(staffSource, /adminApi\.deleteStaff/);
  assert.match(staffSource, /adminApi\.getCities/);
  assert.match(staffSource, /adminApi\.getLocations/);
  assert.match(staffSource, /role === 'city_curator'/);
  assert.match(staffSource, /role === 'point_manager'/);
  assert.match(staffSource, /city_ids/);
  assert.match(staffSource, /location_ids/);
  assert.doesNotMatch(staffSource, /<input[^>]+type="(?:number|tel|email)"/);
});

test('admin api exposes staff methods and types', () => {
  assert.match(adminApiSource, /export interface AdminAccess/);
  assert.match(adminApiSource, /getAccess: \(\) => req<AdminAccess>\('\/api\/admin\/access'\)/);
  assert.match(adminApiSource, /export interface AdminStaffMember/);
  assert.match(adminApiSource, /getStaff: \(\) => req<AdminStaffMember\[\]>\('\/api\/admin\/staff'\)/);
  assert.match(adminApiSource, /createStaff:/);
  assert.match(adminApiSource, /updateStaff:/);
  assert.match(adminApiSource, /deleteStaff:/);
});

test('location types expose computed manager catalog availability', () => {
  for (const source of [adminApiSource, apiClientSource]) {
    assert.match(source, /has_manager: boolean/);
    assert.match(source, /manager_tg_id\?: number/);
    assert.match(source, /catalog_available: boolean/);
  }
});

test('customer location list blocks catalog for points without manager', () => {
  assert.match(locationsSource, /loc\.catalog_available/);
  assert.match(locationsSource, /selected\.catalog_available/);
  assert.match(locationsSource, /t\('locations\.comingSoon'\)/);
  assert.match(locationsSource, /disabled=\{!selected\.catalog_available\}/);
  assert.match(locationsSource, /if \(!selected\.catalog_available\) return;/);
  assert.doesNotMatch(locationsSource, /curator_tg_username/);
});

test('admin destructive actions use explicit confirmation dialogs instead of window confirm', () => {
  for (const source of [citiesSource, productsSource]) {
    assert.doesNotMatch(source, /\bconfirm\(/);
    assert.match(source, /AdminConfirmDialog/);
    assert.match(source, /setConfirmAction/);
  }
});

test('admin pages use dense CMS sections and tables', () => {
  for (const source of [citiesSource, productsSource, stockSource, ordersSource]) {
    assert.match(source, /AdminPageHeader/);
    assert.match(source, /admin-cms-table/);
  }
  assert.match(ordersSource, /AdminStatusBadge/);
  assert.match(stockSource, /admin-stock-savebar/);
});

test('admin css defines dense cms composition without user product-card reuse', () => {
  assert.match(css, /\.admin-cms-shell\s*\{/);
  assert.match(css, /\.admin-cms-header\s*\{/);
  assert.match(css, /\.admin-cms-table\s*\{/);
  assert.match(css, /\.admin-cms-row\s*\{/);
  assert.match(css, /\.admin-confirm-dialog\s*\{/);
  assert.doesNotMatch(css, /\.admin-cms-table[\s\S]{0,500}product-card/);
});

test('admin stock inputs force readable dark colors in Telegram webview', () => {
  assert.match(css, /button,\s*input,\s*textarea,\s*select\s*\{[\s\S]*color-scheme:\s*dark;/);
  assert.match(css, /input\.input,\s*textarea\.input,\s*select\.input,\s*\.select\s*\{[\s\S]*background-color:\s*var\(--surface\)\s*!important;/);
  assert.match(css, /input\.input,\s*textarea\.input,\s*select\.input,\s*\.select\s*\{[\s\S]*-webkit-text-fill-color:\s*var\(--primary\)\s*!important;/);
  assert.match(css, /input\.input,\s*textarea\.input,\s*select\.input,\s*\.select\s*\{[\s\S]*-webkit-box-shadow:\s*0 0 0 1000px var\(--surface\) inset\s*!important;/);
  assert.match(css, /\.admin-qty-control input\.input\s*\{[\s\S]*background-color:\s*#101011\s*!important;/);
  assert.match(css, /\.admin-qty-control input\.input\s*\{[\s\S]*-webkit-text-fill-color:\s*var\(--primary\)\s*!important;/);
  assert.match(css, /\.admin-qty-control input\.input\s*\{[\s\S]*-webkit-box-shadow:\s*0 0 0 1000px #101011 inset\s*!important;/);
  assert.doesNotMatch(indexHtml, /plugins=forms/);
  assert.match(indexHtml, /plugins=container-queries/);
  assert.match(mainSource, /installTelegramFormReset/);
  assert.match(mainSource, /id = 'telegram-form-reset'/);
  assert.match(mainSource, /-webkit-box-shadow:\s*0 0 0 1000px #151515 inset !important;/);
  assert.match(mainSource, /\.admin-qty-control input\.input \{[\s\S]*-webkit-box-shadow:\s*0 0 0 1000px #101011 inset !important;/);
});

test('telegram webview forms avoid native light typed fields', () => {
  for (const source of [productsSource, stockSource, checkoutSource]) {
    assert.doesNotMatch(source, /<input[^>]+type="(?:number|tel|email)"/);
  }

  assert.match(productsSource, /<input className="input" type="text" inputMode="decimal" value=\{prodForm\.base_price\}/);
  assert.match(productsSource, /<input className="input" type="text" inputMode="decimal" value=\{varForm\.price_override\}/);
  assert.match(stockSource, /<input className="input" type="text" inputMode="numeric" pattern="\[0-9\]\*" value=\{qty\(row\)\}/);
  assert.match(checkoutSource, /<input className="input"[\s\S]*type="text" inputMode="tel"[\s\S]*placeholder="\+48 500 123 456"/);
  assert.match(checkoutSource, /<input className="input"[\s\S]*type="text" inputMode="email"/);
});
