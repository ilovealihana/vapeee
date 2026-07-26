import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readSource('../src/App.tsx');
const homeSource = readSource('../src/pages/Home.tsx');
const productsSource = readSource('../src/pages/Products.tsx');
const productDetailSource = readSource('../src/pages/ProductDetail.tsx');
const selectorSource = readSource('../src/pages/CatalogSelector.tsx');
const catalogSourceStoreSource = readSource('../src/store/catalogSource.ts');
const cartSource = readSource('../src/pages/Cart.tsx');
const checkoutSource = readSource('../src/pages/Checkout.tsx');
const bottomNavSource = readSource('../src/components/BottomNav.tsx');
const css = readSource('../src/index.css');

test('customer routes use the global catalog selector entry point', () => {
  assert.match(appSource, /import CatalogSelector from '\.\/pages\/CatalogSelector';/);
  assert.match(appSource, /path="\/catalog-selector" element=\{<CatalogSelector \/>\}/);
  assert.match(appSource, /path="\/cities" element=\{<Navigate to="\/catalog-selector" replace \/>\}/);
  assert.match(appSource, /path="\/cities\/:cityId\/locations" element=\{<Navigate to="\/catalog-selector" replace \/>\}/);
  assert.doesNotMatch(appSource, /path="\/cities" element=\{<Cities \/>\}/);
  assert.doesNotMatch(appSource, /path="\/cities\/:cityId\/locations" element=\{<Locations \/>\}/);
});

test('home drives catalog actions from the selected global source', () => {
  assert.match(homeSource, /useCatalogSourceStore/);
  assert.match(homeSource, /selectedSource/);
  assert.match(homeSource, /selectedSource \? '\/products' : '\/catalog-selector'/);
  assert.match(homeSource, /catalogSelector\.homeSelectSourcePrompt/);
  assert.match(homeSource, /catalogSelector\.homeSelectedSource/);
});

test('selector screen renders in copied catalog shell with list and map tabs', () => {
  assert.match(selectorSource, /CopiedSmokeBackground/);
  assert.match(selectorSource, /CopiedTopBar/);
  assert.match(selectorSource, /CopiedPageTitle activeTab="catalog"/);
  assert.match(selectorSource, /CopiedBottomNav activeTab="catalog"/);
  assert.match(selectorSource, /useCatalogSourceStore/);
  assert.match(selectorSource, /useLocation/);
  assert.match(selectorSource, /returnTo: string/);
  assert.match(selectorSource, /navigate\(backTarget\)/);
  assert.match(selectorSource, /source-selector-tab/);
  assert.match(selectorSource, /catalogSelector\.tabs\.list/);
  assert.match(selectorSource, /catalogSelector\.tabs\.map/);
  assert.match(selectorSource, /catalogSelector\.inpost/);
  assert.match(selectorSource, /catalogSelector\.localPoints/);
  assert.match(selectorSource, /expandedCityId/);
  assert.match(selectorSource, /setExpandedCityId\(expandedCityId === city\.id \? null : city\.id\)/);
  assert.match(selectorSource, /source-selector-point-list \$\{expandedCityId === city\.id \? 'is-open' : ''\}/);
  assert.match(selectorSource, /source-selector-point-list-inner/);
  assert.match(selectorSource, /catalogSelector\.workingHoursFallback/);
  assert.match(selectorSource, /window\.confirm/);
  assert.match(selectorSource, /clearCart/);
  assert.match(selectorSource, /refreshedOnMountRef/);
  assert.match(selectorSource, /loadSources\(\);/);
  assert.doesNotMatch(selectorSource, /if \(!sources && !loading\) loadSources\(\);/);
});

test('products and product detail load by selected catalog source', () => {
  assert.match(productsSource, /useCatalogSourceStore/);
  assert.match(productsSource, /navigate\('\/catalog-selector', \{ state: \{ returnTo: '\/products' \} \}\)/);
  assert.match(productsSource, /navigate\('\/catalog-selector', \{ replace: true \}\)/);
  assert.match(productsSource, /api\.catalog\.products\(\{[\s\S]*location_id: sourceForRequest\.type === 'local_point'/);
  assert.match(productsSource, /source: sourceForRequest\.type === 'inpost' \? 'inpost' : undefined/);
  assert.match(productsSource, /addItem\([\s\S]*variant\.id,[\s\S]*selectedSource\.type === 'local_point' \? selectedSource\.locationId : undefined,[\s\S]*selectedSource\.type,[\s\S]*\);/);
  assert.match(productDetailSource, /useCatalogSourceStore/);
  assert.match(productDetailSource, /api\.catalog\.product\(Number\(productId\), requestParams\)/);
  assert.match(productDetailSource, /addItem\([\s\S]*selectedVariant\.id,[\s\S]*qty,[\s\S]*selectedSource\.type === 'local_point' \? selectedSource\.locationId : undefined,[\s\S]*selectedSource\.type,[\s\S]*\);/);
  assert.match(productsSource, /isSameCatalogSource\(target, selectedSource\)/);
  assert.match(productDetailSource, /isSameCatalogSource\(target, selectedSource\)/);
  assert.match(productsSource, /const urlSource = numericLocationId[\s\S]*findLocationSource\(sources, numericLocationId\)/);
  assert.match(productDetailSource, /const urlSource = Number\.isFinite\(numericLocationId\)[\s\S]*findLocationSource\(sources, numericLocationId\)/);
});

test('cart and checkout block unavailable source states before order creation', () => {
  assert.match(bottomNavSource, /\{ path: '\/products', icon: 'catalog'/);
  assert.match(cartSource, /inactiveItems/);
  assert.match(cartSource, /checkoutBlocked/);
  assert.match(cartSource, /disabled=\{checkoutBlocked\}/);
  assert.match(cartSource, /cart\.availability\.inpostUnavailable/);
  assert.match(checkoutSource, /checkoutBlocked/);
  assert.match(checkoutSource, /source_type: 'local_point'/);
  assert.match(checkoutSource, /checkout\.source\.inpostUnavailable/);
  assert.match(checkoutSource, /cart\.source\?\.type === 'local_point'/);
});

test('selector styles use full-screen copied layout and disabled states', () => {
  assert.match(css, /\.source-selector-main/);
  assert.match(css, /\.source-selector-tabs/);
  assert.match(css, /\.source-selector-city/);
  assert.match(css, /\.source-selector-point\[disabled\]/);
  assert.match(css, /\.source-selector-status/);
  assert.match(css, /\.source-selector-point-list\.is-open/);
  assert.match(css, /transition: grid-template-rows/);
});

test('catalog source store can validate deep-link local point sources', () => {
  assert.match(catalogSourceStoreSource, /findLocationSource/);
  assert.match(catalogSourceStoreSource, /sourceFromApiLocation/);
  assert.match(catalogSourceStoreSource, /writeStoredSource/);
});

function readSource(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}
