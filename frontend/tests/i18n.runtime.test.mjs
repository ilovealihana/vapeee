import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import ts from 'typescript';

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

async function importI18nModule() {
  const outDir = await mkdtemp(join(tmpdir(), 'tgs-i18n-'));

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

async function importUserStoreModule() {
  const outDir = await mkdtemp(join(tmpdir(), 'tgs-user-store-'));

  try {
    await mkdir(join(outDir, 'src', 'api'), { recursive: true });
    await mkdir(join(outDir, 'src', 'i18n', 'locales'), { recursive: true });
    await mkdir(join(outDir, 'src', 'store'), { recursive: true });
    await mkdir(join(outDir, 'node_modules', 'react'), { recursive: true });
    await mkdir(join(outDir, 'node_modules', 'zustand'), { recursive: true });

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
    await writeFile(
      join(outDir, 'node_modules', 'zustand', 'package.json'),
      JSON.stringify({ type: 'module', main: 'index.mjs' }),
      'utf8',
    );
    await writeFile(
      join(outDir, 'node_modules', 'zustand', 'index.mjs'),
      [
        'export function create(initializer) {',
        '  let state;',
        '  const set = (patch) => { state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) }; };',
        '  const get = () => state;',
        '  state = initializer(set, get);',
        '  const store = (selector) => selector ? selector(state) : state;',
        '  store.getState = get;',
        '  store.setState = set;',
        '  return store;',
        '}',
      ].join('\n'),
      'utf8',
    );
    await writeFile(
      join(outDir, 'src', 'api', 'client.mjs'),
      [
        'export const calls = [];',
        'let shouldFail = false;',
        'export function setShouldFail(value) { shouldFail = value; }',
        'export const api = {',
        '  auth: {',
        '    me: async () => ({ id: 1, language_code: "ru" }),',
        '    setLanguage: async (language_code) => {',
        '      calls.push(language_code);',
        '      if (shouldFail) throw new Error("backend failed");',
        '      return { id: 1, language_code };',
        '    },',
        '  },',
        '};',
      ].join('\n'),
      'utf8',
    );

    await compileTsFile('../src/i18n/locales/ru.ts', join(outDir, 'src', 'i18n', 'locales', 'ru.mjs'));
    await compileTsFile('../src/i18n/index.ts', join(outDir, 'src', 'i18n', 'index.mjs'), [
      ["from './locales/ru';", "from './locales/ru.mjs';"],
    ]);
    await compileTsFile('../src/store/user.ts', join(outDir, 'src', 'store', 'user.mjs'), [
      ["from '../api/client';", "from '../api/client.mjs';"],
      ["from '../i18n';", "from '../i18n/index.mjs';"],
    ]);

    return {
      storeModule: await import(pathToFileURL(join(outDir, 'src', 'store', 'user.mjs')).href),
      apiModule: await import(pathToFileURL(join(outDir, 'src', 'api', 'client.mjs')).href),
      cleanup: () => rm(outDir, { recursive: true, force: true }),
    };
  } catch (error) {
    await rm(outDir, { recursive: true, force: true });
    throw error;
  }
}

async function documentedErrorCodes() {
  const source = await readFile(new URL('../../docs/backend/error-handling.md', import.meta.url), 'utf8');
  const codes = new Set();

  for (const match of source.matchAll(/\|\s*`([a-z][a-z0-9_]*\.[a-z0-9_]+)`\s*\|/g)) {
    codes.add(match[1]);
  }

  return [...codes].sort();
}

test('translate returns ru strings and falls back to missing key', async () => {
  const { module, cleanup } = await importI18nModule();
  try {
    assert.equal(module.translate('common.save'), 'Сохранить');
    assert.equal(module.translate('missing.key'), 'missing.key');
  } finally {
    await cleanup();
  }
});

test('locale helpers support planned languages but activate ru in first slice', async () => {
  const { module, cleanup } = await importI18nModule();
  try {
    assert.equal(module.resolveActiveLocale('ru'), 'ru');

    for (const language of ['en', 'pl', 'uk']) {
      assert.equal(module.resolveActiveLocale(language), 'ru');
      assert.equal(module.isSupportedLanguage(language), true);
    }

    assert.equal(module.isSupportedLanguage('ru'), true);
    assert.equal(module.isSupportedLanguage('de'), false);
  } finally {
    await cleanup();
  }
});

test('resolvePreferredLanguage prioritizes backend, storage, Telegram, then ru', async () => {
  const { module, cleanup } = await importI18nModule();
  const originalLocalStorage = globalThis.localStorage;
  const originalWindow = globalThis.window;
  try {
    const storage = new Map();

    globalThis.localStorage = {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    };
    globalThis.window = {
      Telegram: {
        WebApp: {
          initDataUnsafe: {
            user: {
              language_code: 'uk',
            },
          },
        },
      },
    };

    storage.set('vapeshop.language', 'pl');

    assert.equal(module.resolvePreferredLanguage('en'), 'en');
    assert.equal(module.resolvePreferredLanguage('de'), 'pl');
    storage.clear();
    assert.equal(module.resolvePreferredLanguage(undefined), 'uk');

    globalThis.window = undefined;
    assert.equal(module.resolvePreferredLanguage(undefined), 'ru');
  } finally {
    globalThis.localStorage = originalLocalStorage;
    globalThis.window = originalWindow;
    await cleanup();
  }
});

test('storage and Telegram helpers are safe without browser globals', async () => {
  const { module, cleanup } = await importI18nModule();
  const originalLocalStorage = globalThis.localStorage;
  const originalWindow = globalThis.window;
  try {
    delete globalThis.localStorage;
    delete globalThis.window;

    assert.equal(module.readStoredLanguage(), undefined);
    assert.doesNotThrow(() => module.storeLanguage('ru'));
    assert.equal(module.telegramLanguage(), undefined);
    assert.equal(module.resolvePreferredLanguage(), 'ru');
  } finally {
    globalThis.localStorage = originalLocalStorage;
    globalThis.window = originalWindow;
    await cleanup();
  }
});

test('all documented backend error codes have ru translations', async () => {
  const [{ module, cleanup }, codes] = await Promise.all([importI18nModule(), documentedErrorCodes()]);
  try {
    assert.ok(codes.length > 0);

    for (const code of codes) {
      const key = `errors.${code}`;
      assert.notEqual(module.translate(key), key, `${key} is missing`);
    }
  } finally {
    await cleanup();
  }
});

test('user store persists language only after successful backend update', async () => {
  const originalLocalStorage = globalThis.localStorage;
  const originalConsoleError = console.error;
  const storage = new Map();
  const loggedErrors = [];

  let cleanup;
  try {
    globalThis.localStorage = {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    };
    console.error = (...args) => loggedErrors.push(args);

    const userStoreModules = await importUserStoreModule();
    cleanup = userStoreModules.cleanup;
    const { storeModule, apiModule } = userStoreModules;
    const store = storeModule.useUserStore;

    await store.getState().setLanguage('pl');

    assert.deepEqual(apiModule.calls, ['pl']);
    assert.equal(storage.get('vapeshop.language'), 'pl');
    assert.equal(store.getState().language, 'pl');
    assert.equal(store.getState().activeLocale, 'ru');

    apiModule.setShouldFail(true);
    await store.getState().setLanguage('en');

    assert.deepEqual(apiModule.calls, ['pl', 'en']);
    assert.equal(storage.get('vapeshop.language'), 'pl');
    assert.equal(store.getState().language, 'pl');
    assert.equal(store.getState().error, 'backend failed');
    assert.equal(loggedErrors.length, 1);
  } finally {
    globalThis.localStorage = originalLocalStorage;
    console.error = originalConsoleError;
    if (cleanup) {
      await cleanup();
    }
  }
});
