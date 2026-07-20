import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

import {
  COPIED_BOTTOM_NAV_ITEMS,
  COPIED_BOTTOM_NAV_TARGETS,
  COPIED_PAGE_TITLES,
  COPIED_SMOKE_BACKGROUND_IMAGE,
  COPIED_TOP_BAR_TITLE,
  getCopiedBottomNavTarget,
} from '../src/utils/copiedBottomNav.ts';

async function importI18nModule() {
  const outDir = await mkdtemp(join(tmpdir(), 'tgs-copied-nav-i18n-'));

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

async function compileTsFile(sourcePath, modulePath, replacements = []) {
  const source = await readFile(new URL(sourcePath, import.meta.url), 'utf8');
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

test('copied bottom navigation maps tab indexes to app routes', () => {
  assert.deepEqual(COPIED_BOTTOM_NAV_TARGETS, ['/', '/products', '/cart', '/profile']);
  assert.equal(getCopiedBottomNavTarget(0), '/');
  assert.equal(getCopiedBottomNavTarget(1), '/products');
  assert.equal(getCopiedBottomNavTarget(2), '/cart');
  assert.equal(getCopiedBottomNavTarget(3), '/profile');
});

test('copied bottom navigation ignores unknown tab indexes', () => {
  assert.equal(getCopiedBottomNavTarget(-1), null);
  assert.equal(getCopiedBottomNavTarget(4), null);
});

test('copied shared bars expose the copied design configuration', () => {
  assert.equal(COPIED_TOP_BAR_TITLE, 'app.title');
  assert.deepEqual(COPIED_PAGE_TITLES, {
    home: 'nav.home',
    catalog: 'nav.catalog',
    cart: 'nav.cart',
    profile: 'nav.profile',
  });
  assert.match(COPIED_SMOKE_BACKGROUND_IMAGE, /^https:\/\/lh3\.googleusercontent\.com\/aida-public\//);
  assert.deepEqual(
    COPIED_BOTTOM_NAV_ITEMS.map(({ id, labelKey, path, icon }) => ({ id, labelKey, path, icon })),
    [
      { id: 'home', labelKey: 'nav.home', path: '/', icon: 'home' },
      { id: 'catalog', labelKey: 'nav.catalog', path: '/products', icon: 'grid_view' },
      { id: 'cart', labelKey: 'nav.cart', path: '/cart', icon: 'shopping_cart' },
      { id: 'profile', labelKey: 'nav.profile', path: '/profile', icon: 'person' },
    ],
  );
});

test('copied shared bars render labels through i18n keys', () => {
  const bottomNavSource = readSource('../src/components/CopiedBottomNav.tsx');
  const pageTitleSource = readSource('../src/components/CopiedPageTitle.tsx');
  const topBarSource = readSource('../src/components/CopiedTopBar.tsx');

  assert.match(bottomNavSource, /useI18n\(activeLocale\)/);
  assert.match(bottomNavSource, /t\(item\.labelKey\)/);
  assert.match(bottomNavSource, /cartCount = 0/);
  assert.match(pageTitleSource, /useI18n\(activeLocale\)/);
  assert.match(pageTitleSource, /t\(COPIED_PAGE_TITLES\[activeTab\]\)/);
  assert.match(topBarSource, /t\(COPIED_TOP_BAR_TITLE\)/);
  assert.match(topBarSource, /t\('nav\.menu'\)/);
  assert.match(topBarSource, /t\('nav\.notifications'\)/);
});

test('copied shared label keys resolve to ru dictionary strings', async () => {
  const { module, cleanup } = await importI18nModule();
  try {
    const keys = [
      COPIED_TOP_BAR_TITLE,
      ...Object.values(COPIED_PAGE_TITLES),
      ...COPIED_BOTTOM_NAV_ITEMS.map((item) => item.labelKey),
      'nav.menu',
      'nav.notifications',
    ];

    for (const key of keys) {
      assert.notEqual(module.translate(key), key, `${key} is missing`);
    }
  } finally {
    await cleanup();
  }
});

function readSource(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}
