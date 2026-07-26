import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import ts from 'typescript';

const readSource = (path) => readFile(new URL(path, import.meta.url), 'utf8');

async function compileTsFile(sourcePath, modulePath, replacements = []) {
  const source = await readSource(sourcePath);
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ES2020,
    },
  });
  const output = replacements.reduce(
    (result, [from, to]) => result.split(from).join(to),
    compiled.outputText,
  );
  await writeFile(modulePath, output, 'utf8');
}

async function importI18nModule() {
  const outDir = await mkdtemp(join(tmpdir(), 'tgs-i18n-static-'));

  try {
    await mkdir(join(outDir, 'locales'), { recursive: true });
    await mkdir(join(outDir, 'node_modules', 'react'), { recursive: true });
    await writeFile(
      join(outDir, 'node_modules', 'react', 'package.json'),
      JSON.stringify({ type: 'module', main: 'index.mjs' }),
      'utf8',
    );
    await writeFile(
      join(outDir, 'node_modules', 'react', 'index.mjs'),
      'export const useMemo = (factory) => factory();\n',
      'utf8',
    );

    await compileTsFile('../src/i18n/locales/ru.ts', join(outDir, 'locales', 'ru.mjs'));
    await compileTsFile('../src/i18n/index.ts', join(outDir, 'index.mjs'), [
      ["from './locales/ru';", "from './locales/ru.mjs';"],
    ]);

    return {
      module: await import(pathToFileURL(join(outDir, 'index.mjs')).href),
      cleanup: () => rm(outDir, { recursive: true, force: true }),
    };
  } catch (error) {
    await rm(outDir, { recursive: true, force: true });
    throw error;
  }
}

