/** Small line icons for the phone navigation. They take the text colour. */
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

export const BudgetIcon = () => (
  <svg {...base} className="h-6 w-6">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 13h3M8 16h6" />
  </svg>
);

export const TransactionsIcon = () => (
  <svg {...base} className="h-6 w-6">
    <path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" />
  </svg>
);

export const AnalyticsIcon = () => (
  <svg {...base} className="h-6 w-6">
    <path d="M12 3a9 9 0 1 0 9 9h-9z" />
    <path d="M15 3.5A9 9 0 0 1 20.5 9H15z" />
  </svg>
);

export const SettingsIcon = () => (
  <svg {...base} className="h-6 w-6">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
  </svg>
);

export const MenuIcon = () => (
  <svg {...base} className="h-6 w-6">
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

export const CloseIcon = () => (
  <svg {...base} className="h-6 w-6">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
