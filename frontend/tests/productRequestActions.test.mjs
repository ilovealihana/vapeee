import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

async function importProductRequestActionsModule() {
  const outDir = await mkdtemp(join(tmpdir(), 'tgs-product-request-actions-'));

  try {
    const source = await readFile(new URL('../src/pages/admin/productRequestActions.ts', import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ES2020,
      },
    });
    const modulePath = join(outDir, 'productRequestActions.mjs');
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

function request(overrides = {}) {
  return {
    id: 1,
    source_type: 'local_point',
    request_type: 'ADD_VARIANT',
    status: 'pending_review',
    requester_tg_id: 200,
    city_id: 1,
    location_id: 10,
    product_id: 20,
    quantity: 1,
    created_at: '2026-07-25T00:00:00Z',
    updated_at: '2026-07-25T00:00:00Z',
    ...overrides,
  };
}

test('product request action rules match roles, statuses and locks', async () => {
  const { module, cleanup } = await importProductRequestActionsModule();
  const { getProductRequestActions } = module;

  try {
    assert.deepEqual(
      getProductRequestActions({
        role: 'point_manager',
        currentTgId: 200,
        request: request({ status: 'need_changes' }),
        isOwnEditableRequest: true,
      }),
      {
        canLock: false,
        canTakeover: false,
        canApprove: false,
        canReject: false,
        canRequestChanges: false,
        canRelease: false,
        canEdit: true,
      },
    );

    assert.equal(getProductRequestActions({
      role: 'city_curator',
      currentTgId: 300,
      request: request(),
      isOwnEditableRequest: false,
    }).canLock, true);

    assert.deepEqual(
      getProductRequestActions({
        role: 'city_curator',
        currentTgId: 300,
        request: request({ locked_by_tg_id: 300 }),
        isOwnEditableRequest: false,
      }),
      {
        canLock: false,
        canTakeover: false,
        canApprove: true,
        canReject: true,
        canRequestChanges: true,
        canRelease: true,
        canEdit: false,
      },
    );

    assert.deepEqual(
      getProductRequestActions({
        role: 'city_curator',
        currentTgId: 300,
        request: request({ locked_by_tg_id: 301 }),
        isOwnEditableRequest: false,
      }),
      {
        canLock: false,
        canTakeover: false,
        canApprove: false,
        canReject: false,
        canRequestChanges: false,
        canRelease: false,
        canEdit: false,
      },
    );

    assert.deepEqual(
      getProductRequestActions({
        role: 'project_admin',
        currentTgId: 400,
        request: request({ locked_by_tg_id: 401 }),
        isOwnEditableRequest: false,
      }),
      {
        canLock: false,
        canTakeover: true,
        canApprove: false,
        canReject: false,
        canRequestChanges: false,
        canRelease: true,
        canEdit: false,
      },
    );

    assert.deepEqual(
      getProductRequestActions({
        role: 'project_admin',
        currentTgId: 400,
        request: request({ locked_by_tg_id: 400 }),
        isOwnEditableRequest: false,
      }),
      {
        canLock: false,
        canTakeover: false,
        canApprove: true,
        canReject: true,
        canRequestChanges: true,
        canRelease: true,
        canEdit: false,
      },
    );

    for (const status of ['approved', 'rejected']) {
      assert.deepEqual(
        getProductRequestActions({
          role: 'project_admin',
          currentTgId: 400,
          request: request({ status, locked_by_tg_id: 400 }),
          isOwnEditableRequest: true,
        }),
        {
          canLock: false,
          canTakeover: false,
          canApprove: false,
          canReject: false,
          canRequestChanges: false,
          canRelease: false,
          canEdit: false,
        },
      );
    }
  } finally {
    await cleanup();
  }
});

test('product request action rules respect request source', async () => {
  const { module, cleanup } = await importProductRequestActionsModule();
  const { getProductRequestActions } = module;

  try {
    assert.deepEqual(
      getProductRequestActions({
        role: 'city_curator',
        currentTgId: 300,
        request: request({ source_type: 'inpost' }),
        isOwnEditableRequest: false,
      }),
      {
        canLock: false,
        canTakeover: false,
        canApprove: false,
        canReject: false,
        canRequestChanges: false,
        canRelease: false,
        canEdit: false,
      },
    );

    assert.equal(getProductRequestActions({
      role: 'city_curator',
      currentTgId: 300,
      request: request({ source_type: 'inpost', locked_by_tg_id: 300 }),
      isOwnEditableRequest: false,
    }).canRelease, false);

    assert.equal(getProductRequestActions({
      role: 'project_admin',
      currentTgId: 400,
      request: request({ source_type: 'inpost' }),
      isOwnEditableRequest: true,
    }).canLock, true);

    assert.equal(getProductRequestActions({
      role: 'inpost_curator',
      currentTgId: 500,
      request: request({ source_type: 'inpost', status: 'need_changes' }),
      isOwnEditableRequest: true,
    }).canEdit, true);
  } finally {
    await cleanup();
  }
});
