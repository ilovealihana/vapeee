import { useEffect, useMemo } from 'react';
import CopiedBottomNav from '../components/CopiedBottomNav';
import CopiedPageTitle from '../components/CopiedPageTitle';
import CopiedSmokeBackground from '../components/CopiedSmokeBackground';
import CopiedTopBar from '../components/CopiedTopBar';
import { useI18n } from '../i18n';
import { useUserStore } from '../store/user';

function buildCartMarkup(t: (key: string) => string) {
  return String.raw`
<div class="copied-cart-shell min-h-screen flex flex-col overflow-x-hidden custom-scroll">
  <main class="flex-1 mt-2 px-margin-page pb-32 w-full relative z-10">

    <div class="space-y-stack-md">
      <div class="cart-card p-4 rounded-xl flex items-center gap-4 border border-outline-variant/10">
        <div class="w-16 h-16 bg-surface-container-low rounded-lg overflow-hidden flex items-center justify-center">
          <img class="h-12 w-auto object-contain" data-alt="A premium vapor product bottle with minimalist branding, captured in a studio setting with dramatic side-lighting. The background features ethereal white smoke textures swirling around the dark charcoal surface, emphasizing a luxurious and technical aesthetic. The lighting highlights the sleek glass texture of the bottle, following the brand's dark-mode-first visual language." src="https://lh3.googleusercontent.com/aida-public/AB6AXuDwen8L4HW1EqVROrUakC08UprLncSr0eGk81hWmYqxIV84iPCOtD0SAltE-vrzg_v7vx4tyOxA8f2u8BP6m-W9cBJHkyjijV8KyRSGR3echUe8nAMQ2rTT_HUvKOCqOLUL3nbeDafBTBL5QOZVHdnfTyB2PFIXMqSVyfgvA7cmZLQbMPNnSvlymkBhVlp11lZRdRO_Ouj65Kij8NyGNoa4gH62snN_q9i5dfiVfCeuQ1uOKKwSZaFl8UlBvzkneCMSc40hI29LZrs"/>
        </div>
        <div class="flex-1">
          <h3 class="text-label-lg font-label-lg text-on-surface">ELFLIQ</h3>
          <p class="text-label-sm font-label-sm text-on-surface-variant">Pink Lemonade</p>
          <p class="text-label-lg font-label-lg text-primary mt-1">49.90 zł</p>
        </div>
        <div class="flex items-center bg-surface-container rounded-full px-2 py-1 gap-3">
          <button class="w-6 h-6 flex items-center justify-center text-on-surface-variant hover:text-on-surface">
            <span class="material-symbols-outlined text-[18px]">remove</span>
          </button>
          <span class="text-label-lg font-label-lg text-on-surface w-4 text-center">1</span>
          <button class="w-6 h-6 flex items-center justify-center text-on-surface-variant hover:text-on-surface">
            <span class="material-symbols-outlined text-[18px]">add</span>
          </button>
        </div>
      </div>

      <div class="cart-card p-4 rounded-xl flex items-center gap-4 border border-outline-variant/10">
        <div class="w-16 h-16 bg-surface-container-low rounded-lg overflow-hidden flex items-center justify-center">
          <img class="h-12 w-auto object-contain" data-alt="A sleek black vape accessory bottle with modern typography on a dark charcoal background. Wispy smoke tendrils curl around the product in a high-contrast dark environment. The scene is illuminated with a soft, focused emerald light that catches the edges of the product, reflecting a premium and specialized retail atmosphere consistent with a minimalist corporate identity." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCrHzwI9eAdIlO5uhpzLS-1C3dYViiNklG7Rztae2fBpGGhue3zG0i156AxWfBAMETxc79AikSZvHCnk1RaqB_9YomMokHMs1EpkUTjR2IHwOa0X6yUzJ1k7b06xWEFsAI0MvWXyRk84RcjqjjWxCjP05vhT-b7zNuzW-XVeqYmetvQigAUkzqA0SU3OhbWRBRkpK8ta0AY5U7IBNF6JatXc_WCKf1A8ORPCEniexceIRtBD-g_X29jnpAdmVTFi2agaklX-90SxZc"/>
        </div>
        <div class="flex-1">
          <h3 class="text-label-lg font-label-lg text-on-surface">ELFLIQ</h3>
          <p class="text-label-sm font-label-sm text-on-surface-variant">Elfjacks</p>
          <p class="text-label-lg font-label-lg text-primary mt-1">49.90 zł</p>
        </div>
        <div class="flex items-center bg-surface-container rounded-full px-2 py-1 gap-3">
          <button class="w-6 h-6 flex items-center justify-center text-on-surface-variant hover:text-on-surface">
            <span class="material-symbols-outlined text-[18px]">remove</span>
          </button>
          <span class="text-label-lg font-label-lg text-on-surface w-4 text-center">1</span>
          <button class="w-6 h-6 flex items-center justify-center text-on-surface-variant hover:text-on-surface">
            <span class="material-symbols-outlined text-[18px]">add</span>
          </button>
        </div>
      </div>
    </div>

    <div class="mt-stack-lg pt-6 border-t border-outline-variant/20">
      <div class="flex justify-between items-center mb-8">
        <span class="text-headline-sm font-headline-sm text-on-surface">${t('cart.total')}</span>
        <span class="text-headline-sm font-headline-sm text-primary">99.80 zł</span>
      </div>

      <button class="w-full bg-primary text-on-primary py-4 rounded-xl font-headline-sm flex justify-center items-center gap-2 active:scale-95 transition-transform duration-150">
        <span>${t('cart.checkout')}</span>
        <span class="material-symbols-outlined">arrow_forward</span>
      </button>
    </div>
  </main>

</div>
`;
}

export default function Cart() {
  const activeLocale = useUserStore((state) => state.activeLocale);
  const { t } = useI18n(activeLocale);
  const cartMarkup = useMemo(() => buildCartMarkup(t), [t]);

  useEffect(() => {
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.copied-cart-shell .flex.items-center.bg-surface-container button'));

    const onClick = (button: HTMLButtonElement) => {
      const icon = button.querySelector('.material-symbols-outlined');
      const isAdd = icon?.textContent === 'add';
      const countSpan = button.parentElement?.querySelector<HTMLSpanElement>('span.text-on-surface');
      if (!countSpan) return;

      let count = Number.parseInt(countSpan.textContent || '1', 10);
      if (isAdd) count += 1;
      else if (count > 1) count -= 1;

      countSpan.textContent = String(count);
      countSpan.classList.add('scale-110');
      window.setTimeout(() => countSpan.classList.remove('scale-110'), 100);
    };

    buttons.forEach((button) => button.addEventListener('click', () => onClick(button)));

    return () => {
      buttons.forEach((button) => button.replaceWith(button.cloneNode(true)));
    };
  }, []);

  return (
    <>
      <CopiedSmokeBackground />
      <CopiedTopBar />
      <CopiedPageTitle activeTab="cart" />
      <div dangerouslySetInnerHTML={{ __html: cartMarkup }} />
      <CopiedBottomNav activeTab="cart" />
    </>
  );
}
