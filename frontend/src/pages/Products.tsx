import { useEffect, useMemo } from 'react';
import CopiedBottomNav from '../components/CopiedBottomNav';
import CopiedPageTitle from '../components/CopiedPageTitle';
import CopiedSmokeBackground from '../components/CopiedSmokeBackground';
import CopiedTopBar from '../components/CopiedTopBar';
import { useI18n } from '../i18n';
import { useUserStore } from '../store/user';

function buildCatalogMarkup(t: (key: string) => string) {
  return String.raw`
<div class="copied-catalog-shell dark overflow-x-hidden" data-catalog-layout="three">
  <div class="relative z-10 flex flex-col min-h-screen w-full">

    <div class="catalog-filter-bar px-margin-page py-3 relative z-10">
      <div class="catalog-view-toggle is-three" role="group" aria-label="${t('catalog.viewToggle')}">
        <button class="catalog-view-option" type="button" data-catalog-view="two" aria-label="${t('catalog.viewTwoColumns')}" aria-pressed="false">
          <span class="catalog-view-icon catalog-view-icon-two" aria-hidden="true">
            <span></span><span></span><span></span><span></span>
          </span>
        </button>
        <button class="catalog-view-option is-active" type="button" data-catalog-view="three" aria-label="${t('catalog.viewThreeColumns')}" aria-pressed="true">
          <span class="catalog-view-icon catalog-view-icon-three" aria-hidden="true">
            <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
          </span>
        </button>
      </div>
      <nav class="catalog-filter-scroll flex overflow-x-auto gap-3 custom-scrollbar" aria-label="${t('catalog.categoriesLabel')}">
        <button class="px-6 py-2 rounded-full font-label-lg text-label-lg whitespace-nowrap active-filter transition-all">${t('catalog.filters.all')}</button>
        <button class="px-6 py-2 rounded-full font-label-lg text-label-lg whitespace-nowrap bg-surface-container text-on-surface-variant hover:text-primary transition-all">${t('catalog.categories.liquids')}</button>
        <button class="px-6 py-2 rounded-full font-label-lg text-label-lg whitespace-nowrap bg-surface-container text-on-surface-variant hover:text-primary transition-all">${t('catalog.categories.pods')}</button>
        <button class="px-6 py-2 rounded-full font-label-lg text-label-lg whitespace-nowrap bg-surface-container text-on-surface-variant hover:text-primary transition-all">${t('catalog.categories.disposables')}</button>
        <button class="px-6 py-2 rounded-full font-label-lg text-label-lg whitespace-nowrap bg-surface-container text-on-surface-variant hover:text-primary transition-all">${t('catalog.categories.accessories')}</button>
      </nav>
    </div>

    <main class="flex-1 px-margin-page pt-2 pb-32">
      <div class="catalog-product-grid grid grid-cols-2 gap-4">
        <div class="product-card flex flex-col bg-surface-container rounded-xl overflow-hidden group">
          <div class="relative w-full aspect-square bg-surface-container-low flex items-center justify-center p-4">
            <div class="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay">
              <div class="w-full h-full" style="background-image: radial-gradient(circle at 50% 50%, #3D8489 0%, transparent 80%);"></div>
            </div>
            <img class="w-full h-full object-contain relative z-10 transition-transform duration-300 group-hover:scale-110" data-alt="A professional product shot of a small liquid bottle with a minimalist orange label, titled ELFLIQ. The bottle is positioned centrally against a dark, atmospheric charcoal background with subtle wisps of white smoke drifting around it. The lighting is focused and cinematic, highlighting the clean lines of the packaging in a premium dark mode UI context." src="https://lh3.googleusercontent.com/aida-public/AB6AXuBPuU_FTTQdbiQfy7xjXE1XKoPdLGAo-4KkMv5K9Ti7yfl_Dh0Cg3uolGwwq3nTemh0h_p6r_1M_AW_C-OWsul31c0sdEqau9t9JXFFxUyKXsMtLOSMa-bVZyaHPD8Ytbb_-gAj2o4r_x-ShcA2MoM7PD2P_A9s8wqN2uOfGRQgyfRgsb_klxI9iVCecshdd_6PAdGdc3DoSi4ORJhTim9Akq5HXJqX4Pj0PH5n9fsltpimhT6azVX1sobO7zQt1Zb-bT2h8s4DI3I"/>
          </div>
          <div class="p-4 flex flex-col gap-1">
            <h3 class="text-label-lg font-label-lg text-on-surface font-semibold">ELFLIQ</h3>
            <p class="text-label-sm font-label-sm text-on-surface-variant">Pink Lemonade</p>
            <div class="flex items-center justify-between mt-2">
              <span class="text-primary font-bold">49.90 zł</span>
              <span class="text-[10px] bg-surface-variant px-2 py-1 rounded text-on-surface-variant">2 ${t('product.flavor.few')}</span>
            </div>
          </div>
        </div>

        <div class="product-card flex flex-col bg-surface-container rounded-xl overflow-hidden group">
          <div class="relative w-full aspect-square bg-surface-container-low flex items-center justify-center p-4">
            <div class="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay">
              <div class="w-full h-full" style="background-image: radial-gradient(circle at 50% 50%, #3D8489 0%, transparent 80%);"></div>
            </div>
            <img class="w-full h-full object-contain relative z-10 transition-transform duration-300 group-hover:scale-110" data-alt="A high-end studio photograph of a premium vape liquid bottle with a dark, sophisticated label design. The bottle is set against a deep black OLED background with ethereal, semi-transparent smoke textures floating in the space. The overall aesthetic is minimalist and corporate, using the emerald and charcoal color palette of the brand for a cohesive and luxurious look." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCfl8sP2dL-8x6WVn5zuQjlfZBA0U6icjKsXTGNE9xTae3kCCmIeASJTFeeyvkvV2HhxHPfXagCAbEHXdFnnWJVDh8IIIdcuNHrR7vwR9PAyuiY0RP5-aUzz7r4Kr9wAoQwYGKHZbxMBHmPNv_h595yY3-VbpqXYWTuP9QbTFNAm4nOV4upFkd2cRb6bo9FmecIyFOmiIYNnCh6uOUoi9fPnxXLtQUp3BQ6gWD5oShFgapO2Z9gcsjIcgQpJm0UKuUkGZVLQh_gbkA"/>
          </div>
          <div class="p-4 flex flex-col gap-1">
            <h3 class="text-label-lg font-label-lg text-on-surface font-semibold">ELFLIQ</h3>
            <p class="text-label-sm font-label-sm text-on-surface-variant">Cotton Candy</p>
            <div class="flex items-center justify-between mt-2">
              <span class="text-primary font-bold">49.90 zł</span>
              <span class="text-[10px] bg-surface-variant px-2 py-1 rounded text-on-surface-variant">1 ${t('product.flavor.one')}</span>
            </div>
          </div>
        </div>

        <div class="product-card flex flex-col bg-surface-container rounded-xl overflow-hidden group">
          <div class="relative w-full aspect-square bg-surface-container-low flex items-center justify-center p-4">
            <div class="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay">
              <div class="w-full h-full" style="background-image: radial-gradient(circle at 50% 50%, #3D8489 0%, transparent 80%);"></div>
            </div>
            <img class="w-full h-full object-contain relative z-10 transition-transform duration-300 group-hover:scale-110" data-alt="An elegant presentation of a electronic cigarette device, sleek and metallic charcoal grey, lying on a surface with soft tonal shadows. The background is pitch black with artistic, glowing emerald light leaks and delicate smoke patterns that evoke a sense of high-tech precision and exclusive premium retail quality." src="https://lh3.googleusercontent.com/aida-public/AB6AXuD-E2ntP--Q62nXpmQTG0QC4GCPqFi_th3K-QO0vSDkyl7OmcBdApkvjlSO0er3RloDUkOl5_uoTuNPQCUUJiDvWxtGyZcmRkWaDoK9xkD9DH6iLqaeqs8pSXPmgAWGSY_g589bu88WN_89Oz5XR6GLq_jireXBMYibOouZaGnL8Tba03bhrteaubBjcADLy8cDRGbYtdLk3IbX1y7cm2cROo3ppr04JjX0a2ZKrSRyqscXDp5MMOMZsQVg2jILeiarZgeUWB2d-r8"/>
          </div>
          <div class="p-4 flex flex-col gap-1">
            <h3 class="text-label-lg font-label-lg text-on-surface font-semibold">XROS 3 Mini</h3>
            <p class="text-label-sm font-label-sm text-on-surface-variant">Black Matte</p>
            <div class="flex items-center justify-between mt-2">
              <span class="text-primary font-bold">129.00 zł</span>
              <span class="text-[10px] bg-surface-variant px-2 py-1 rounded text-on-surface-variant">Device</span>
            </div>
          </div>
        </div>

        <div class="product-card flex flex-col bg-surface-container rounded-xl overflow-hidden group">
          <div class="relative w-full aspect-square bg-surface-container-low flex items-center justify-center p-4">
            <div class="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay">
              <div class="w-full h-full" style="background-image: radial-gradient(circle at 50% 50%, #3D8489 0%, transparent 80%);"></div>
            </div>
            <img class="w-full h-full object-contain relative z-10 transition-transform duration-300 group-hover:scale-110" data-alt="A clean, minimalist product shot of a pack of vape cartridges. The packaging is white and charcoal with emerald green accents. The image is rendered with a shallow depth of field against a dark background featuring subtle smoke overlays that add texture and atmosphere, consistent with a high-end minimalist corporate brand identity." src="https://lh3.googleusercontent.com/aida-public/AB6AXuA-9qGlZattAntuY3h8zpiNqgyA5pI25fhRUbgEoNW1ob3Gyi2OhI1VcMHBkLzi18qKahYVlJMI8e2KEqY8-SRz-6Mm4YZo-tixAf6tlWEzZ0GhMDsy36iKwFSYnolVyPNkwyMe5UC7Pm5WQZMJE9s3WwcoRb_pQGf6G6DpdDNhZG1ljTGbh1MX9QdOR7VlK3dUzSN3offZnjLgjtFZy-4JefcN4vSfq1IpqoRNbOELSap3LyLGhIcTZ5HiQ04iC9jdaM7pK6zTBKA"/>
          </div>
          <div class="p-4 flex flex-col gap-1">
            <h3 class="text-label-lg font-label-lg text-on-surface font-semibold">Vaporesso Pods</h3>
            <p class="text-label-sm font-label-sm text-on-surface-variant">0.6 Ohm / 4pcs</p>
            <div class="flex items-center justify-between mt-2">
              <span class="text-primary font-bold">65.00 zł</span>
              <span class="text-[10px] bg-surface-variant px-2 py-1 rounded text-on-surface-variant">Pods</span>
            </div>
          </div>
        </div>

        <div class="product-card flex flex-col bg-surface-container rounded-xl overflow-hidden group">
          <div class="relative w-full aspect-square bg-surface-container-low flex items-center justify-center p-4">
            <div class="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay">
              <div class="w-full h-full" style="background-image: radial-gradient(circle at 50% 50%, #3D8489 0%, transparent 80%);"></div>
            </div>
            <img class="w-full h-full object-contain relative z-10 transition-transform duration-300 group-hover:scale-110" data-alt="Product photography of a colorful disposable vape pen with a vibrant green to blue gradient. It is isolated on a pure charcoal surface with faint smoke wisps in the foreground and background. The lighting is sharp and professional, highlighting the texture and ergonomics of the device for a modern, app-focused retail catalog interface." src="https://lh3.googleusercontent.com/aida-public/AB6AXuDuV0BIdYqT1MgScw9Q6nQJ876yLNMqeYK2XPTGawhUJQ5U3EUNn2RE9a18ndDzKFys_iLspxtCsuFdLWyD_9c6fm6va3wdbeLNlX-x76UyU7IMNK1g1bp_QUCDp1VIjR74yvkkYrY17CMfDBCLD-MylI_2vYzBRIUbp3u0LdL8zkzPRMKsG3UI3jgWEUswWA0XmoYKGCZwxIgNYmpPOdq264BQ_Oxc2jS_I9b5jxdazk05QYxfq3S3Xe3l6-H_6i9H0iNfO2cjBAQ"/>
          </div>
          <div class="p-4 flex flex-col gap-1">
            <h3 class="text-label-lg font-label-lg text-on-surface font-semibold">Elf Bar 1500</h3>
            <p class="text-label-sm font-label-sm text-on-surface-variant">Blue Razz Lemonade</p>
            <div class="flex items-center justify-between mt-2">
              <span class="text-primary font-bold">35.00 zł</span>
              <span class="text-[10px] bg-surface-variant px-2 py-1 rounded text-on-surface-variant">1500 puffs</span>
            </div>
          </div>
        </div>

        <div class="product-card flex flex-col bg-surface-container rounded-xl overflow-hidden group">
          <div class="relative w-full aspect-square bg-surface-container-low flex items-center justify-center p-4">
            <div class="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay">
              <div class="w-full h-full" style="background-image: radial-gradient(circle at 50% 50%, #3D8489 0%, transparent 80%);"></div>
            </div>
            <img class="w-full h-full object-contain relative z-10 transition-transform duration-300 group-hover:scale-110" data-alt="A sophisticated dark-themed product shot of an e-liquid bottle with a premium metallic label. The bottle is positioned in a cloud of delicate, swirling white smoke against an OLED-optimized charcoal background. The composition is balanced and minimalist, emphasizing brand exclusivity and technical precision in a modern digital shopping app environment." src="https://lh3.googleusercontent.com/aida-public/AB6AXuBQtfQcxqyAW1mKgAurm-xLiD8AoTPoJTdYQ2WlTCET8RHSIMYfyJmhErWLCYf7KhcBTo-3I9k8SbZWuwtRmhSBQMRpqpsk77WcM2YVcd55dcNK7js3QXOsXIHZV2BkCh-dwH18fGr1cYgARLE21JA7HUd9wThuABZG2PmsNt1AhBNt0fH0rg4Uiov9t4PuYkP_3MC90UpCtksW2T9w2Zs-GW1IHDBozw6rqik81FUXOmD3qwZsWVMNBz4Wz836__iQiUlaEbgAnW4"/>
          </div>
          <div class="p-4 flex flex-col gap-1">
            <h3 class="text-label-lg font-label-lg text-on-surface font-semibold">CHASER</h3>
            <p class="text-label-sm font-label-sm text-on-surface-variant">Triple Berry</p>
            <div class="flex items-center justify-between mt-2">
              <span class="text-primary font-bold">55.00 zł</span>
              <span class="text-[10px] bg-surface-variant px-2 py-1 rounded text-on-surface-variant">3 ${t('product.flavor.few')}</span>
            </div>
          </div>
        </div>
      </div>
    </main>

  </div>
</div>
`;
}

