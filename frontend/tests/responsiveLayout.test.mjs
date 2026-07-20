import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const productsSource = readFileSync(new URL('../src/pages/Products.tsx', import.meta.url), 'utf8');
const cartSource = readFileSync(new URL('../src/pages/Cart.tsx', import.meta.url), 'utf8');
const profileSource = readFileSync(new URL('../src/pages/Profile.tsx', import.meta.url), 'utf8');

test('copied mini app layout fills the viewport without side gutters', () => {
  assert.match(css, /--copied-app-max-width:\s*100vw;/);
  assert.match(css, /\.copied-home-shell,\s*\n\.copied-catalog-shell,\s*\n\.copied-cart-shell,\s*\n\.copied-profile-shell/);
  assert.match(css, /width:\s*100%;\s*\n\s*max-width:\s*var\(--copied-app-max-width\);/);
  assert.match(css, /\.copied-shared-topbar,\s*\n\.copied-shared-bottom-nav,\s*\n\.copied-shared-smoke-bg,\s*\n\.copied-shared-page-title/);
});

test('copied shared fixed bars are pinned to viewport edges without horizontal centering transform', () => {
  assert.match(css, /\.copied-shared-topbar,\s*\n\.copied-shared-bottom-nav,\s*\n\.copied-shared-smoke-bg\s*\{[^}]*left:\s*0;[^}]*right:\s*0;[^}]*transform:\s*none;/s);
  assert.doesNotMatch(css, /\.copied-shared-topbar,\s*\n\.copied-shared-bottom-nav,\s*\n\.copied-shared-smoke-bg\s*\{[^}]*left:\s*50%;[^}]*transform:\s*translateX\(-50%\);/s);
});

test('copied shared header keeps its own backing while page title stays transparent', () => {
  assert.match(css, /\.copied-shared-topbar\s*\{[^}]*background:\s*rgba\(18,\s*20,\s*21,\s*0\.88\) !important;[^}]*backdrop-filter:\s*blur\(12px\) !important;/s);
  assert.match(css, /\.copied-shared-topbar > div\s*\{[^}]*max-width:\s*none !important;/s);
  assert.match(css, /\.copied-shared-page-title\s*\{[^}]*background:\s*transparent !important;[^}]*backdrop-filter:\s*none !important;/s);
});

test('copied page shell does not create a separate full-page backing layer', () => {
  assert.doesNotMatch(
    css,
    /\.copied-home-shell,\s*\n\.copied-catalog-shell,\s*\n\.copied-cart-shell,\s*\n\.copied-profile-shell\s*\{[^}]*background-color:\s*#0d0f10;/s,
  );
  assert.match(
    css,
    /\.copied-home-shell,\s*\n\.copied-catalog-shell,\s*\n\.copied-cart-shell,\s*\n\.copied-profile-shell\s*\{[^}]*background-color:\s*transparent;/s,
  );
});

test('copied mini app layout has small-screen grid fallbacks', () => {
  assert.match(css, /@media \(max-width:\s*340px\)/);
  assert.match(css, /\.copied-catalog-shell \.grid-cols-2/);
  assert.match(css, /grid-template-columns:\s*1fr !important;/);
});

test('copied tab content is not capped by old centered mobile wrappers', () => {
  assert.doesNotMatch(productsSource, /copied-catalog-shell[\s\S]*max-w-md mx-auto/);
  assert.doesNotMatch(profileSource, /copied-profile-shell[\s\S]*max-w-md mx-auto/);
  assert.doesNotMatch(cartSource, /copied-cart-shell[\s\S]*max-w-lg mx-auto/);
});

test('catalog filters stay in normal flow and do not overlap product cards', () => {
  assert.doesNotMatch(productsSource, /<nav class="[^"]*\bsticky\b[^"]*"/);
  assert.doesNotMatch(productsSource, /<nav class="[^"]*\btop-16\b[^"]*"/);
  assert.doesNotMatch(productsSource, /<nav class="[^"]*\bz-40\b[^"]*"/);
  assert.doesNotMatch(productsSource, /<nav class="[^"]*\bbg-background\/95\b[^"]*"/);
  assert.match(productsSource, /<main className="[^"]*\bpt-2\b[^"]*"/);
});

test('catalog exposes a separate two and three column product grid selector', () => {
  assert.match(productsSource, /data-catalog-layout=\{layout\}/);
  assert.match(productsSource, /setLayout\('two'\)/);
  assert.match(productsSource, /setLayout\('three'\)/);
  assert.match(productsSource, /<div className="catalog-filter-bar[^"]*">/);
  assert.match(productsSource, /className=\{`catalog-view-toggle[\s\S]*<nav className="catalog-filter-scroll[^"]*custom-scrollbar[^"]*"/);
  assert.doesNotMatch(productsSource, /<nav className="[^"]*custom-scrollbar[^"]*">\s*<div className=\{`catalog-view-toggle/);
  assert.match(productsSource, /className="catalog-product-grid grid grid-cols-2 gap-4"/);
  assert.match(css, /\.copied-catalog-shell\[data-catalog-layout="two"\] \.catalog-product-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\) !important;/s);
  assert.match(css, /\.copied-catalog-shell\[data-catalog-layout="three"\] \.catalog-product-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\) !important;/s);
  assert.match(css, /\.catalog-view-toggle\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*34px\);[^}]*height:\s*36px;/s);
});

test('catalog grid selector uses React state and keeps the three-column icon inside the active pill', () => {
  assert.match(productsSource, /const \[layout, setLayout\] = useState<'two' \| 'three'>\('three'\)/);
  assert.match(productsSource, /aria-pressed=\{layout === 'three'\}/);
  assert.doesNotMatch(productsSource, /addEventListener\('click',\s*onCatalogClick\)/);
  assert.match(css, /\.catalog-view-icon-three span\s*\{[^}]*width:\s*5px;[^}]*height:\s*5px;/s);
  assert.match(css, /\.catalog-view-icon-three\s*\{[^}]*gap:\s*2px;/s);
});

test('catalog grid selector animates the active pill between two and three column modes', () => {
  assert.match(productsSource, /layout === 'two' \? 'is-two' : 'is-three'/);
  assert.match(productsSource, /setLayout\('two'\)/);
  assert.match(productsSource, /setLayout\('three'\)/);
  assert.match(css, /\.catalog-view-toggle::before\s*\{[^}]*transition:\s*transform 0\.22s cubic-bezier\(0\.2,\s*0\.8,\s*0\.2,\s*1\)/s);
  assert.match(css, /\.catalog-view-toggle\.is-three::before\s*\{[^}]*transform:\s*translateX\(36px\);/s);
  assert.doesNotMatch(css, /\.catalog-view-option\.is-active\s*\{[^}]*background:\s*#3d8489;/s);
});
