import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import ts from 'typescript';

async function importErrorsModule() {
  const outDir = await mkdtemp(join(tmpdir(), 'tgs-api-errors-'));

  try {
    const source = await readFile(new URL('../src/api/errors.ts', import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ES2020,
      },
    });
    const modulePath = join(outDir, 'errors.mjs');
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

const response = (status, payload) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const textResponse = (status, body) =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain' },
  });

const t = (key, params = {}) => {
  const messages = {
    'errors.common.internal_error': 'Generic localized error',
    'errors.cart.empty': 'Cart is empty localized',
    'validation.required': 'Required field.',
    'validation.too_short': 'Minimum length: {min}.',
  };
  const template = messages[key] ?? key;

  return Object.entries(params).reduce(
    (message, [name, value]) => message.replaceAll(`{${name}}`, String(value)),
    template,
  );
};

test('parseApiError returns ApiClientError for canonical backend envelope', async () => {
  const { module, cleanup } = await importErrorsModule();
  try {
    const { ApiClientError, parseApiError } = module;

    const error = await parseApiError(
      response(409, {
        code: 'cart.empty',
        message: 'Cart is empty',
        details: { cart_id: 12 },
      }),
    );

    assert.ok(error instanceof ApiClientError);
    assert.equal(error.status, 409);
    assert.equal(error.code, 'cart.empty');
    assert.equal(error.message, 'Cart is empty');
    assert.deepEqual(error.details, { cart_id: 12 });
  } finally {
    await cleanup();
  }
});

test('formatApiError falls back to localized generic error for unknown code', async () => {
  const { module, cleanup } = await importErrorsModule();
  try {
    const { ApiClientError, formatApiError } = module;
    const error = new ApiClientError(500, 'unknown.code', 'Unknown', {});

    assert.equal(formatApiError(error, t), 'Generic localized error');
  } finally {
    await cleanup();
  }
});

test('parseApiError handles non-json and legacy detail responses', async () => {
  const { module, cleanup } = await importErrorsModule();
  try {
    const { parseApiError } = module;

    const nonJson = await parseApiError(textResponse(502, 'Gateway broke'));
    assert.equal(nonJson.status, 502);
    assert.equal(nonJson.code, 'common.internal_error');
    assert.equal(nonJson.message, 'HTTP 502');
    assert.deepEqual(nonJson.details, {});

    const legacy = await parseApiError(response(400, { detail: 'Legacy detail' }));
    assert.equal(legacy.status, 400);
    assert.equal(legacy.code, 'common.internal_error');
    assert.equal(legacy.message, 'Legacy detail');
    assert.deepEqual(legacy.details, {});
  } finally {
    await cleanup();
  }
});

test('parseApiError ignores malformed details payloads', async () => {
  const { module, cleanup } = await importErrorsModule();
  try {
    const { parseApiError } = module;

    const error = await parseApiError(
      response(404, {
        code: 'catalog.product_not_found',
        message: 'Product not found',
        details: [],
      }),
    );

    assert.equal(error.code, 'catalog.product_not_found');
    assert.deepEqual(error.details, {});
  } finally {
    await cleanup();
  }
});

test('formatValidationFieldErrors interpolates validation params and accepts canonical codes', async () => {
  const { module, cleanup } = await importErrorsModule();
  try {
    const { ApiClientError, formatValidationFieldErrors } = module;
    const error = new ApiClientError(422, 'validation.failed', 'Validation failed', {
      fields: [
        { field: 'name', code: 'too_short', params: { min: 3 } },
        { field: 'email', code: 'validation.required', params: {} },
        { field: 'phone', code: 'bad_phone', params: {} },
      ],
    });

    assert.deepEqual(formatValidationFieldErrors(error, t), {
      name: 'Minimum length: 3.',
      email: 'Required field.',
      phone: 'Generic localized error',
    });
  } finally {
    await cleanup();
  }
});

test('formatValidationFieldErrors ignores invalid field entries', async () => {
  const { module, cleanup } = await importErrorsModule();
  try {
    const { ApiClientError, formatValidationFieldErrors } = module;
    const error = new ApiClientError(422, 'validation.failed', 'Validation failed', {
      fields: [
        null,
        { field: 'missing_code' },
        { code: 'required' },
        { field: 'valid', code: 'validation.required', params: [] },
      ],
    });

    assert.deepEqual(formatValidationFieldErrors(error, t), {
      valid: 'Required field.',
    });
  } finally {
    await cleanup();
  }
});
