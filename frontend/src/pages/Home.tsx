import { useEffect, useMemo } from 'react';
import CopiedBottomNav from '../components/CopiedBottomNav';
import CopiedPageTitle from '../components/CopiedPageTitle';
import CopiedSmokeBackground from '../components/CopiedSmokeBackground';
import CopiedTopBar from '../components/CopiedTopBar';
import { useI18n } from '../i18n';
import { useUserStore } from '../store/user';

function buildHomeMarkup(t: (key: string) => string) {
  return String.raw`
<div class="copied-home-shell font-body-md text-body-md min-h-screen pb-24 selection:bg-primary/30">
  <main class="pt-2 px-margin-page space-y-stack-lg relative overflow-hidden">

    <section class="relative z-10 space-y-1">
      <h2 class="text-headline-md font-headline-md text-on-surface">${t('home.greeting').replace('{name}', 'paranoia')}</h2>
      <p class="text-body-md font-body-md text-on-surface-variant">${t('home.searchPrompt')}</p>
    </section>

    <section class="grid grid-cols-2 gap-stack-md relative z-10">
      <div class="bg-surface-container border border-outline-variant/30 rounded-xl p-4 flex flex-col gap-3 active-scale cursor-pointer transition-colors hover:bg-surface-container-high group">
        <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <span class="material-symbols-outlined text-primary">location_on</span>
        </div>
        <div>
          <h3 class="text-label-lg font-label-lg text-on-surface">${t('home.pickupTitle')}</h3>
          <p class="text-label-sm font-label-sm text-on-surface-variant">${t('home.pickupDescription')}</p>
        </div>
      </div>

      <div class="bg-surface-container border border-outline-variant/30 rounded-xl p-4 flex flex-col gap-3 active-scale cursor-pointer transition-colors hover:bg-surface-container-high">
        <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <span class="material-symbols-outlined text-primary" data-weight="fill" style="font-variation-settings: &quot;FILL&quot; 1;">package</span>
        </div>
        <div>
          <h3 class="text-label-lg font-label-lg text-on-surface">${t('home.deliveryTitle')}</h3>
          <p class="text-label-sm font-label-sm text-on-surface-variant">${t('home.deliveryDescription')}</p>
        </div>
      </div>
    </section>

    <section class="space-y-stack-md relative z-10">
      <div class="flex justify-between items-end">
        <h2 class="text-label-lg font-label-lg text-on-surface uppercase tracking-wider">${t('home.categories')}</h2>
        <button class="text-label-sm font-label-sm text-primary">${t('home.allCategories')}</button>
      </div>

      <div class="grid grid-cols-3 gap-stack-md">
        <div class="bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 flex flex-col items-center gap-3 active-scale cursor-pointer transition-all hover:border-primary/40">
          <div class="text-primary-container">
            <span class="material-symbols-outlined text-[32px]">water_drop</span>
          </div>
          <span class="text-label-sm font-label-sm text-on-surface">${t('catalog.categories.liquids')}</span>
        </div>

        <div class="bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 flex flex-col items-center gap-3 active-scale cursor-pointer transition-all hover:border-primary/40">
          <div class="text-primary-container">
            <span class="material-symbols-outlined text-[32px]">vaping_rooms</span>
          </div>
          <span class="text-label-sm font-label-sm text-on-surface">${t('catalog.categories.pods')}</span>
        </div>

        <div class="bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 flex flex-col items-center gap-3 active-scale cursor-pointer transition-all hover:border-primary/40">
          <div class="text-primary-container">
            <span class="material-symbols-outlined text-[32px]">air</span>
          </div>
          <span class="text-label-sm font-label-sm text-on-surface">${t('catalog.categories.disposables')}</span>
        </div>
      </div>
    </section>

    <section class="relative z-10">
      <div class="bg-primary/10 border border-primary/20 rounded-xl p-5 flex items-center justify-between overflow-hidden relative group active-scale cursor-pointer">
        <div class="absolute -right-4 -bottom-4 opacity-30 group-hover:scale-110 transition-transform duration-700">
          <span class="material-symbols-outlined text-[100px] text-primary">cloud</span>
        </div>
        <div class="flex gap-4 items-center">
          <div class="w-10 h-10 bg-primary text-on-primary rounded-lg flex items-center justify-center">
            <span class="material-symbols-outlined">sell</span>
          </div>
          <div class="space-y-0.5">
            <h3 class="text-label-lg font-label-lg text-on-surface">${t('home.newArrivalsTitle')}</h3>
            <p class="text-label-sm font-label-sm text-on-surface-variant">${t('home.newArrivalsDescription')}</p>
          </div>
        </div>
        <span class="material-symbols-outlined text-primary transition-transform group-hover:translate-x-1">chevron_right</span>
      </div>
    </section>

    <section class="space-y-stack-md relative z-10">
      <h2 class="text-label-lg font-label-lg text-on-surface uppercase tracking-wider">${t('home.popular')}</h2>
      <div class="grid grid-cols-2 gap-stack-md">
        <div class="bg-surface-container rounded-xl overflow-hidden active-scale cursor-pointer flex flex-col">
          <div class="relative h-40 bg-surface-container-highest/50 flex items-center justify-center p-4">
            <img class="h-full object-contain" data-alt="A professional studio product shot of an ELFLIQ pink lemonade e-liquid bottle. The bottle is sleek and minimal, placed against a dark, smoky charcoal background with subtle emerald green light reflections. High-end retail photography style with atmospheric depth and crisp textures." src="https://lh3.googleusercontent.com/aida-public/AB6AXuDdnikrZl456nEvAcok7KTrmqnZc-e8Z8nzzkCdyN7oSn86j9zKJx33hiQJyudR5Saq0nSla38xzvELIeLEfiAcSZ6ZMx2ZXhdvsASCGDwTColzgvKjFn9MmYfzR9_c5LMqKp0tQOhvqWn75uyVuGGlT4jkUYdqWLhY1fw_gcUSjqnazyWDb02pBxKHNYrtOqdlOuG-sSvYfhTGJuHNB1nM-r3GyQwmZ3zCs4TvOiI4MabCNdUOMBgRnQS2rLd8Ba8TSFz3djnQ2vs">
          </div>
          <div class="p-3 space-y-1">
            <p class="text-label-sm font-label-sm text-on-surface">ELFLIQ</p>
            <p class="text-label-sm font-label-sm text-on-surface-variant">Pink Lemonade</p>
            <div class="flex justify-between items-center pt-2">
              <span class="text-label-lg font-label-lg text-primary">49.90 zł</span>
              <button class="bg-secondary-container p-1 rounded-lg">
                <span class="material-symbols-outlined text-[18px]">add_shopping_cart</span>
              </button>
            </div>
          </div>
        </div>

        <div class="bg-surface-container rounded-xl overflow-hidden active-scale cursor-pointer flex flex-col">
          <div class="relative h-40 bg-surface-container-highest/50 flex items-center justify-center p-4">
            <img class="h-full object-contain" data-alt="A professional product photo of a sleek, black Lost Mary OS5000 vape device. The device has a matte texture and is displayed against a deep black background with soft, ethereal smoke wisps swirling around it. Highlights are in a vibrant emerald green tone, reflecting the premium dark-mode aesthetic of the app." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCnfME7MJ-lOKNQ4iPwLtOvQd8IgMst7qE06H17tI28DxpRWlWv3nloeHTYuVe0yAuhczbPFPNZkf2hAuCvvLbyC5FgkOqPlHlmCIssPkms40s2sy3U3oKelpaNoacGqnkX7H3UzZM-uK0msn1NlriDZ6kQf0l4W_IOCa1Wf9xT68ovpiFcuwX7p9HG_v2TCbNa6aMl_s7eh_JQS1INZqNGRsgaYDePkhCe3f1P-YAfKZ40jdGbs4q6J-CzYp6LVj-z_2KGzLIHwYk">
          </div>
          <div class="p-3 space-y-1">
            <p class="text-label-sm font-label-sm text-on-surface">LOST MARY</p>
            <p class="text-label-sm font-label-sm text-on-surface-variant">Blue Razz Ice</p>
            <div class="flex justify-between items-center pt-2">
              <span class="text-label-lg font-label-lg text-primary">54.90 zł</span>
              <button class="bg-secondary-container p-1 rounded-lg">
                <span class="material-symbols-outlined text-[18px]">add_shopping_cart</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>

</div>
`;
}

