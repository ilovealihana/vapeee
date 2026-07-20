export const COPIED_TOP_BAR_TITLE = 'app.title';

export const COPIED_SMOKE_BACKGROUND_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuA4mHMuf-4dQ3xe9s9a3J3Zp1irS-pEIcEyyhbuV-6V0Y33gruLP0seTNJf2fX8rYQaOMLlBU6ftQa8wXqo1P21E7B3LzTEAQHHpdXmNRxJPX_CsgBMnSsY2lc75agStO8wAO0r39liVhW6RKLzXGnsKVFFlCoAvoQWGVNRhM2Gla3xiDSNFQyzqTFBnz-dQGJRAfVLs3e3ONiQqTZ5lgG1vVpJz8hrEJAj2Bf_zrx1GvtZNgcQDT5Sgj8EiPbapyQrOCXsTn1JDUo';

export const COPIED_PAGE_TITLES = {
  home: 'nav.home',
  catalog: 'nav.catalog',
  cart: 'nav.cart',
  profile: 'nav.profile',
} as const;

export const COPIED_BOTTOM_NAV_ITEMS = [
  { id: 'home', labelKey: 'nav.home', path: '/', icon: 'home' },
  { id: 'catalog', labelKey: 'nav.catalog', path: '/products', icon: 'grid_view' },
  { id: 'cart', labelKey: 'nav.cart', path: '/cart', icon: 'shopping_cart' },
  { id: 'profile', labelKey: 'nav.profile', path: '/profile', icon: 'person' },
] as const;

export const COPIED_BOTTOM_NAV_TARGETS = COPIED_BOTTOM_NAV_ITEMS.map((item) => item.path);
export type CopiedBottomNavItem = (typeof COPIED_BOTTOM_NAV_ITEMS)[number];
export type CopiedBottomNavTab = CopiedBottomNavItem['id'];
export type CopiedBottomNavTarget = CopiedBottomNavItem['path'];

export function getCopiedBottomNavTarget(index: number): CopiedBottomNavTarget | null {
  return COPIED_BOTTOM_NAV_TARGETS[index] ?? null;
}
