import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import CopiedBottomNav from '../components/CopiedBottomNav';
import CopiedPageTitle from '../components/CopiedPageTitle';
import CopiedSmokeBackground from '../components/CopiedSmokeBackground';
import CopiedTopBar from '../components/CopiedTopBar';
import { useI18n } from '../i18n';
import { useUserStore } from '../store/user';
import { selectProfileLanguage } from './profileInteractions';

function buildProfileMarkup(t: (key: string) => string) {
  return String.raw`
<div class="copied-profile-shell font-body-md text-body-md selection:bg-primary/30 selection:text-primary">
  <div class="relative z-10 min-h-screen flex flex-col w-full">

    <main class="flex-1 overflow-y-auto px-margin-page pb-32 pt-2 space-y-stack-lg custom-scrollbar">
      <section class="flex flex-col items-center space-y-4">
        <div class="relative">
          <div class="w-24 h-24 rounded-full bg-surface-container-high border-2 border-outline-variant flex items-center justify-center overflow-hidden shadow-2xl">
            <span class="text-headline-lg font-headline-lg text-primary">P</span>
          </div>
          <div class="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center border-4 border-surface-dim">
            <span class="material-symbols-outlined text-[16px] text-on-primary">edit</span>
          </div>
        </div>
        <div class="text-center">
          <h2 class="text-headline-sm font-headline-sm text-on-surface">paranoia</h2>
          <p class="text-label-lg font-label-lg text-on-surface-variant">@shinigami_qq</p>
        </div>
      </section>

      <nav class="profile-tab-nav border-b border-outline-variant/30 pb-2" role="tablist" aria-label="${t('profile.tabsAria')}">
        <button id="profile-tab-profile" data-profile-tab="profile" class="px-2 pb-2 active-tab-indicator flex items-center gap-2 text-primary font-medium" type="button" role="tab" aria-selected="true" aria-controls="profile-panel-profile">
          <span class="material-symbols-outlined text-sm">person</span>
          <span class="text-label-lg font-label-lg">${t('profile.tabs.profile')}</span>
        </button>
        <button id="profile-tab-orders" data-profile-tab="orders" class="px-2 pb-2 flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors" type="button" role="tab" aria-selected="false" aria-controls="profile-panel-orders">
          <span class="material-symbols-outlined text-sm" style="font-variation-settings: &quot;FILL&quot; 0;">receipt_long</span>
          <span class="text-label-lg font-label-lg">${t('profile.tabs.orders')}</span>
        </button>
        <button id="profile-tab-language" data-profile-tab="language" class="px-2 pb-2 flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors" type="button" role="tab" aria-selected="false" aria-controls="profile-panel-language">
          <span class="material-symbols-outlined text-sm" style="font-variation-settings: &quot;FILL&quot; 0;">language</span>
          <span class="text-label-lg font-label-lg">${t('profile.tabs.language')}</span>
        </button>
      </nav>

      <section id="profile-panel-profile" class="profile-panel space-y-stack-lg" data-profile-panel="profile" role="tabpanel" aria-labelledby="profile-tab-profile">
        <div class="profile-info-surface divide-y divide-outline-variant/20">
          <div class="flex justify-between items-center p-4">
            <span class="text-on-surface-variant font-label-lg text-label-lg">${t('profile.fields.username')}</span>
            <span class="text-on-surface font-body-md text-body-md">@shinigami_qq</span>
          </div>
          <div class="flex justify-between items-center p-4">
            <span class="text-on-surface-variant font-label-lg text-label-lg">${t('profile.fields.phone')}</span>
            <span class="text-on-surface font-body-md text-body-md text-opacity-40">—</span>
          </div>
          <div class="flex justify-between items-center p-4">
            <span class="text-on-surface-variant font-label-lg text-label-lg">${t('profile.fields.email')}</span>
            <span class="text-on-surface font-body-md text-body-md text-opacity-40">—</span>
          </div>
          <div class="flex justify-between items-center p-4">
            <span class="text-on-surface-variant font-label-lg text-label-lg">${t('profile.fields.language')}</span>
            <span class="text-on-surface font-body-md text-body-md" data-profile-language-current>${t('profile.languages.ru')}</span>
          </div>
          <div class="flex justify-between items-center p-4">
            <span class="text-on-surface-variant font-label-lg text-label-lg">${t('profile.fields.betaSince')}</span>
            <span class="text-on-surface font-body-md text-body-md">16.07.2024</span>
          </div>
        </div>

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
        </section>

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

      <section id="profile-panel-orders" class="profile-panel" data-profile-panel="orders" role="tabpanel" aria-labelledby="profile-tab-orders" hidden>
        <div class="profile-panel-heading">
          <div>
            <h3>${t('profile.ordersPanel.title')}</h3>
            <p>${t('profile.ordersPanel.description')}</p>
          </div>
          <span class="profile-panel-count">3</span>
        </div>

        <div class="profile-order-list">
          <article class="profile-order-card">
            <div class="profile-order-top">
              <div>
                <strong>#PL-1028</strong>
                <span>${t('profile.ordersPanel.today')}, 18:40</span>
              </div>
              <mark class="profile-order-status active">${t('profile.ordersPanel.status.processing')}</mark>
            </div>
            <div class="profile-order-body">
              <span>ELFLIQ Pink Lemonade</span>
              <span>${t('profile.ordersPanel.delivery.pickup')} · Warszawa Centrum</span>
            </div>
            <div class="profile-order-bottom">
              <span>2 ${t('profile.ordersPanel.positions.few')}</span>
              <strong>99.80 zł</strong>
            </div>
          </article>

          <article class="profile-order-card">
            <div class="profile-order-top">
              <div>
                <strong>#PL-1019</strong>
                <span>14.07.2026</span>
              </div>
              <mark class="profile-order-status done">${t('profile.ordersPanel.status.completed')}</mark>
            </div>
            <div class="profile-order-body">
              <span>XROS 3 Mini</span>
              <span>${t('profile.ordersPanel.delivery.door')} · Krakow</span>
            </div>
            <div class="profile-order-bottom">
              <span>1 ${t('profile.ordersPanel.positions.one')}</span>
              <strong>144.00 zł</strong>
            </div>
          </article>

          <article class="profile-order-card">
            <div class="profile-order-top">
              <div>
                <strong>#PL-1007</strong>
                <span>02.07.2026</span>
              </div>
              <mark class="profile-order-status done">${t('profile.ordersPanel.status.completed')}</mark>
            </div>
            <div class="profile-order-body">
              <span>CHASER Triple Berry</span>
              <span>${t('profile.ordersPanel.delivery.pickup')} · Wroclaw Market</span>
            </div>
            <div class="profile-order-bottom">
              <span>3 ${t('profile.ordersPanel.positions.few')}</span>
              <strong>165.00 zł</strong>
            </div>
          </article>
        </div>
      </section>

      <section id="profile-panel-language" class="profile-panel" data-profile-panel="language" role="tabpanel" aria-labelledby="profile-tab-language" hidden>
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
  const activeLocale = useUserStore((state) => state.activeLocale);
  const { t } = useI18n(activeLocale);
  const profileMarkup = useMemo(() => buildProfileMarkup(t), [t]);

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
        const nextTab = button.dataset.profileTab ?? 'profile';
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
  }, [navigate]);

  return (
    <>
      <CopiedSmokeBackground />
      <CopiedTopBar />
      <CopiedPageTitle activeTab="profile" />
      <div dangerouslySetInnerHTML={{ __html: profileMarkup }} />
      <CopiedBottomNav activeTab="profile" />
    </>
  );
}
