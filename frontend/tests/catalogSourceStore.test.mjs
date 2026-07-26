import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

async function importCatalogSourceModule() {
  const outDir = await mkdtemp(join(tmpdir(), 'tgs-catalog-source-'));
  try {
    await mkdir(join(outDir, 'node_modules', 'zustand'), { recursive: true });
    await writeFile(
      join(outDir, 'node_modules', 'zustand', 'package.json'),
      JSON.stringify({ type: 'module', main: 'index.mjs' }),
      'utf8',
    );
    await writeFile(
      join(outDir, 'node_modules', 'zustand', 'index.mjs'),
      'export const create = (factory) => factory(() => {}, () => ({}));\n',
      'utf8',
    );

    const source = await readFile(new URL('../src/store/catalogSource.ts', import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ES2020,
      },
    });
    const modulePath = join(outDir, 'catalogSource.mjs');
    await writeFile(modulePath, compiled.outputText, 'utf8');

    return {
      module: await import(pathToFileURL(modulePath).href),
      cleanup: () => rm(outDir, { recursive: true, force: true }),
    };
  } catch (error) {
    await rm(outDir, { recursive: true, force: true });
    throw error;
  }
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    snapshot: () => Object.fromEntries(values.entries()),
  };
}

const sources = {
  inpost: { type: 'inpost', status: 'inactive', stock_count: 4 },
  cities: [
    {
      id: 1,
      name: 'Wroclaw',
      locations: [
        {
          type: 'local_point',
          id: 10,
          city_id: 1,
          name: 'Center',
          address: 'Main 1',
          status: 'available',
          catalog_available: true,
          stock_count: 3,
        },
      ],
    },
  ],
};

test('backend cart source wins over stored source', async () => {
  const { module, cleanup } = await importCatalogSourceModule();
  try {
    const storage = memoryStorage({
      [module.CATALOG_SOURCE_STORAGE_KEY]: JSON.stringify({ type: 'inpost', status: 'inactive' }),
    });
    const resolved = module.resolveSelectedSource({
      cart: { source: { type: 'local_point', location_id: 10, status: 'available' }, items: [{ id: 1 }] },
      sources,
      storage,
    });

    assert.deepEqual(resolved, {
      type: 'local_point',
      locationId: 10,
      cityId: 1,
      name: 'Center',
      status: 'available',
    });
  } finally {
    await cleanup();
  }
});

test('empty cart falls back to valid localStorage source', async () => {
  const { module, cleanup } = await importCatalogSourceModule();
  try {
    const storage = memoryStorage({
      [module.CATALOG_SOURCE_STORAGE_KEY]: JSON.stringify({
        type: 'local_point',
        locationId: 10,
        cityId: 1,
        name: 'Center',
        status: 'available',
      }),
    });

    const resolved = module.resolveSelectedSource({
      cart: { source: null, items: [] },
      sources,
      storage,
    });

    assert.equal(resolved?.type, 'local_point');
    assert.equal(resolved?.locationId, 10);
  } finally {
    await cleanup();
  }
});

test('invalid remembered source is cleared', async () => {
  const { module, cleanup } = await importCatalogSourceModule();
  try {
    const storage = memoryStorage({
      [module.CATALOG_SOURCE_STORAGE_KEY]: JSON.stringify({
        type: 'local_point',
        locationId: 999,
        cityId: 1,
        name: 'Missing',
        status: 'available',
      }),
    });

    const resolved = module.resolveSelectedSource({
      cart: { source: null, items: [] },
      sources,
      storage,
    });

    assert.equal(resolved, null);
    assert.deepEqual(storage.snapshot(), {});
  } finally {
    await cleanup();
  }
});

test('non-empty cart source switch clears cart before applying target source', async () => {
  const { module, cleanup } = await importCatalogSourceModule();
  try {
    let clearCalls = 0;
    const storage = memoryStorage();
    const target = module.sourceFromApiLocation(sources.cities[0].locations[0]);
    const result = await module.applySourceSwitch({
      target,
      cart: { source: { type: 'inpost', status: 'inactive' }, items: [{ id: 1 }] },
      clearCart: async () => {
        clearCalls += 1;
      },
      storage,
    });

    assert.equal(clearCalls, 1);
    assert.deepEqual(result, target);
    assert.equal(JSON.parse(storage.snapshot()[module.CATALOG_SOURCE_STORAGE_KEY]).locationId, 10);
  } finally {
    await cleanup();
  }
});

test('clear cart failure keeps current source', async () => {
  const { module, cleanup } = await importCatalogSourceModule();
  try {
    const current = { type: 'inpost', status: 'inactive' };
    const target = module.sourceFromApiLocation(sources.cities[0].locations[0]);
    await assert.rejects(
      () => module.applySourceSwitch({
        target,
        current,
        cart: { source: { type: 'inpost', status: 'inactive' }, items: [{ id: 1 }] },
        clearCart: async () => {
          throw new Error('clear failed');
        },
        storage: memoryStorage(),
      }),
      /clear failed/,
    );
  } finally {
    await cleanup();
  }
});
