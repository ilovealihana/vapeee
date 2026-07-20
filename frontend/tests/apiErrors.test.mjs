import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const readSource = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('api errors module exposes canonical error parser and formatters', async () => {
  const source = await readSource('../src/api/errors.ts');

  assert.match(source, /export\s+type\s+ApiErrorDetails\s*=\s*Record<string,\s*unknown>/);
  assert.match(source, /export\s+interface\s+ApiErrorResponse[\s\S]*code\?\s*:\s*string/);
  assert.match(source, /export\s+interface\s+ApiErrorResponse[\s\S]*message\?\s*:\s*string/);
  assert.match(source, /export\s+interface\s+ApiErrorResponse[\s\S]*details\?\s*:\s*ApiErrorDetails/);
  assert.match(source, /export\s+interface\s+ApiErrorResponse[\s\S]*detail\?\s*:\s*unknown/);
  assert.match(source, /export\s+class\s+ApiClientError\s+extends\s+Error/);
  assert.match(source, /code\s*:\s*string/);
  assert.match(source, /details\s*:\s*Record<string,\s*unknown>/);
  assert.match(source, /export\s+async\s+function\s+parseApiError/);
  assert.match(source, /export\s+function\s+formatApiError/);
  assert.match(source, /export\s+function\s+formatValidationFieldErrors/);
  assert.match(source, /common\.internal_error/);
});

test('api clients use shared parser instead of legacy detail error', async () => {
  const [clientSource, adminSource] = await Promise.all([
    readSource('../src/api/client.ts'),
    readSource('../src/api/admin.ts'),
  ]);

  for (const source of [clientSource, adminSource]) {
    assert.match(source, /import\s+\{\s*parseApiError\s*\}\s+from\s+['"]\.\/errors['"]/);
    assert.match(source, /throw\s+await\s+parseApiError\(res\)/);
    assert.doesNotMatch(source, /throw\s+new\s+Error\(err\.detail/);
  }
});
