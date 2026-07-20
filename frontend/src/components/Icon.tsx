import type { ReactNode, SVGProps } from 'react';

type IconName =
  | 'home' | 'catalog' | 'cart' | 'profile' | 'search' | 'filter' | 'chevronRight'
  | 'chevronLeft' | 'plus' | 'minus' | 'trash' | 'settings' | 'orders' | 'language'
  | 'mapPin' | 'truck' | 'package' | 'box' | 'droplet' | 'zap' | 'edit' | 'x'
  | 'check' | 'grid' | 'sliders' | 'shield' | 'user' | 'mail' | 'phone' | 'calendar'
  | 'help' | 'info' | 'logout' | 'menu' | 'bell' | 'tag';

const paths: Record<IconName, ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9 21v-7h6v7" /></>,
  catalog: <><path d="M5 4h14v16H5z" /><path d="M8 8h8" /><path d="M8 12h8" /><path d="M8 16h5" /></>,
  cart: <><path d="M4 5h2l2.2 10.5h9.9L21 8H7" /><circle cx="10" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /></>,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  filter: <><path d="M4 6h16" /><path d="M7 12h10" /><path d="M10 18h4" /></>,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  minus: <path d="M5 12h14" />,
  trash: <><path d="M4 7h16" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M6 7l1 14h10l1-14" /><path d="M9 7V4h6v3" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a7.8 7.8 0 0 0-2-1.2L14 3h-4l-.4 2.7a7.8 7.8 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-1a7.8 7.8 0 0 0 2 1.2L10 21h4l.4-2.7a7.8 7.8 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5c.1-.4.2-.8.2-1.2Z" /></>,
  orders: <><path d="M7 3h10v18H7z" /><path d="M9 7h6" /><path d="M9 11h6" /><path d="M9 15h4" /></>,
  language: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a14 14 0 0 1 0 18" /><path d="M12 3a14 14 0 0 0 0 18" /></>,
  mapPin: <><path d="M12 21s7-5.2 7-11a7 7 0 0 0-14 0c0 5.8 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></>,
  truck: <><path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7z" /><circle cx="7" cy="19" r="2" /><circle cx="17" cy="19" r="2" /></>,
  package: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="M4 7.5 12 12l8-4.5" /><path d="M12 12v9" /></>,
  box: <><path d="M4 6h16v14H4z" /><path d="M4 10h16" /><path d="M9 6V4h6v2" /></>,
  droplet: <path d="M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11Z" />,
  zap: <path d="M13 2 4 14h7l-1 8 10-13h-7l0-7Z" />,
  edit: <><path d="M4 20h4l11-11-4-4L4 16v4Z" /><path d="m14 6 4 4" /></>,
  x: <><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  grid: <><path d="M4 4h7v7H4z" /><path d="M13 4h7v7h-7z" /><path d="M4 13h7v7H4z" /><path d="M13 13h7v7h-7z" /></>,
  sliders: <><path d="M4 7h10" /><path d="M18 7h2" /><circle cx="16" cy="7" r="2" /><path d="M4 17h2" /><path d="M10 17h10" /><circle cx="8" cy="17" r="2" /></>,
  shield: <path d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
  mail: <><path d="M4 6h16v12H4z" /><path d="m4 7 8 6 8-6" /></>,
  phone: <path d="M7 4h4l1 5-2.5 1.5a12 12 0 0 0 4 4L15 12l5 1v4c0 1-1 3-3 3C10 20 4 14 4 7c0-2 2-3 3-3Z" />,
  calendar: <><path d="M5 5h14v15H5z" /><path d="M8 3v4" /><path d="M16 3v4" /><path d="M5 10h14" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.5 2.5 0 0 1 4.6 1.4c0 1.8-2.4 2.1-2.4 3.8" /><path d="M12 17.5h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><path d="M12 7h.01" /></>,
  logout: <><path d="M14 8V5a2 2 0 0 0-2-2H6v18h6a2 2 0 0 0 2-2v-3" /><path d="M9 12h12" /><path d="m17 8 4 4-4 4" /></>,
  menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
  bell: <><path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  tag: <><path d="M20 13 13 20 4 11V4h7l9 9Z" /><path d="M7.5 7.5h.01" /></>,
};

export default function Icon({ name, size = 20, ...props }: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