test('i18n module exposes core translation API and ru-only active locales', async () => {
  const source = await readSource('../src/i18n/index.ts');

  assert.match(source, /export\s+function\s+translate/);
  assert.match(source, /export\s+function\s+useI18n/);
  assert.match(source, /ACTIVE_LOCALES\s*=\s*\[\s*['"]ru['"]\s*\]\s+as\s+const/);
  assert.match(source, /return\s+key/);
});

test('ru locale includes required root namespaces', async () => {
  const source = await readSource('../src/i18n/locales/ru.ts');

  for (const namespace of [
    'common',
    'nav',
    'home',
    'catalog',
    'cart',
    'checkout',
    'profile',
    'admin',
    'errors',
    'validation',
  ]) {
    assert.match(source, new RegExp(`\\b${namespace}\\s*:`));
  }
});

test('user store resolves and persists supported preferred language', async () => {
  const source = await readSource('../src/store/user.ts');

  assert.match(source, /language_code/);
  assert.match(source, /resolvePreferredLanguage/);
  assert.match(source, /localStorage|storeLanguage|readStoredLanguage/);
});

test('customer React pages use i18n for visible UI labels', async () => {
  const sources = await Promise.all([
    readSource('../src/pages/Cities.tsx'),
    readSource('../src/pages/Locations.tsx'),
    readSource('../src/pages/ProductDetail.tsx'),
    readSource('../src/pages/OrderSuccess.tsx'),
    readSource('../src/pages/Checkout.tsx'),
  ]);

  for (const source of sources) {
    assert.match(source, /useI18n\(activeLocale\)/);
    assert.match(source, /useUserStore\(\(state\) => state\.activeLocale\)/);
  }

  assert.match(sources[0], /t\('cities\.title'\)/);
  assert.match(sources[1], /t\('locations\.openCatalog'\)/);
  assert.match(sources[2], /formatApiError\(e, t\)/);
  assert.match(sources[2], /const \[loadError, setLoadError\]/);
  assert.match(sources[2], /const \[addError, setAddError\]/);
  assert.match(sources[2], /if \(loadError\) \{[\s\S]*<p>\{loadError\}<\/p>/);
  assert.match(sources[2], /catch \(e: any\) \{\s*setAddError\(formatApiError\(e, t\)\);/);
  assert.match(sources[2], /\{addError && <p[^>]*>\{addError\}<\/p>\}/);
  assert.doesNotMatch(sources[2], /catch \(e: any\) \{\s*setLoadError\(formatApiError\(e, t\)\);/);
  assert.match(sources[2], /t\('productDetail\.addToCart'\)/);
  assert.match(sources[3], /t\('orderSuccess\.description'\)/);
  assert.match(sources[4], /formatApiError\(e, t\)/);
  assert.match(sources[4], /const user = useUserStore\(\(state\) => state\.user\)/);
  assert.match(sources[4], /const contactDefaultsApplied = useRef\(false\)/);
  assert.match(sources[4], /const contactTouchedRef = useRef\(\{ customer_phone: false, customer_email: false \}\)/);
  assert.match(sources[4], /if \(contactDefaultsApplied\.current\) return;/);
  assert.match(sources[4], /contactTouchedRef\.current\[k\] = true;/);
  assert.match(sources[4], /customer_phone: user\?\.phone \?\? ''/);
  assert.match(sources[4], /customer_email: user\?\.email \?\? ''/);
  assert.match(sources[4], /'checkout\.steps\.delivery'/);
  assert.match(sources[4], /t\(STEPS\[step\]\)/);
  assert.match(sources[4], /t\('checkout\.fields\.email'\)/);
  assert.match(sources[4], /placeholder=\{t\('checkout\.placeholders\.deliveryAddress'\)\}/);
  assert.match(sources[4], /t\('checkout\.submit'\)/);
  assert.doesNotMatch(sources[4], />Email<\/label>/);
  assert.doesNotMatch(sources[4], /placeholder="ul\. Przykladowa 1, Wroclaw"/);
});

test('customer copied pages use i18n keys and real cart/catalog flows', async () => {
  const sources = await Promise.all([
    readSource('../src/pages/Home.tsx'),
    readSource('../src/pages/Products.tsx'),
    readSource('../src/pages/Cart.tsx'),
    readSource('../src/pages/Profile.tsx'),
  ]);

  for (const source of sources) {
    assert.match(source, /useI18n\(activeLocale\)/);
    assert.match(source, /useUserStore\(\(state\) => state\.activeLocale\)/);
  }

  assert.match(sources[0], /useCatalogSourceStore/);
  assert.match(sources[3], /buildProfileMarkup\(\{[\s\S]*t,[\s\S]*user,[\s\S]*orders,[\s\S]*hasAdminAccess,[\s\S]*activeLocale/);
  assert.match(sources[3], /activeProfileTab,[\s\S]*editingContactField,[\s\S]*contactSavingField,[\s\S]*contactError/);
  assert.match(sources[0], /t\('home\.greeting'\)/);
  assert.match(sources[0], /t\('home\.popular'\)/);
  assert.match(sources[0], /selectedSource \? '\/products' : '\/catalog-selector'/);
  assert.match(sources[0], /navigate\('\/catalog-selector'\)/);
  assert.match(sources[0], /t\('catalogSelector\.homeSelectSourcePrompt'\)/);
  assert.doesNotMatch(sources[0], /navigate\('\/cities'\)/);
  assert.match(sources[1], /t\('catalog\.viewToggle'\)/);
  assert.match(sources[1], /useParams<\{ locationId: string \}>\(\)/);
  assert.match(sources[1], /const locationId = routeLocationId \|\| queryLocationId/);
  assert.match(sources[1], /location_id: selectedSource\.type === 'local_point' \? selectedSource\.locationId : undefined/);
  assert.match(sources[1], /source: selectedSource\.type === 'inpost' \? 'inpost' : undefined/);
  assert.match(sources[1], /api\.catalog\.products/);
  assert.match(sources[1], /await addItem\([\s\S]*variant\.id,[\s\S]*selectedSource\.type,[\s\S]*\);/);
  assert.match(sources[1], /t\('product\.add'\)/);
  assert.match(sources[2], /t\('cart\.total'\)/);
  assert.match(sources[2], /t\('cart\.checkout'\)/);
  assert.match(sources[2], /await removeItem\(itemId\)/);
  assert.match(sources[2], /navigate\('\/checkout'\)/);
  assert.match(sources[3], /t\('profile\.tabs\.profile'\)/);
  assert.match(sources[3], /t\('profile\.fields\.firstPurchase'\)/);
  assert.match(sources[3], /t\('profile\.contacts\.save'\)/);
  assert.match(sources[3], /t\('profile\.languagePanel\.soon'\)/);
  assert.doesNotMatch(sources[0], />Привет, paranoia!<\/h2>/);
  assert.doesNotMatch(sources[1], />Все<\/button>/);
  assert.doesNotMatch(sources[2], />Оформить заказ<\/span>/);
  assert.doesNotMatch(sources[3], />Профиль<\/span>/);
});

test('customer React page i18n keys resolve to ru strings', async () => {
  const [{ module, cleanup }, ...sources] = await Promise.all([
    importI18nModule(),
    readSource('../src/pages/Cities.tsx'),
    readSource('../src/pages/Locations.tsx'),
    readSource('../src/pages/ProductDetail.tsx'),
    readSource('../src/pages/OrderSuccess.tsx'),
    readSource('../src/pages/Checkout.tsx'),
    readSource('../src/pages/Home.tsx'),
    readSource('../src/pages/Products.tsx'),
    readSource('../src/pages/Cart.tsx'),
    readSource('../src/pages/Profile.tsx'),
  ]);

  try {
    const keys = new Set();
    for (const source of sources) {
      for (const match of source.matchAll(/\bt\('([^']+)'\)/g)) {
        keys.add(match[1]);
      }
      for (const match of source.matchAll(/['"]((?:common|nav|home|catalog|catalogSelector|cart|checkout|cities|locations|productDetail|orderSuccess|product|profile|admin|errors|validation)\.[^'"]+)['"]/g)) {
        keys.add(match[1]);
      }
    }

    assert.ok(keys.size > 0);
    for (const key of keys) {
      assert.notEqual(module.translate(key), key, `${key} is missing`);
    }
  } finally {
    await cleanup();
  }
});
