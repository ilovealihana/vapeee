import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../api/admin';
import { api, type Order, type User } from '../api/client';
import CopiedBottomNav from '../components/CopiedBottomNav';
import CopiedPageTitle from '../components/CopiedPageTitle';
import CopiedSmokeBackground from '../components/CopiedSmokeBackground';
import CopiedTopBar from '../components/CopiedTopBar';
import { type ActiveLocale, useI18n } from '../i18n';
import { useCartStore } from '../store/cart';
import { useUserStore } from '../store/user';
import { selectProfileLanguage } from './profileInteractions';

type Translate = (key: string) => string;

type OrderItem = {
  quantity?: number;
  variant_id?: number;
  product_name?: string;
  name?: string;
  variant?: {
    name_ru?: string;
    name_pl?: string;
    name_uk?: string;
  };
  product?: {
    name_ru?: string;
    name_pl?: string;
    name_uk?: string;
  };
};

type ProfileTab = 'profile' | 'orders' | 'language';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function dash(value?: string | number | null): string {
  if (value === undefined || value === null || value === '') {
    return '<span class="text-on-surface font-body-md text-body-md text-opacity-40">—</span>';
  }

  return `<span class="text-on-surface font-body-md text-body-md">${escapeHtml(value)}</span>`;
}

function displayName(user: User | null, t: Translate): string {
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
  return fullName || user?.username || t('profile.title');
}

function initial(user: User | null, t: Translate): string {
  const source = displayName(user, t).trim();
  return source ? source.charAt(0).toUpperCase() : '?';
}

function formatProfileDate(dateStr?: string, locale = 'ru-RU'): string {
  if (!dateStr) return '—';

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat(locale).format(date);
}

function formatOrderDate(dateStr?: string, locale = 'ru-RU'): string {
  if (!dateStr) return '—';

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function orderStatusClass(status: string): string {
  return status === 'completed' || status === 'ready' ? 'done' : 'active';
}

function orderStatusLabel(status: string, t: Translate): string {
  const knownStatuses = new Set(['new', 'confirmed', 'ready', 'completed', 'cancelled', 'processing']);
  if (!knownStatuses.has(status)) return status;

  const key = `profile.ordersPanel.status.${status}`;
  const label = t(key);
  return label === key ? status : label;
}

function deliveryLabel(type: string, t: Translate): string {
  if (type === 'pickup') return t('profile.ordersPanel.delivery.pickup');
  if (type === 'door_delivery' || type === 'door') return t('profile.ordersPanel.delivery.door');
  if (type === 'inpost') return 'InPost';
  return type;
}

function positionLabel(count: number, t: Translate): string {
  const absoluteCount = Math.abs(count);
  const lastDigit = absoluteCount % 10;
  const lastTwoDigits = absoluteCount % 100;

  if (lastDigit === 1 && lastTwoDigits !== 11) return t('profile.ordersPanel.positions.one');
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return t('profile.ordersPanel.positions.few');
  }
  return t('profile.ordersPanel.positions.many');
}

function itemName(item: OrderItem): string {
  return (
    item.variant?.name_ru ||
    item.product?.name_ru ||
    item.product_name ||
    item.name ||
    (item.variant_id ? `#${item.variant_id}` : '')
  );
}

function orderItemsSummary(order: Order, t: Translate): string {
  const items = (Array.isArray(order.items) ? order.items : []) as OrderItem[];
  if (items.length === 0) return t('profile.ordersPanel.description');

  return items
    .map((item, index) => {
      const name = itemName(item) || `${t('profile.ordersPanel.positions.one')} ${index + 1}`;
      const quantity = Number(item.quantity ?? 1);
      return `${name} × ${quantity}`;
    })
    .join(', ');
}

function orderItemsCount(order: Order): number {
  const items = (Array.isArray(order.items) ? order.items : []) as OrderItem[];
  return items.reduce((sum, item) => sum + Number(item.quantity ?? 1), 0);
}

