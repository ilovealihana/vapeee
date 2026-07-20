import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const frontendRoot = fileURLToPath(new URL('..', import.meta.url));

test('hardcoded UI scanner flags visible text on className lines', () => {
  const root = mkdtempSync(join(tmpdir(), 'ui-string-scan-'));
  try {
    writeFileSync(join(root, 'Fixture.tsx'), `export function Fixture() { return <div className="title">Hardcoded Visible Text</div>; }`);
    const result = spawnSync(
      process.execPath,
      ['scripts/check-hardcoded-ui.mjs'],
      {
        cwd: frontendRoot,
        env: { ...process.env, CHECK_UI_STRINGS_ROOT: root },
        encoding: 'utf8',
      },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Hardcoded Visible Text/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('hardcoded UI scanner flags visible object props beside technical tokens', () => {
  const root = mkdtempSync(join(tmpdir(), 'ui-string-scan-'));
  try {
    writeFileSync(join(root, 'Fixture.tsx'), `export const items = [{ label: 'Hardcoded Visible Label', href: '/x' }, { title: 'Hardcoded Visible Title', icon: 'box' }, { label: 'Hardcoded Code Label', code: 'E_VISIBLE' }];`);
    const result = spawnSync(
      process.execPath,
      ['scripts/check-hardcoded-ui.mjs'],
      {
        cwd: frontendRoot,
        env: { ...process.env, CHECK_UI_STRINGS_ROOT: root },
        encoding: 'utf8',
      },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Hardcoded Visible Label/);
    assert.match(result.stderr, /Hardcoded Visible Title/);
    assert.match(result.stderr, /Hardcoded Code Label/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('hardcoded UI scanner flags JSX text beside allowlisted technical attrs', () => {
  const root = mkdtempSync(join(tmpdir(), 'ui-string-scan-'));
  try {
    writeFileSync(join(root, 'Fixture.tsx'), `export function Fixture() { return <button data-alt="token"><span className="material-symbols-outlined">add</span>Hardcoded Safe Token Label</button>; }\nexport function LowercaseFixture() { return <button><span className="material-symbols-outlined">add</span>checkout</button>; }`);
    const result = spawnSync(
      process.execPath,
      ['scripts/check-hardcoded-ui.mjs'],
      {
        cwd: frontendRoot,
        env: { ...process.env, CHECK_UI_STRINGS_ROOT: root },
        encoding: 'utf8',
      },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Hardcoded Safe Token Label/);
    assert.match(result.stderr, /checkout/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('hardcoded UI scanner flags visible attrs beside translated children', () => {
  const root = mkdtempSync(join(tmpdir(), 'ui-string-scan-'));
  try {
    writeFileSync(join(root, 'Fixture.tsx'), `export function Fixture({ t }) { return <button aria-label="Hardcoded Aria Label" title="Hardcoded Title">{t('common.save')}</button>; }`);
    const result = spawnSync(
      process.execPath,
      ['scripts/check-hardcoded-ui.mjs'],
      {
        cwd: frontendRoot,
        env: { ...process.env, CHECK_UI_STRINGS_ROOT: root },
        encoding: 'utf8',
      },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Hardcoded Aria Label/);
    assert.match(result.stderr, /Hardcoded Title/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('hardcoded UI scanner flags multiline JSX text', () => {
  const root = mkdtempSync(join(tmpdir(), 'ui-string-scan-'));
  try {
    writeFileSync(join(root, 'Fixture.tsx'), `export function Fixture() {\n  return <button>\n    Hardcoded Multiline Text\n  </button>;\n}\n\nexport function SplitFixture() {\n  return <button\n    className="primary"\n  >\n    Hardcoded Split Tag Text\n  </button>;\n}`);
    const result = spawnSync(
      process.execPath,
      ['scripts/check-hardcoded-ui.mjs'],
      {
        cwd: frontendRoot,
        env: { ...process.env, CHECK_UI_STRINGS_ROOT: root },
        encoding: 'utf8',
      },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Hardcoded Multiline Text/);
    assert.match(result.stderr, /Hardcoded Split Tag Text/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('hardcoded UI scanner allowlists locale dictionaries with platform paths', () => {
  const root = mkdtempSync(join(tmpdir(), 'ui-string-scan-'));
  try {
    const localeDir = join(root, 'src', 'i18n', 'locales');
    mkdirSync(localeDir, { recursive: true });
    writeFileSync(join(localeDir, 'ru.ts'), `export default { common: { save: 'Сохранить' } };`);
    const result = spawnSync(
      process.execPath,
      ['scripts/check-hardcoded-ui.mjs'],
      {
        cwd: frontendRoot,
        env: { ...process.env, CHECK_UI_STRINGS_ROOT: root },
        encoding: 'utf8',
      },
    );

    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
