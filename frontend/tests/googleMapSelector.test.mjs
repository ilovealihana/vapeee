import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const componentSource = readSource('../src/components/GoogleMapSelector.tsx');
const selectorSource = readSource('../src/pages/CatalogSelector.tsx');
const css = readSource('../src/index.css');

test('google map selector is guarded by the Vite Google Maps key', () => {
  assert.match(componentSource, /VITE_GOOGLE_MAPS_API_KEY/);
  assert.match(componentSource, /googleMap\.unavailableTitle/);
  assert.match(componentSource, /googleMap\.unavailableDescription/);
});

test('google map selector renders only local point markers with coordinates', () => {
  assert.match(componentSource, /CatalogSourceLocation/);
  assert.match(componentSource, /mapMarkerPoints/);
  assert.match(componentSource, /Number\(point\.latitude\)/);
  assert.match(componentSource, /Number\(point\.longitude\)/);
  assert.doesNotMatch(componentSource, /CatalogSourceInpost/);
  assert.doesNotMatch(componentSource, /sources\.inpost/);
});

test('google map selector handles empty coordinates and missing window.google safely', () => {
  assert.match(componentSource, /googleMap\.emptyTitle/);
  assert.match(componentSource, /googleMap\.emptyDescription/);
  assert.match(componentSource, /win\.google/);
  assert.match(componentSource, /setMapState\('unavailable'\)/);
});

test('catalog selector delegates map tab rendering to GoogleMapSelector', () => {
  assert.match(selectorSource, /import GoogleMapSelector from '\.\.\/components\/GoogleMapSelector';/);
  assert.match(selectorSource, /<GoogleMapSelector/);
  assert.match(selectorSource, /cities=\{sources\.cities\}/);
  assert.doesNotMatch(selectorSource, /source-selector-map-fallback/);
});

test('map fallback styles are bounded and reuse selector visuals', () => {
  assert.match(css, /\.google-map-selector/);
  assert.match(css, /\.google-map-selector-canvas/);
  assert.match(css, /\.google-map-selector-state/);
  assert.match(css, /min-height:\s*260px;/);
});

function readSource(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}