function formatMoney(value?: string | number): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return '0.00 zł';

  return `${amount.toFixed(2)} zł`;
}

function profileLanguageLabel(languageCode: string | undefined, t: Translate): string {
  if (languageCode === 'en') return t('profile.languages.en');
  if (languageCode === 'pl') return t('profile.languages.pl');
  if (languageCode === 'uk') return t('profile.languages.uk');
  return t('profile.languages.ru');
}

function tabClass(tab: ProfileTab, activeTab: ProfileTab): string {
  const baseClass = 'px-2 pb-2 flex items-center gap-2';
  if (tab === activeTab) {
    return `${baseClass} active-tab-indicator text-primary font-medium`;
  }

  return `${baseClass} text-on-surface-variant hover:text-on-surface transition-colors`;
}

function buildOrderCards(orders: Order[], t: Translate): string {
  if (orders.length === 0) {
    return String.raw`
          <div class="profile-empty-state">
            <span class="material-symbols-outlined">receipt_long</span>
            <strong>${t('profile.ordersPanel.emptyTitle')}</strong>
            <p>${t('profile.ordersPanel.emptyDescription')}</p>
          </div>`;
  }

  return orders.map((order) => {
    const itemsCount = orderItemsCount(order);

    return String.raw`
          <article class="profile-order-card">
            <div class="profile-order-top">
              <div>
                <strong>#${escapeHtml(order.id)}</strong>
                <span>${escapeHtml(formatOrderDate(order.created_at))}</span>
              </div>
              <mark class="profile-order-status ${orderStatusClass(order.status)}">${escapeHtml(orderStatusLabel(order.status, t))}</mark>
            </div>
            <div class="profile-order-body">
              <span>${escapeHtml(orderItemsSummary(order, t))}</span>
              <span>${escapeHtml(deliveryLabel(order.delivery_type, t))}</span>
            </div>
            <div class="profile-order-bottom">
              <span>${itemsCount} ${escapeHtml(positionLabel(itemsCount, t))}</span>
              <strong>${escapeHtml(formatMoney(order.total))}</strong>
            </div>
          </article>`;
  }).join('');
}

