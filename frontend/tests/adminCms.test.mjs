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
const ruSource = readFileSync(new URL('i18n/locales/ru.ts', root), 'utf8');
const layoutSource = readFileSync(new URL('pages/admin/AdminLayout.tsx', root), 'utf8');
const citiesSource = readFileSync(new URL('pages/admin/AdminCities.tsx', root), 'utf8');
const productsSource = readFileSync(new URL('pages/admin/AdminProducts.tsx', root), 'utf8');
const stockSource = readFileSync(new URL('pages/admin/AdminStock.tsx', root), 'utf8');
const ordersSource = readFileSync(new URL('pages/admin/AdminOrders.tsx', root), 'utf8');
const staffSource = readFileSync(new URL('pages/admin/AdminStaff.tsx', root), 'utf8');
const productRequestsSource = readFileSync(new URL('pages/admin/AdminProductRequests.tsx', root), 'utf8');
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

test('admin product requests page is routed and uses cms/i18n patterns', () => {
  assert.match(layoutSource, /labelKey: 'admin\.layout\.tabs\.productRequests'/);
  assert.match(layoutSource, /adminRole === 'project_admin'/);
  assert.match(layoutSource, /tab\.roles\.includes\(adminRole as any\)/);
  assert.match(appSource, /import AdminProductRequests from '\.\/pages\/admin\/AdminProductRequests'/);
  assert.match(appSource, /path="product-requests" element=\{<AdminProductRequests \/>\}/);
  assert.match(adminApiSource, /export type ProductRequestType = 'ADD_VARIANT' \| 'ADD_STOCK'/);
  assert.match(adminApiSource, /getProductRequests: \(params\?: \{ mode\?: 'active' \| 'archive'; status\?: ProductRequestStatus \}\)/);
  assert.match(adminApiSource, /createProductRequest:/);
  assert.match(adminApiSource, /approveProductRequest:/);
  assert.match(adminApiSource, /rejectProductRequest:/);
  assert.match(productRequestsSource, /AdminPageHeader/);
  assert.match(productRequestsSource, /AdminModal/);
  assert.match(productRequestsSource, /AdminStatusBadge/);
  assert.match(productRequestsSource, /useI18n\(activeLocale\)/);
  assert.match(productRequestsSource, /t\('admin\.productRequests\.title'\)/);
  assert.match(productRequestsSource, /adminApi\.createProductRequest/);
  assert.match(productRequestsSource, /adminApi\.approveProductRequest/);
  assert.match(productRequestsSource, /adminApi\.rejectProductRequest/);
  assert.match(productRequestsSource, /rejectReason\.trim\(\)/);
  assert.match(productRequestsSource, /adminApi\.getAccess/);
  assert.match(productRequestsSource, /const canCreate = adminRole === 'point_manager'/);
  assert.match(productRequestsSource, /const canReview = adminRole === 'project_admin' \|\| adminRole === 'city_curator'/);
  assert.match(productRequestsSource, /\{canCreate && \(/);
  assert.match(productRequestsSource, /getProductRequestActions\(\{ role: adminRole, currentTgId, request, isOwnEditableRequest \}\)/);
  assert.match(productRequestsSource, /const \[creating,\s*setCreating\] = useState\(false\)/);
  assert.match(productRequestsSource, /const \[reviewing,\s*setReviewing\] = useState<AdminProductRequest \| null>\(null\)/);
  assert.match(productRequestsSource, /openCreateModal/);
  assert.match(productRequestsSource, /closeReviewModal/);
  assert.match(productRequestsSource, /isReviewVerdictPending/);
  assert.match(productRequestsSource, /adminApi\.releaseProductRequest\(reviewing\.id\)/);
  assert.match(productRequestsSource, /setReviewing\(locked\)/);
  assert.match(productRequestsSource, /t\('admin\.productRequests\.openCreate'\)/);
  assert.match(productRequestsSource, /t\('admin\.productRequests\.reviewTitle'\)/);
});

test('admin product request page keeps create and verdict actions in modals', () => {
  assert.match(productRequestsSource, /creating && \(/);
  assert.match(productRequestsSource, /reviewing && \(/);
  assert.match(productRequestsSource, /className="admin-page-actions admin-product-request-create-actions"/);
  assert.match(productRequestsSource, /className="admin-request-review-actions"/);
  assert.doesNotMatch(productRequestsSource, /\{canCreate && \(\s*<div className="admin-cms-section">/);
  assert.doesNotMatch(productRequestsSource, /actions\.canApprove[\s\S]{0,500}<button className="admin-[^"]*button"/);
  assert.doesNotMatch(productRequestsSource, /actions\.canReject[\s\S]{0,500}<button className="admin-[^"]*button"/);
  assert.doesNotMatch(productRequestsSource, /actions\.canRequestChanges[\s\S]{0,500}<button className="admin-[^"]*button"/);
  assert.match(productRequestsSource, /onClose=\{closeReviewModal\}/);
  assert.match(productRequestsSource, /if \(isReviewVerdictPending\) return/);
  assert.match(productRequestsSource, /setReviewCloseError\(e\.message\)/);
});

test('admin product request modal UI keeps spacing alignment and background lock contracts', () => {
  assert.match(productRequestsSource, /className="admin-product-request-filter-divider"/);
  assert.match(css, /\.admin-product-request-filter-divider\s*\{[\s\S]*border-top:\s*1px solid var\(--border\);[\s\S]*margin:\s*0 0 16px;/);
  assert.match(css, /\.admin-product-request-create-actions\s*\{[\s\S]*margin-bottom:\s*14px;/);
  assert.match(css, /\.admin-modal-overlay\s*\{[\s\S]*overscroll-behavior:\s*contain;/);
  assert.match(css, /\.admin-modal\s*,\s*\.admin-confirm-dialog\s*\{[\s\S]*overscroll-behavior:\s*contain;/);
  assert.match(css, /\.admin-modal-footer\s*\{[\s\S]*display:\s*flex;[\s\S]*align-items:\s*stretch;[\s\S]*gap:\s*10px;/);
  assert.match(css, /\.admin-modal-footer\s*>\s*\.admin-request-review-actions\s*\{[\s\S]*flex:\s*1;/);
  assert.match(uiSource, /let adminModalOpenCount = 0/);
  assert.match(uiSource, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(uiSource, /document\.body\.style\.overflow = previousBodyOverflow/);
});

test('admin product request review loop frontend contract is exposed', () => {
  assert.match(adminApiSource, /export type ProductRequestStatus = 'pending_review' \| 'need_changes' \| 'approved' \| 'rejected'/);
  assert.match(adminApiSource, /requester_user_id\?: number/);
  assert.match(adminApiSource, /review_comment\?: string/);
  assert.match(adminApiSource, /locked_by_tg_id\?: number/);
  assert.match(adminApiSource, /locked_at\?: string/);
  assert.match(adminApiSource, /updated_at: string/);
  assert.match(adminApiSource, /export interface ProductRequestUpdatePayload/);
  assert.match(adminApiSource, /variant_name_ru\?: string/);
  assert.match(adminApiSource, /variant_name_pl\?: string/);
  assert.match(adminApiSource, /variant_name_uk\?: string/);
  assert.match(adminApiSource, /price_override\?: string \| null/);
  assert.match(adminApiSource, /quantity\?: number/);
  assert.match(adminApiSource, /getProductRequests: \(params\?: \{ mode\?: 'active' \| 'archive'; status\?: ProductRequestStatus \}\)/);
  assert.match(adminApiSource, /if \(params\?\.mode\) q\.set\('mode', params\.mode\)/);
  assert.match(adminApiSource, /if \(params\?\.status\) q\.set\('status', params\.status\)/);
  assert.match(adminApiSource, /`\/api\/admin\/product-requests\$\{query \? `\?\$\{query\}` : ''\}`/);
  assert.match(adminApiSource, /lockProductRequest: \(id: number\) =>\s*req<AdminProductRequest>\(`\/api\/admin\/product-requests\/\$\{id\}\/lock`, \{ method: 'POST' \}\)/);
  assert.match(adminApiSource, /releaseProductRequest: \(id: number\) =>\s*req<AdminProductRequest>\(`\/api\/admin\/product-requests\/\$\{id\}\/release`, \{ method: 'POST' \}\)/);
  assert.match(adminApiSource, /needChangesProductRequest: \(id: number, comment: string\) =>\s*req<AdminProductRequest>\(`\/api\/admin\/product-requests\/\$\{id\}\/need-changes`, \{[\s\S]*method: 'POST'[\s\S]*body: JSON\.stringify\(\{ comment \}\)/);
  assert.match(adminApiSource, /updateProductRequest: \(id: number, data: ProductRequestUpdatePayload\) =>\s*req<AdminProductRequest>\(`\/api\/admin\/product-requests\/\$\{id\}`, \{[\s\S]*method: 'PATCH'[\s\S]*body: JSON\.stringify\(data\)/);

  assert.match(ruSource, /need_changes: 'Требует изменений'/);
  assert.match(ruSource, /needChanges: 'Запросить изменения'/);
  assert.match(ruSource, /active: 'Активные'/);
  assert.match(ruSource, /archive: 'Архив'/);
  assert.match(ruSource, /allActive: 'Все активные'/);
  assert.match(ruSource, /pendingReview: 'На проверке'/);
  assert.match(ruSource, /needsChanges: 'Требуют изменений'/);
  assert.match(ruSource, /allArchive: 'Весь архив'/);
  assert.match(ruSource, /approved: 'Подтвержденные'/);
  assert.match(ruSource, /rejected: 'Отклоненные'/);
  assert.match(ruSource, /takeReview: 'Взять в проверку'/);
  assert.match(ruSource, /releaseLock: 'Снять блокировку'/);
  assert.match(ruSource, /takeover: 'Перехватить'/);
  assert.match(ruSource, /edit: 'Редактировать'/);
  assert.match(ruSource, /saveChanges: 'Сохранить изменения'/);
  assert.match(ruSource, /reviewComment: 'Комментарий проверки'/);
  assert.match(ruSource, /latestComment: 'Последний комментарий'/);
  assert.match(ruSource, /managerComment: 'Комментарий для менеджера'/);
  assert.match(ruSource, /locked: 'Заявка взята в проверку\.'/);
  assert.match(ruSource, /released: 'Блокировка снята\.'/);
  assert.match(ruSource, /changesRequested: 'Изменения запрошены\.'/);
  assert.match(ruSource, /updated: 'Изменения сохранены\.'/);

  assert.doesNotMatch(productRequestsSource, />\s*(Запросить изменения|Взять в проверку|Снять блокировку|Перехватить|Редактировать|Сохранить изменения)\s*</);
});

test('admin product requests page wires review loop controls', () => {
  assert.match(productRequestsSource, /import \{ getProductRequestActions \} from '\.\/productRequestActions'/);
  assert.match(productRequestsSource, /adminApi\.getProductRequests\(\{ mode, status: selectedStatus \}\)/);
  assert.match(productRequestsSource, /adminApi\.lockProductRequest/);
  assert.match(productRequestsSource, /adminApi\.releaseProductRequest/);
  assert.match(productRequestsSource, /adminApi\.needChangesProductRequest/);
  assert.match(productRequestsSource, /adminApi\.updateProductRequest/);
  assert.match(productRequestsSource, /t\('admin\.productRequests\.modes\.active'\)/);
  assert.match(productRequestsSource, /t\('admin\.productRequests\.modes\.archive'\)/);
  assert.match(productRequestsSource, /t\('admin\.productRequests\.fields\.latestComment'\)/);
  assert.match(productRequestsSource, /request\.review_comment/);
  assert.match(productRequestsSource, /setEditing\(request\)/);
  assert.match(productRequestsSource, /editing && editForm && \(/);
  assert.match(productRequestsSource, /request\.status === 'need_changes'/);
  assert.match(productRequestsSource, /reviewActions\?\.canApprove/);
  assert.match(productRequestsSource, /reviewActions\?\.canReject/);
  assert.match(productRequestsSource, /reviewActions\?\.canRequestChanges/);
  assert.doesNotMatch(productRequestsSource, /\{canReview && request\.status === 'pending_review' && \(/);
});

test('admin layout guards direct child routes by role', () => {
  assert.match(layoutSource, /useLocation/);
  assert.match(layoutSource, /const allowedTabs = tabs\.filter/);
  assert.match(layoutSource, /allowedTabs\.some\(\(tab\) => tab\.path === location\.pathname\)/);
  assert.match(layoutSource, /navigate\('\/admin\/product-requests', \{ replace: true \}\)/);
  assert.doesNotMatch(layoutSource, /adminRole \|\| 'Admin'/);
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

test('admin location form uses Google Places autocomplete for address suggestions', () => {
  assert.match(citiesSource, /locAddressInputRef/);
  assert.match(citiesSource, /VITE_GOOGLE_MAPS_API_KEY/);
  assert.match(citiesSource, /libraries=places/);
  assert.match(citiesSource, /maps\?\.places\?\.Autocomplete/);
  assert.match(citiesSource, /componentRestrictions:\s*\{\s*country:\s*'pl'\s*\}/);
  assert.match(citiesSource, /fields:\s*\['formatted_address', 'geometry', 'name'\]/);
  assert.match(citiesSource, /place_changed/);
  assert.match(citiesSource, /setLocForm\(f => \(\{ \.\.\.f, address \}\)\)/);
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
  assert.match(staffSource, /adminApi\.hardDeleteStaff/);
  assert.match(staffSource, /adminApi\.getCities/);
  assert.match(staffSource, /adminApi\.getLocations/);
  assert.match(staffSource, /role === 'city_curator'/);
  assert.match(staffSource, /role === 'point_manager'/);
  assert.match(staffSource, /availableLocationsByCity/);
  assert.match(staffSource, /!location\.manager_tg_id \|\| location\.manager_tg_id === editStaff\?\.tg_id/);
  assert.match(staffSource, /t\('admin\.staff\.deleteTitle'\)/);
  assert.match(staffSource, /t\('admin\.staff\.deleteAria'\)/);
  assert.match(staffSource, /city_ids/);
  assert.match(staffSource, /location_ids/);
  assert.match(staffSource, /username: member\.username \|\| ''/);
  assert.match(staffSource, /t\('admin\.staff\.telegramUsername'\)/);
  assert.match(staffSource, /username: form\.username\.trim\(\)/);
  assert.doesNotMatch(staffSource, /<input[^>]+type="(?:number|tel|email)"/);
});

test('admin api exposes staff methods and types', () => {
  assert.match(adminApiSource, /export interface AdminAccess/);
  assert.match(adminApiSource, /getAccess: \(\) => req<AdminAccess>\('\/api\/admin\/access'\)/);
  assert.match(adminApiSource, /export interface AdminStaffMember/);
  assert.match(adminApiSource, /username\?: string/);
  assert.match(adminApiSource, /getStaff: \(\) => req<AdminStaffMember\[\]>\('\/api\/admin\/staff'\)/);
  assert.match(adminApiSource, /createStaff:/);
  assert.match(adminApiSource, /updateStaff:/);
  assert.match(adminApiSource, /deleteStaff:/);
  assert.match(adminApiSource, /hardDeleteStaff:/);
  assert.match(adminApiSource, /\/api\/admin\/staff\/\$\{id\}\/hard-delete/);
});

test('location types expose computed manager catalog availability', () => {
  for (const source of [adminApiSource, apiClientSource]) {
    assert.match(source, /has_manager: boolean/);
    assert.match(source, /manager_tg_id\?: number/);
    assert.match(source, /manager_tg_username\?: string/);
    assert.match(source, /catalog_available: boolean/);
  }
});

test('customer location list blocks catalog for points without manager', () => {
  assert.match(locationsSource, /loc\.catalog_available/);
  assert.match(locationsSource, /selected\.catalog_available/);
  assert.match(locationsSource, /selected\.manager_tg_username/);
  assert.match(locationsSource, /function openTelegramUsername/);
  assert.match(locationsSource, /https:\/\/t\.me\/\$\{username\}/);
  assert.match(locationsSource, /openTelegramLink\(url\)/);
  assert.match(locationsSource, /window\.location\.href = url/);
  assert.match(locationsSource, /onClick=\{\(\) => openTelegramUsername\(selected\.manager_tg_username!\)\}/);
  assert.match(locationsSource, /t\('locations\.contactManager'\)/);
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

test('admin product request rows stay readable on narrow mobile screens', () => {
  assert.match(css, /\.admin-request-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
  assert.match(css, /\.admin-request-meta\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-wrap:\s*wrap;/);
  assert.match(css, /\.admin-request-actions\s*\{[\s\S]*grid-column:\s*1;[\s\S]*justify-content:\s*flex-start;/);
  assert.match(productRequestsSource, /className="admin-request-meta"/);
  assert.match(productRequestsSource, /className="admin-request-actions admin-row-actions"/);
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
  assert.match(css, /\.input::placeholder\s*\{[\s\S]*rgba\(119,\s*119,\s*123,\s*0\.42\)/);
  assert.match(css, /\.input::placeholder\s*\{[\s\S]*-webkit-text-fill-color:\s*rgba\(119,\s*119,\s*123,\s*0\.42\);/);
  assert.match(mainSource, /input\.input::placeholder,\s*textarea\.input::placeholder\s*\{[\s\S]*rgba\(119,\s*119,\s*123,\s*0\.42\)\s*!important;/);
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
