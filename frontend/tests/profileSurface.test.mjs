import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const profileSource = readFileSync(new URL('../src/pages/Profile.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

async function importProfileInteractionsModule() {
  const outDir = await mkdtemp(join(tmpdir(), 'tgs-profile-interactions-'));

  try {
    const source = await readFile(new URL('../src/pages/profileInteractions.ts', import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ES2020,
      },
    });
    const modulePath = join(outDir, 'profileInteractions.mjs');
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

test('profile info area is transparent over the shared background', () => {
  assert.equal(profileSource.includes('<section class="bg-surface-container rounded-xl overflow-hidden divide-y divide-outline-variant/20">'), false);
  assert.equal(profileSource.includes('class="profile-info-surface divide-y divide-outline-variant/20"'), true);
});

test('profile has functional orders and language tabs with separate panels', () => {
  assert.match(profileSource, /data-profile-tab="orders"/);
  assert.match(profileSource, /data-profile-tab="language"/);
  assert.match(profileSource, /data-profile-panel="orders"/);
  assert.match(profileSource, /data-profile-panel="language"/);
  assert.match(profileSource, /id="profile-tab-profile"[^>]*aria-controls="profile-panel-profile"/);
  assert.match(profileSource, /id="profile-tab-orders"[^>]*aria-controls="profile-panel-orders"/);
  assert.match(profileSource, /id="profile-tab-language"[^>]*aria-controls="profile-panel-language"/);
  assert.match(profileSource, /id="profile-panel-profile"[^>]*role="tabpanel"[^>]*aria-labelledby="profile-tab-profile"/);
  assert.match(profileSource, /id="profile-panel-orders"[^>]*role="tabpanel"[^>]*aria-labelledby="profile-tab-orders"/);
  assert.match(profileSource, /id="profile-panel-language"[^>]*role="tabpanel"[^>]*aria-labelledby="profile-tab-language"/);
  assert.match(profileSource, /tabButtons\.forEach\(\(tab\) => \{/);
  assert.match(profileSource, /panels\.forEach\(\(panel\) => \{/);
  assert.match(profileSource, /panel\.hidden = panel\.dataset\.profilePanel !== nextTab;/);
  assert.match(profileSource, /tab\.setAttribute\('aria-selected', String\(isActive\)\)/);
});

test('profile orders and language panels keep the copied commercial styling', () => {
  assert.match(profileSource, /class="profile-order-card"/);
  assert.match(profileSource, /class="profile-language-option is-selected"/);
  assert.match(css, /\.profile-order-card\s*\{/);
  assert.match(css, /\.profile-language-option\.is-selected\s*\{/);
  assert.match(css, /\.profile-panel\[hidden\]\s*\{/);
});

test('profile renders real user, access and order data instead of hardcoded demo content', () => {
  assert.match(profileSource, /const user = useUserStore\(\(state\) => state\.user\)/);
  assert.match(profileSource, /const \[orders, setOrders\] = useState<Order\[\]>\(\[\]\)/);
  assert.match(profileSource, /api\.orders\.list\(\)/);
  assert.match(profileSource, /adminApi\.getAccess\(\)/);
  assert.match(profileSource, /updateContact\(\{ \[field\]: value \}\)/);
  assert.match(profileSource, /data-profile-contact-edit="\$\{field\}"/);
  assert.match(profileSource, /data-profile-contact-save="\$\{field\}"/);
  assert.match(profileSource, /field: 'phone'/);
  assert.match(profileSource, /field: 'email'/);
  assert.match(profileSource, /buildProfileMarkup\(\{[\s\S]*user,[\s\S]*orders,[\s\S]*hasAdminAccess/);
  assert.match(profileSource, /data-profile-action="admin"/);
  assert.match(profileSource, /orders\.map/);
  assert.match(profileSource, /formatProfileDate\(user\?\.first_order_at/);
  assert.match(profileSource, /const \[activeProfileTab, setActiveProfileTab\] = useState<ProfileTab>\('profile'\)/);
  assert.match(profileSource, /activeTab: activeProfileTab/);
  assert.match(profileSource, /setActiveProfileTab\(nextTab\)/);
  assert.match(profileSource, /profile\.ordersPanel\.emptyTitle/);
  assert.doesNotMatch(profileSource, /profile-order-status done">0/);
  assert.doesNotMatch(profileSource, /formatMoney\(0\)/);
  assert.doesNotMatch(profileSource, /profile\.ordersPanel\.delivery\.pickup'\)} · InPost/);
  assert.doesNotMatch(profileSource, /paranoia/);
  assert.doesNotMatch(profileSource, /shinigami_qq/);
  assert.doesNotMatch(profileSource, /#PL-1028/);
  assert.doesNotMatch(profileSource, /ELFLIQ Pink Lemonade/);
});

test('active profile tabs use the same highlighted color for every tab', () => {
  assert.match(css, /\.copied-profile-shell \[data-profile-tab\]\.active-tab-indicator\s*\{[^}]*color:\s*#8dd2d7 !important;/s);
  assert.match(css, /\.copied-profile-shell \[data-profile-tab\]\.active-tab-indicator \.material-symbols-outlined\s*\{[^}]*color:\s*#8dd2d7 !important;/s);
});

test('profile tab bar divides profile orders and language evenly', () => {
  assert.match(profileSource, /<nav class="profile-tab-nav[^"]*"/);
  assert.match(css, /\.copied-profile-shell \.profile-tab-nav\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/s);
  assert.match(css, /\.copied-profile-shell \.profile-tab-nav \[data-profile-tab\]\s*\{[^}]*justify-content:\s*center;[^}]*min-width:\s*0;/s);
});

test('profile language selector shows future languages but only ru is enabled', () => {
  assert.match(profileSource, /data-profile-language-code="ru"/);
  assert.match(profileSource, /data-profile-language-code="en"/);
  assert.match(profileSource, /data-profile-language-code="pl"/);
  assert.match(profileSource, /data-profile-language-code="uk"/);
  assert.match(profileSource, /data-profile-language-code="ru"[^>]*aria-disabled="false"/);
  assert.match(profileSource, /data-profile-language-code="en"[^>]*aria-disabled="true"[^>]*disabled/);
  assert.match(profileSource, /data-profile-language-code="pl"[^>]*aria-disabled="true"[^>]*disabled/);
  assert.match(profileSource, /data-profile-language-code="uk"[^>]*aria-disabled="true"[^>]*disabled/);
  assert.match(profileSource, /selectProfileLanguage\(button, languageButtons, currentLanguage\)/);
});

test('profile language interaction ignores disabled future languages', async () => {
  const { module, cleanup } = await importProfileInteractionsModule();
  try {
    const makeButton = ({ label, disabled = false, ariaDisabled = 'false' }) => {
      const attributes = new Map([['aria-disabled', ariaDisabled]]);
      const classes = new Set();

      return {
        disabled,
        dataset: { profileLanguage: label },
        classList: {
          toggle: (name, active) => {
            if (active) classes.add(name);
            else classes.delete(name);
          },
        },
        getAttribute: (name) => attributes.get(name) ?? null,
        setAttribute: (name, value) => attributes.set(name, value),
        hasClass: (name) => classes.has(name),
        attr: (name) => attributes.get(name),
      };
    };

    const currentLanguage = { textContent: 'Русский' };
    const ru = makeButton({ label: 'Русский' });
    const en = makeButton({ label: 'English', disabled: true, ariaDisabled: 'true' });
    const pl = makeButton({ label: 'Polski' });
    const buttons = [ru, en, pl];

    assert.equal(module.selectProfileLanguage(en, buttons, currentLanguage), false);
    assert.equal(currentLanguage.textContent, 'Русский');
    assert.equal(en.hasClass('is-selected'), false);
    assert.equal(en.attr('aria-checked'), undefined);

    assert.equal(module.selectProfileLanguage(pl, buttons, currentLanguage), true);
    assert.equal(currentLanguage.textContent, 'Polski');
    assert.equal(pl.hasClass('is-selected'), true);
    assert.equal(pl.attr('aria-checked'), 'true');
    assert.equal(ru.hasClass('is-selected'), false);
    assert.equal(ru.attr('aria-checked'), 'false');
  } finally {
    await cleanup();
  }
});