function buildProfileMarkup({
  t,
  user,
  orders,
  hasAdminAccess,
  activeLocale,
  activeTab,
}: {
  t: Translate;
  user: User | null;
  orders: Order[];
  hasAdminAccess: boolean;
  activeLocale: ActiveLocale;
  activeTab: ProfileTab;
}) {
  const name = displayName(user, t);
  const username = user?.username ? `@${user.username}` : '—';
  const profileLanguage = profileLanguageLabel(user?.language_code, t);
  const locale = activeLocale === 'ru' ? 'ru-RU' : activeLocale;
  const adminPanel = hasAdminAccess
    ? String.raw`
        <section>
          <button data-profile-action="admin" class="w-full group bg-surface-container-high hover:bg-surface-container-highest transition-all duration-300 rounded-xl p-4 flex items-center justify-between active:scale-[0.98]">
            <div class="flex items-center gap-4">
              <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <span class="material-symbols-outlined">admin_panel_settings</span>
              </div>
              <div class="text-left">
                <h3 class="text-on-surface font-headline-sm text-headline-sm">${t('profile.adminPanel.title')}</h3>
                <p class="text-on-surface-variant text-label-sm font-label-sm">${t('profile.adminPanel.description')}</p>
              </div>
            </div>
            <span class="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">chevron_right</span>
          </button>
        </section>`
    : '';

  return String.raw`
<div class="copied-profile-shell font-body-md text-body-md selection:bg-primary/30 selection:text-primary">
  <div class="relative z-10 min-h-screen flex flex-col w-full">

    <main class="flex-1 overflow-y-auto px-margin-page pb-32 pt-2 space-y-stack-lg custom-scrollbar">
      <section class="flex flex-col items-center space-y-4">
        <div class="relative">
          <div class="w-24 h-24 rounded-full bg-surface-container-high border-2 border-outline-variant flex items-center justify-center overflow-hidden shadow-2xl">
            <span class="text-headline-lg font-headline-lg text-primary">${escapeHtml(initial(user, t))}</span>
          </div>
          <div class="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center border-4 border-surface-dim">
            <span class="material-symbols-outlined text-[16px] text-on-primary">edit</span>
          </div>
        </div>
        <div class="text-center">
          <h2 class="text-headline-sm font-headline-sm text-on-surface">${escapeHtml(name)}</h2>
          <p class="text-label-lg font-label-lg text-on-surface-variant">${escapeHtml(username)}</p>
        </div>
      </section>

      <nav class="profile-tab-nav border-b border-outline-variant/30 pb-2" role="tablist" aria-label="${t('profile.tabsAria')}">
        <button id="profile-tab-profile" data-profile-tab="profile" class="${tabClass('profile', activeTab)}" type="button" role="tab" aria-selected="${activeTab === 'profile'}" aria-controls="profile-panel-profile">
          <span class="material-symbols-outlined text-sm">person</span>
          <span class="text-label-lg font-label-lg">${t('profile.tabs.profile')}</span>
        </button>
        <button id="profile-tab-orders" data-profile-tab="orders" class="${tabClass('orders', activeTab)}" type="button" role="tab" aria-selected="${activeTab === 'orders'}" aria-controls="profile-panel-orders">
          <span class="material-symbols-outlined text-sm" style="font-variation-settings: &quot;FILL&quot; 0;">receipt_long</span>
          <span class="text-label-lg font-label-lg">${t('profile.tabs.orders')}</span>
        </button>
        <button id="profile-tab-language" data-profile-tab="language" class="${tabClass('language', activeTab)}" type="button" role="tab" aria-selected="${activeTab === 'language'}" aria-controls="profile-panel-language">
          <span class="material-symbols-outlined text-sm" style="font-variation-settings: &quot;FILL&quot; 0;">language</span>
          <span class="text-label-lg font-label-lg">${t('profile.tabs.language')}</span>
        </button>
      </nav>

      <section id="profile-panel-profile" class="profile-panel space-y-stack-lg" data-profile-panel="profile" role="tabpanel" aria-labelledby="profile-tab-profile"${activeTab === 'profile' ? '' : ' hidden'}>
        <div class="profile-info-surface divide-y divide-outline-variant/20">
          <div class="flex justify-between items-center p-4">
            <span class="text-on-surface-variant font-label-lg text-label-lg">${t('profile.fields.username')}</span>
            ${dash(username)}
          </div>
          <div class="flex justify-between items-center p-4">
            <span class="text-on-surface-variant font-label-lg text-label-lg">${t('profile.fields.telegramId')}</span>
            ${dash(user?.tg_id)}
          </div>
          <div class="flex justify-between items-center p-4">
            <span class="text-on-surface-variant font-label-lg text-label-lg">${t('profile.fields.phone')}</span>
            ${dash(user?.phone)}
          </div>
          <div class="flex justify-between items-center p-4">
            <span class="text-on-surface-variant font-label-lg text-label-lg">${t('profile.fields.email')}</span>
            ${dash(user?.email)}
          </div>
          <div class="flex justify-between items-center p-4">
            <span class="text-on-surface-variant font-label-lg text-label-lg">${t('profile.fields.language')}</span>
            <span class="text-on-surface font-body-md text-body-md" data-profile-language-current>${profileLanguage}</span>
          </div>
          <div class="flex justify-between items-center p-4">
            <span class="text-on-surface-variant font-label-lg text-label-lg">${t('profile.fields.betaSince')}</span>
            <span class="text-on-surface font-body-md text-body-md">${escapeHtml(formatProfileDate(user?.created_at, locale))}</span>
          </div>
        </div>

${adminPanel}

        <section class="space-y-stack-sm">
          <button class="w-full p-4 rounded-xl flex items-center gap-4 hover:bg-surface-variant/50 transition-colors">
            <span class="material-symbols-outlined text-on-surface-variant">help</span>
            <span class="text-on-surface">${t('profile.actions.support')}</span>
          </button>
          <button class="w-full p-4 rounded-xl flex items-center gap-4 hover:bg-surface-variant/50 transition-colors">
            <span class="material-symbols-outlined text-on-surface-variant">info</span>
            <span class="text-on-surface">${t('profile.actions.about')}</span>
          </button>
          <button class="w-full p-4 rounded-xl flex items-center gap-4 text-error hover:bg-error-container/20 transition-colors">
            <span class="material-symbols-outlined">logout</span>
            <span>${t('profile.actions.signOut')}</span>
          </button>
        </section>
      </section>

      <section id="profile-panel-orders" class="profile-panel" data-profile-panel="orders" role="tabpanel" aria-labelledby="profile-tab-orders"${activeTab === 'orders' ? '' : ' hidden'}>
        <div class="profile-panel-heading">
          <div>
            <h3>${t('profile.ordersPanel.title')}</h3>
            <p>${t('profile.ordersPanel.description')}</p>
          </div>
          <span class="profile-panel-count">${orders.length}</span>
        </div>

        <div class="profile-order-list">
${buildOrderCards(orders, t)}
        </div>
      </section>

      <section id="profile-panel-language" class="profile-panel" data-profile-panel="language" role="tabpanel" aria-labelledby="profile-tab-language"${activeTab === 'language' ? '' : ' hidden'}>
        <div class="profile-panel-heading">
          <div>
            <h3>${t('profile.languagePanel.title')}</h3>
            <p>${t('profile.languagePanel.description')}</p>
          </div>
        </div>

        <div class="profile-language-list" role="radiogroup" aria-label="${t('profile.languagePanel.title')}">
          <button class="profile-language-option is-selected" type="button" data-profile-language-code="ru" data-profile-language="${t('profile.languages.ru')}" role="radio" aria-checked="true" aria-disabled="false">
            <span class="profile-language-code">RU</span>
            <span>
              <strong>${t('profile.languages.ru')}</strong>
              <small>${t('profile.languagePanel.current')}</small>
            </span>
            <span class="material-symbols-outlined">check</span>
          </button>
          <button class="profile-language-option is-disabled" type="button" data-profile-language-code="en" data-profile-language="${t('profile.languages.en')}" role="radio" aria-checked="false" aria-disabled="true" disabled>
            <span class="profile-language-code">EN</span>
            <span>
              <strong>${t('profile.languages.en')}</strong>
              <small>${t('profile.languagePanel.soon')}</small>
            </span>
            <span class="material-symbols-outlined">lock</span>
          </button>
          <button class="profile-language-option is-disabled" type="button" data-profile-language-code="pl" data-profile-language="${t('profile.languages.pl')}" role="radio" aria-checked="false" aria-disabled="true" disabled>
            <span class="profile-language-code">PL</span>
            <span>
              <strong>${t('profile.languages.pl')}</strong>
              <small>${t('profile.languagePanel.soon')}</small>
            </span>
            <span class="material-symbols-outlined">lock</span>
          </button>
          <button class="profile-language-option is-disabled" type="button" data-profile-language-code="uk" data-profile-language="${t('profile.languages.uk')}" role="radio" aria-checked="false" aria-disabled="true" disabled>
            <span class="profile-language-code">UK</span>
            <span>
              <strong>${t('profile.languages.uk')}</strong>
              <small>${t('profile.languagePanel.soon')}</small>
            </span>
            <span class="material-symbols-outlined">lock</span>
          </button>
        </div>
      </section>
    </main>

  </div>
</div>
`;
}