export default function Home() {
  const activeLocale = useUserStore((state) => state.activeLocale);
  const { t } = useI18n(activeLocale);
  const homeMarkup = useMemo(() => buildHomeMarkup(t), [t]);

  useEffect(() => {
    const onScroll = () => {
      const header = document.querySelector('.copied-shared-topbar');
      if (!header) return;
      if (window.scrollY > 20) header.classList.add('shadow-md');
      else header.classList.remove('shadow-md');
    };

    const elements = Array.from(document.querySelectorAll<HTMLElement>('.copied-home-shell .active-scale'));
    const onTouchStart = (el: HTMLElement) => {
      el.style.transform = 'scale(0.95)';
      el.style.transition = 'transform 0.1s ease-out';
    };
    const onTouchEnd = (el: HTMLElement) => {
      el.style.transform = 'scale(1)';
    };

    window.addEventListener('scroll', onScroll);
    elements.forEach((el) => {
      el.addEventListener('touchstart', () => onTouchStart(el));
      el.addEventListener('touchend', () => onTouchEnd(el));
    });

    return () => {
      window.removeEventListener('scroll', onScroll);
      elements.forEach((el) => {
        el.replaceWith(el.cloneNode(true));
      });
    };
  }, []);

  return (
    <>
      <CopiedSmokeBackground />
      <CopiedTopBar />
      <CopiedPageTitle activeTab="home" />
      <div dangerouslySetInnerHTML={{ __html: homeMarkup }} />
      <CopiedBottomNav activeTab="home" />
    </>
  );
}