export default function Products() {
  const activeLocale = useUserStore((state) => state.activeLocale);
  const { t } = useI18n(activeLocale);
  const catalogMarkup = useMemo(() => buildCatalogMarkup(t), [t]);

  useEffect(() => {
    const catalogShell = document.querySelector<HTMLElement>('.copied-catalog-shell');
    const getFilters = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.copied-catalog-shell .catalog-filter-scroll button'));
    const getViewButtons = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.copied-catalog-shell [data-catalog-view]'));
    const onFilterClick = (btn: HTMLButtonElement) => {
      const filters = getFilters();
      filters.forEach((f) => f.classList.remove('active-filter', 'bg-surface-container', 'text-on-surface-variant'));
      filters.forEach((f) => {
        if (f !== btn) f.classList.add('bg-surface-container', 'text-on-surface-variant');
      });
      btn.classList.add('active-filter');
    };

    const onViewClick = (button: HTMLButtonElement) => {
      const viewButtons = getViewButtons();
      const nextView = button.dataset.catalogView === 'two' ? 'two' : 'three';
      const toggle = button.closest<HTMLElement>('.catalog-view-toggle');
      catalogShell?.setAttribute('data-catalog-layout', nextView);
      toggle?.classList.toggle('is-two', nextView === 'two');
      toggle?.classList.toggle('is-three', nextView === 'three');
      viewButtons.forEach((viewButton) => {
        const isActive = viewButton === button;
        viewButton.classList.toggle('is-active', isActive);
        viewButton.setAttribute('aria-pressed', String(isActive));
      });
    };

    const onCatalogClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || !catalogShell?.contains(target)) return;

      const viewButton = target.closest<HTMLButtonElement>('[data-catalog-view]');
      if (viewButton && catalogShell.contains(viewButton)) {
        onViewClick(viewButton);
        return;
      }

      const filterButton = target.closest<HTMLButtonElement>('.catalog-filter-scroll button');
      if (filterButton && catalogShell.contains(filterButton)) {
        onFilterClick(filterButton);
      }
    };

    catalogShell?.addEventListener('click', onCatalogClick);

    const cards = Array.from(document.querySelectorAll<HTMLElement>('.copied-catalog-shell .product-card'));
    const scaleDown = (card: HTMLElement) => { card.style.transform = 'scale(0.97)'; };
    const scaleUp = (card: HTMLElement) => { card.style.transform = 'scale(1)'; };
    cards.forEach((card) => {
      card.addEventListener('mousedown', () => scaleDown(card));
      card.addEventListener('mouseup', () => scaleUp(card));
      card.addEventListener('mouseleave', () => scaleUp(card));
    });

    return () => {
      catalogShell?.removeEventListener('click', onCatalogClick);
      cards.forEach((card) => card.replaceWith(card.cloneNode(true)));
    };
  }, []);

  return (
    <>
      <CopiedSmokeBackground />
      <CopiedTopBar />
      <CopiedPageTitle activeTab="catalog" />
      <div dangerouslySetInnerHTML={{ __html: catalogMarkup }} />
      <CopiedBottomNav activeTab="catalog" />
    </>
  );
}
