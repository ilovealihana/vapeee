import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.env.CHECK_UI_STRINGS_ROOT || fileURLToPath(new URL('../src', import.meta.url));
const allowedPaths = [
  /src\/i18n\/locales\//,
  /src\/assets\//,
  /src\/api\//,
  /src\/main\.ts$/,
];
const extensions = new Set(['.ts', '.tsx']);
const sameLineText = /<[\w.:-][^>]*>\s*([^<>{}]*\p{L}[\p{L}\p{N}\s.,!?:"'()/-]{2,})\s*<\/[\w.:-]+>/gu;
const nestedTrailingText = /<\/[\w.:-]+>\s*([^<>{}]*\p{L}[\p{L}\p{N}\s.,!?:"'()/-]{2,})\s*<\/[\w.:-]+>/gu;
const attrText = /(?:aria-label|placeholder|title)=(?:"([^"]*\p{L}[^"]*)"|'([^']*\p{L}[^']*)')/gu;
const objectText = /(?:title|subtitle|message|confirmLabel|label|description):\s*["']([^"']*\p{L}[^"']*)["']/gu;
const safeCandidate = /^(?:\$\{t\('[^']+'\)\}|Wroclaw|wroclaw|username|ELFLIQ|LOST MARY|XROS 3 Mini|Vaporesso Pods|Elf Bar 1500|CHASER|Pink Lemonade|Blue Razz Ice|Blue Razz Lemonade|Cotton Candy|Black Matte|Elfjacks|Triple Berry|CHASER Triple Berry|ELFLIQ Pink Lemonade|0\.6 Ohm \/ 4pcs|1500 puffs|Pods|Device|paranoia|Admin|#[A-Z]{2}-\d+|GitHub|Discord|X\.com|Bluesky|InPost|Email)$/;
const failures = [];

function normalizePath(path) {
  return path.split(sep).join('/');
}

function hasLetters(value) {
  return /\p{L}/u.test(value);
}

function addCandidate(normalized, line, lineNumber, value) {
  const text = value.trim();
  if (!text || !hasLetters(text)) return;
  if (/^product\.flavor\./.test(text)) return;
  if (safeCandidate.test(text)) return;
  failures.push(`${normalized}:${lineNumber}: ${line.trim()}`);
}

function findOpeningTagEnd(lines, index) {
  if (!/<[\w.:-][^>]*>?/.test(lines[index])) return null;

  for (let offset = 0; index + offset < lines.length && offset <= 4; offset += 1) {
    const next = lines[index + offset];
    if (/<\/[\w.:-]+>/.test(next) || /\/>\s*[),;]?\s*$/.test(next)) return null;
    if (/>/.test(next)) return index + offset;
  }
  return null;
}

function collectMultilineText(lines, index) {
  const tagEndIndex = findOpeningTagEnd(lines, index);
  if (tagEndIndex === null) return null;

  const parts = [];
  for (let lineIndex = tagEndIndex + 1; lineIndex < lines.length && lineIndex <= tagEndIndex + 4; lineIndex += 1) {
    const next = lines[lineIndex];
    if (/^\s*<\/[\w.:-]+>\s*[),;]?\s*$/.test(next)) return parts.length ? { text: parts.join(' '), lineIndex: tagEndIndex + 1 } : null;
    if (/[<>{}`]/.test(next)) return null;
    parts.push(next.trim());
  }
  return null;
}

function scanLine(normalized, lines, index) {
  const line = lines[index];

  for (const match of line.matchAll(sameLineText)) {
    if (/material-symbols/.test(match[0]) && /^[a-z_]+$/.test(match[1].trim())) continue;
    addCandidate(normalized, line, index + 1, match[1]);
  }
  for (const match of line.matchAll(nestedTrailingText)) {
    addCandidate(normalized, line, index + 1, match[1]);
  }
  for (const match of line.matchAll(attrText)) {
    addCandidate(normalized, line, index + 1, match[1] ?? match[2]);
  }
  for (const match of line.matchAll(objectText)) {
    addCandidate(normalized, line, index + 1, match[1]);
  }

  const multiline = collectMultilineText(lines, index);
  if (multiline) addCandidate(normalized, lines[multiline.lineIndex], multiline.lineIndex + 1, multiline.text);
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path);
      continue;
    }
    if (!extensions.has(extname(path))) continue;
    const normalized = normalizePath(path);
    if (allowedPaths.some((pattern) => pattern.test(normalized))) continue;
    const lines = readFileSync(path, 'utf8').split(/\r?\n/);
    lines.forEach((_, index) => scanLine(normalized, lines, index));
  }
}

walk(root);

if (failures.length) {
  console.error('Hardcoded UI strings found:');
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('No obvious hardcoded UI strings found.');