export default function Profile() {
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
  const fetchUser = useUserStore((state) => state.fetchUser);
  const activeLocale = useUserStore((state) => state.activeLocale);
  const itemCount = useCartStore((state) => state.itemCount);
  const [orders, setOrders] = useState<Order[]>([]);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState<ProfileTab>('profile');
  const { t } = useI18n(activeLocale);

  useEffect(() => {
    if (!user) {
      void fetchUser();
    }
  }, [fetchUser, user]);

  useEffect(() => {
    let isMounted = true;
    api.orders.list()
      .then((nextOrders) => {
        if (isMounted) setOrders(nextOrders);
      })
      .catch(() => {
        if (isMounted) setOrders([]);
      });

    adminApi.getAccess()
      .then((access) => {
        if (isMounted) setHasAdminAccess(Boolean(access.has_access));
      })
      .catch(() => {
        if (isMounted) setHasAdminAccess(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const profileMarkup = useMemo(
    () => buildProfileMarkup({ t, user, orders, hasAdminAccess, activeLocale, activeTab: activeProfileTab }),
    [t, user, orders, hasAdminAccess, activeLocale, activeProfileTab],
  );

  useEffect(() => {
    const interactiveElements = Array.from(document.querySelectorAll<HTMLElement>('.copied-profile-shell button, .copied-profile-shell a'));
    const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.copied-profile-shell [data-profile-tab]'));
    const panels = Array.from(document.querySelectorAll<HTMLElement>('.copied-profile-shell [data-profile-panel]'));
    const languageButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.copied-profile-shell [data-profile-language]'));
    const currentLanguage = document.querySelector<HTMLElement>('.copied-profile-shell [data-profile-language-current]');
    const adminButton = document.querySelector<HTMLButtonElement>('.copied-profile-shell [data-profile-action="admin"]');

    const handlers = interactiveElements.map((element) => {
      const onMouseDown = () => element.classList.add('scale-95');
      const onMouseUp = () => element.classList.remove('scale-95');
      const onMouseLeave = () => element.classList.remove('scale-95');
      element.addEventListener('mousedown', onMouseDown);
      element.addEventListener('mouseup', onMouseUp);
      element.addEventListener('mouseleave', onMouseLeave);
      return () => {
        element.removeEventListener('mousedown', onMouseDown);
        element.removeEventListener('mouseup', onMouseUp);
        element.removeEventListener('mouseleave', onMouseLeave);
      };
    });

    const tabHandlers = tabButtons.map((button) => {
      const onClick = () => {
        const nextTab = (button.dataset.profileTab ?? 'profile') as ProfileTab;
        setActiveProfileTab(nextTab);
        tabButtons.forEach((tab) => {
          const isActive = tab === button;
          tab.classList.toggle('active-tab-indicator', isActive);
          tab.classList.toggle('text-primary', isActive);
          tab.classList.toggle('font-medium', isActive);
          tab.classList.toggle('text-on-surface-variant', !isActive);
          tab.setAttribute('aria-selected', String(isActive));
        });
        panels.forEach((panel) => {
          panel.hidden = panel.dataset.profilePanel !== nextTab;
        });
      };
      button.addEventListener('click', onClick);
      return () => button.removeEventListener('click', onClick);
    });

    const languageHandlers = languageButtons.map((button) => {
      const onClick = () => {
        selectProfileLanguage(button, languageButtons, currentLanguage);
      };
      button.addEventListener('click', onClick);
      return () => button.removeEventListener('click', onClick);
    });

    const onAdminClick = () => navigate('/admin');
    adminButton?.addEventListener('click', onAdminClick);

    return () => {
      handlers.forEach((cleanup) => cleanup());
      tabHandlers.forEach((cleanup) => cleanup());
      languageHandlers.forEach((cleanup) => cleanup());
      adminButton?.removeEventListener('click', onAdminClick);
    };
  }, [navigate, profileMarkup]);

  return (
    <>
      <CopiedSmokeBackground />
      <CopiedTopBar />
      <CopiedPageTitle activeTab="profile" />
      <div dangerouslySetInnerHTML={{ __html: profileMarkup }} />
      <CopiedBottomNav activeTab="profile" cartCount={itemCount()} />
    </>
  );
}
