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

test('google map selector fails visibly instead of staying on a blank loading canvas', () => {
  assert.match(componentSource, /GOOGLE_MAPS_LOAD_TIMEOUT_MS/);
  assert.match(componentSource, /gm_authFailure/);
  assert.match(componentSource, /google-map-selector-loading/);
  assert.match(componentSource, /Promise\.race/);
});

test('google map selector does not use async script loading without a callback', () => {
  assert.match(componentSource, /maps\.googleapis\.com\/maps\/api\/js\?key=/);
  assert.doesNotMatch(componentSource, /loading=async/);
});

test('google map selector keeps React loading UI outside the Google-mutated map node', () => {
  assert.match(componentSource, /className="google-map-selector-map" ref=\{mapRef\}/);
  assert.doesNotMatch(componentSource, /className="google-map-selector-canvas" ref=\{mapRef\}>\s*\{mapState === 'loading'/);
  assert.match(css, /\.google-map-selector-map/);
});

test('google map selector uses custom marker taps instead of a list below the map', () => {
  assert.match(componentSource, /importLibrary\('marker'\)/);
  assert.match(componentSource, /AdvancedMarkerElement/);
  assert.match(componentSource, /\/map-marker-r\.png/);
  assert.match(componentSource, /className="google-map-selector-card"/);
  assert.match(componentSource, /setSelectedMarker/);
  assert.match(componentSource, /onSelectLocation\(selectedMarker\.source\)/);
  assert.doesNotMatch(componentSource, /className="google-map-selector-points"/);
  assert.doesNotMatch(componentSource, /markers\.map\(\(marker\) => \(\s*<button key=\{marker\.id\}/);
  assert.match(css, /\.google-map-selector-marker/);
  assert.match(css, /\.google-map-selector-card/);
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
